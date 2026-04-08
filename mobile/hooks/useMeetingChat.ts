import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MobileProfile } from '../lib/meetings';

export interface MobileMeetingMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
  sender?: {
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
  } | null;
}

export function useMeetingChat(meetingId?: string, profile?: MobileProfile | null) {
  const [messages, setMessages] = useState<MobileMeetingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!meetingId || !profile) return;

    let cancelled = false;

    async function fetchMessages() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('meeting_messages')
          .select('*, sender:profiles(full_name, avatar_url, role)')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (!cancelled) setMessages((data || []) as MobileMeetingMessage[]);
      } catch (error) {
        console.error('[MobileMeetingChat] fetchMessages failed', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [meetingId, profile]);

  useEffect(() => {
    if (!meetingId || !profile) return;

    const channel = supabase.channel(`meeting_chat:${meetingId}`);
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
          const newMessage = payload.new as MobileMeetingMessage;

          setMessages((prev) => {
            if (prev.some((item) => item.id === newMessage.id)) return prev;

            const optimisticIndex = prev.findIndex(
              (item) =>
                item.status === 'sending' &&
                item.sender_id === newMessage.sender_id &&
                item.content === newMessage.content
            );

            if (optimisticIndex !== -1) {
              const next = [...prev];
              next[optimisticIndex] = {
                ...newMessage,
                sender: prev[optimisticIndex].sender,
                status: 'sent',
              };
              return next;
            }

            return prev;
          });

          const { data: senderData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, role')
            .eq('id', newMessage.sender_id)
            .single();

          setMessages((prev) => {
            if (prev.some((item) => item.id === newMessage.id)) return prev;
            return [...prev, { ...newMessage, sender: senderData || undefined, status: 'sent' }];
          });
        }
      )
      .on('broadcast', { event: 'chat_msg' }, ({ payload }) => {
        const newMessage = payload as MobileMeetingMessage;
        if (newMessage.sender_id === profile.id) return;

        setMessages((prev) => {
          if (prev.some((item) => item.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, status: 'sent' }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [meetingId, profile]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!meetingId || !profile || !content.trim()) return false;

      const messageContent = content.trim();
      const optimisticId = `temp-${Date.now()}`;

      const optimisticMessage: MobileMeetingMessage = {
        id: optimisticId,
        meeting_id: meetingId,
        sender_id: profile.id,
        content: messageContent,
        created_at: new Date().toISOString(),
        status: 'sending',
        sender: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url || null,
          role: profile.role,
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        const { data: inserted, error } = await supabase
          .from('meeting_messages')
          .insert({
            meeting_id: meetingId,
            sender_id: profile.id,
            content: messageContent,
          })
          .select()
          .single();

        if (error) throw error;

        channelRef.current?.send({
          type: 'broadcast',
          event: 'chat_msg',
          payload: {
            ...inserted,
            sender: optimisticMessage.sender,
          },
        });

        setMessages((prev) =>
          prev.map((item) =>
            item.id === optimisticId
              ? { ...(inserted as MobileMeetingMessage), sender: optimisticMessage.sender, status: 'sent' }
              : item
          )
        );

        return true;
      } catch (error) {
        console.error('[MobileMeetingChat] sendMessage failed', error);
        setMessages((prev) =>
          prev.map((item) => (item.id === optimisticId ? { ...item, status: 'error' } : item))
        );
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [meetingId, profile]
  );

  return {
    messages,
    isLoading,
    isSending,
    sendMessage,
  };
}
