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

  // Use stable primitives as deps — NOT the full profile object, which changes
  // reference on every render and causes infinite effect re-runs.
  const profileId = profile?.id;
  const profileName = profile?.full_name;
  const profileAvatar = profile?.avatar_url;
  const profileRole = profile?.role;

  // ── Fetch historical messages ────────────────────────────────────────────
  useEffect(() => {
    if (!meetingId || !profileId) return;

    let cancelled = false;
    setIsLoading(true);

    supabase
      .from('meeting_messages')
      .select('*, sender:profiles(full_name, avatar_url, role)')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setMessages((data || []) as MobileMeetingMessage[]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId, profileId]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!meetingId || !profileId) return;

    // Use a unique channel name each mount to prevent Supabase from returning
    // an already-subscribed channel instance when the effect re-fires.
    const channelName = `meeting_chat:${meetingId}:${Date.now()}`;
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
          const newMessage = payload.new as MobileMeetingMessage;

          // Replace optimistic message if it exists, otherwise ignore here
          // (the broadcast handler below adds remote messages for real-time feel)
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

            // Not optimistic — someone else's message confirmed by DB
            return prev;
          });

          // Fetch sender name for DB-confirmed messages not from us
          if (newMessage.sender_id !== profileId) {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('full_name, avatar_url, role')
              .eq('id', newMessage.sender_id)
              .single();

            setMessages((prev) => {
              if (prev.some((item) => item.id === newMessage.id)) return prev;
              return [
                ...prev,
                { ...newMessage, sender: senderData || undefined, status: 'sent' },
              ];
            });
          }
        }
      )
      .on('broadcast', { event: 'chat_msg' }, ({ payload }) => {
        // Fast path: real-time message broadcast by the sender before DB confirms
        const newMessage = payload as MobileMeetingMessage;
        if (newMessage.sender_id === profileId) return; // already added optimistically

        setMessages((prev) => {
          if (prev.some((item) => item.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, status: 'sent' }];
        });
      })
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[MeetingChat] Channel error, will retry on next mount');
        }
      });

    return () => {
      // Async removal is fine — we won't reuse this channel name
      supabase.removeChannel(channel).catch(() => {});
      channelRef.current = null;
    };
  }, [meetingId, profileId]); // ← stable primitive deps, not the full profile object

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!meetingId || !profileId || !content.trim()) return false;

      const messageContent = content.trim();
      const optimisticId = `temp-${Date.now()}`;

      const optimisticMessage: MobileMeetingMessage = {
        id: optimisticId,
        meeting_id: meetingId,
        sender_id: profileId,
        content: messageContent,
        created_at: new Date().toISOString(),
        status: 'sending',
        sender: {
          full_name: profileName ?? null,
          avatar_url: profileAvatar ?? null,
          role: profileRole ?? null,
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        const { data: inserted, error } = await supabase
          .from('meeting_messages')
          .insert({
            meeting_id: meetingId,
            sender_id: profileId,
            content: messageContent,
          })
          .select()
          .single();

        if (error) throw error;

        // Broadcast so other participants see it instantly (before DB propagates)
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
              ? {
                  ...(inserted as MobileMeetingMessage),
                  sender: optimisticMessage.sender,
                  status: 'sent',
                }
              : item
          )
        );

        return true;
      } catch (error) {
        console.error('[MobileMeetingChat] sendMessage failed', error);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === optimisticId ? { ...item, status: 'error' } : item
          )
        );
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [meetingId, profileId, profileName, profileAvatar, profileRole]
  );

  return {
    messages,
    isLoading,
    isSending,
    sendMessage,
  };
}
