import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface MeetingMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
  sender?: {
    full_name: string;
    avatar_url: string;
    role: string;
  };
}

export function useMeetingChat(meetingId?: string) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<any>(null);

  // 1. Initial Fetch
  useEffect(() => {
    if (!meetingId || !profile) return;

    async function fetchMessages() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('meeting_messages')
          .select(`
            *,
            sender:profiles(full_name, avatar_url, role)
          `)
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('[MeetingChat] Load failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMessages();
  }, [meetingId, profile]);

  // 2. Real-time Subscription (Hybrid: Broadcast + Postgres Changes)
  useEffect(() => {
    if (!meetingId || !profile) return;

    const channelName = `meeting_chat:${meetingId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_messages',
          filter: `meeting_id=eq.${meetingId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          setMessages((prev) => {
            // Deduplication: If we already got this via broadcast, don't add again
            if (prev.some(m => m.id === newMsg.id)) return prev;

            // Optimistic sync: If we have a 'sending' versions of this message, replace it
            const tempIdx = prev.findIndex(m => m.status === 'sending' && m.content === newMsg.content);
            if (tempIdx !== -1) {
              const next = [...prev];
              next[tempIdx] = { ...newMsg, status: 'sent' };
              return next;
            }

            // Otherwise, we need to fetch the sender (this is the slow path fallback)
            // But we wrap it in a function to avoid blocking the state update
            handleNewMessageWithFetch(newMsg);
            return prev;
          });
        }
      )
      .on('broadcast', { event: 'chat_msg' }, ({ payload }) => {
        // Zero-latency path: Received message directly from peer
        const newMsg = payload as MeetingMessage;
        if (newMsg.sender_id === profile.id) return; // Ignore own broadcast

        setMessages((prev) => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, { ...newMsg, status: 'sent' }];
        });
      })
      .subscribe();

    const handleNewMessageWithFetch = async (msg: any) => {
      const { data: senderData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('id', msg.sender_id)
        .single();
      
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, { ...msg, sender: senderData || undefined, status: 'sent' }];
      });
    };

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [meetingId, profile]);

  // 3. Send Message
  const sendMeetingMessage = useCallback(async (content: string) => {
    if (!meetingId || !profile || !content.trim()) return false;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MeetingMessage = {
      id: tempId,
      meeting_id: meetingId,
      sender_id: profile.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      status: 'sending',
      sender: {
        full_name: profile.full_name || 'You',
        avatar_url: profile.avatar_url || '',
        role: profile.role || 'user'
      }
    };

    // 1. Optimistic Update (Immediate UI response)
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // 2. Persist to DB
      const { data: newMsg, error } = await supabase
        .from('meeting_messages')
        .insert({
          meeting_id: meetingId,
          sender_id: profile.id,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Broadcast to Peers (Zero-latency delivery)
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'chat_msg',
          payload: { 
            ...newMsg, 
            sender: optimisticMsg.sender 
          }
        });
      }

      // 4. Update 'sending' to 'sent'
      setMessages(prev => prev.map(m => m.id === tempId ? { ...newMsg, sender: optimisticMsg.sender, status: 'sent' } : m));
      
      return true;
    } catch (err: any) {
      console.error('[MeetingChat] Send failed:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove failed message
      toast.error('Failed to send message');
      return false;
    }
  }, [meetingId, profile]);

  return {
    messages,
    sendMessage: sendMeetingMessage,
    isLoading,
  };
}
