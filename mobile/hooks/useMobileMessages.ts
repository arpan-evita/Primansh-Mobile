import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import {
  getCurrentMobileProfile,
  listAllowedMeetingProfiles,
  type MobileProfile,
} from '../lib/meetings';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';
type MessageType = 'text' | 'image' | 'audio' | 'file' | 'meeting';

export type MobileChatProfile = MobileProfile & {
  last_seen_at?: string | null;
};

export type MobileChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: MessageType;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  meeting_id: string | null;
  created_at: string;
  is_read: boolean;
  status: MessageStatus;
  local_uri?: string | null;
  sender?: {
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
    last_seen_at?: string | null;
  } | null;
};

export type MobileConversation = {
  id: string;
  title: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  unread_count: number;
  participants: {
    profile_id: string;
    profile: MobileChatProfile;
  }[];
  last_message?: MobileChatMessage | null;
};

type UploadAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  durationSeconds?: number | null;
  base64Data?: string | null;
};

const CHAT_MEDIA_BUCKET = 'chat-media';

function normalizeMessageStatus(message: Partial<MobileChatMessage>): MessageStatus {
  if (message.status) return message.status;
  if (message.is_read) return 'read';
  return 'sent';
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_');
}

function base64ToArrayBuffer(base64: string) {
  const cleanBase64 = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binaryString = globalThis.atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes.buffer;
}

function sortByCreatedAt(items: MobileChatMessage[]) {
  return [...items].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

function shouldReplaceOptimistic(
  optimistic: MobileChatMessage,
  nextMessage: MobileChatMessage
) {
  if (!optimistic.id.startsWith('temp-')) return false;
  if (optimistic.sender_id !== nextMessage.sender_id) return false;
  if (optimistic.conversation_id !== nextMessage.conversation_id) return false;
  if (optimistic.message_type !== nextMessage.message_type) return false;
  if ((optimistic.file_name || null) !== (nextMessage.file_name || null)) return false;
  if ((optimistic.content || null) !== (nextMessage.content || null)) return false;

  const optimisticTime = new Date(optimistic.created_at).getTime();
  const nextTime = new Date(nextMessage.created_at).getTime();
  return Math.abs(nextTime - optimisticTime) < 60_000;
}

async function fetchMessageById(messageId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles(full_name, avatar_url, role, last_seen_at)')
    .eq('id', messageId)
    .single();

  if (error) throw error;

  return {
    ...(data as any),
    status: normalizeMessageStatus(data as any),
  } as MobileChatMessage;
}

export function useMobileMessages() {
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [allowedRecipients, setAllowedRecipients] = useState<MobileProfile[]>([]);
  const [conversations, setConversations] = useState<MobileConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MobileChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

  const activeConversationIdRef = useRef<string | null>(null);
  const conversationIdsRef = useRef<string[]>([]);
  const typingChannelRef = useRef<any>(null);
  const globalChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const isTypingSubscribedRef = useRef(false);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  const refreshConversations = useCallback(
    async (options?: { preserveActive?: boolean }) => {
      const currentProfile = profile || (await getCurrentMobileProfile());
      if (!currentProfile) {
        setConversations([]);
        setActiveConversationId(null);
        return;
      }

      setIsRefreshingConversations(true);
      try {
        const { data: participationData, error: participationError } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('profile_id', currentProfile.id);

        if (participationError) throw participationError;

        const conversationIds = Array.from(
          new Set((participationData || []).map((item) => item.conversation_id))
        );
        conversationIdsRef.current = conversationIds;

        if (conversationIds.length === 0) {
          setConversations([]);
          setActiveConversationId(null);
          return;
        }

        const { data: conversationData, error: conversationError } = await supabase
          .from('conversations')
          .select(
            '*, participants:conversation_participants(profile_id, profile:profiles(id, full_name, avatar_url, role, associated_client_id, last_seen_at))'
          )
          .in('id', conversationIds)
          .eq('is_archived', false)
          .order('updated_at', { ascending: false });

        if (conversationError) throw conversationError;

        const enriched = await Promise.all(
          (conversationData || []).map(async (conversation) => {
            const [{ data: lastMessageData }, { count }] = await Promise.all([
              supabase
                .from('messages')
                .select('*, sender:profiles(full_name, avatar_url, role, last_seen_at)')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: false })
                .limit(1),
              supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversation.id)
                .neq('sender_id', currentProfile.id)
                .eq('is_read', false),
            ]);

            const lastMessage = lastMessageData?.[0]
              ? ({
                  ...(lastMessageData[0] as any),
                  status: normalizeMessageStatus(lastMessageData[0] as any),
                } as MobileChatMessage)
              : null;

            return {
              ...(conversation as any),
              unread_count: count || 0,
              last_message: lastMessage,
            } as MobileConversation;
          })
        );

        setConversations(enriched);

        setActiveConversationId((previous) => {
          if (options?.preserveActive !== false && previous && enriched.some((item) => item.id === previous)) {
            return previous;
          }
          return null; // Never auto-select the first conversation on load
        });
      } catch (error) {
        console.error('[MobileMessages] refreshConversations failed', error);
      } finally {
        setIsRefreshingConversations(false);
      }
    },
    [profile]
  );

  const markConversationAsRead = useCallback(
    async (conversationId: string) => {
      if (!profile) return;

      try {
        await supabase
          .from('messages')
          .update({ is_read: true, status: 'read' })
          .eq('conversation_id', conversationId)
          .neq('sender_id', profile.id)
          .neq('status', 'read');
      } catch (error) {
        console.error('[MobileMessages] markConversationAsRead failed', error);
      }
    },
    [profile]
  );

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      if (!profile) return;

      setIsRefreshingMessages(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:profiles(full_name, avatar_url, role, last_seen_at)')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(150);

        if (error) throw error;

        const normalized = (data || []).map(
          (message) =>
            ({
              ...(message as any),
              status: normalizeMessageStatus(message as any),
            } as MobileChatMessage)
        );

        setMessages(normalized);
        await markConversationAsRead(conversationId);
        setMessages((previous) =>
          previous.map((item) =>
            item.sender_id !== profile.id ? { ...item, is_read: true, status: 'read' } : item
          )
        );
      } catch (error) {
        console.error('[MobileMessages] fetchMessages failed', error);
        setMessages([]);
      } finally {
        setIsRefreshingMessages(false);
      }
    },
    [markConversationAsRead, profile]
  );

  const updatePresenceHeartbeat = useCallback(async (currentProfile: MobileProfile | null) => {
    if (!currentProfile) return;
    try {
      await supabase.rpc('update_last_seen', { p_user_id: currentProfile.id });
    } catch (error) {
      console.error('[MobileMessages] update_last_seen failed', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsBootstrapping(true);
      try {
        const currentProfile = await getCurrentMobileProfile();
        if (!mounted) return;

        setProfile(currentProfile);
        if (!currentProfile) {
          setAllowedRecipients([]);
          setConversations([]);
          setMessages([]);
          return;
        }

        const recipients = await listAllowedMeetingProfiles(currentProfile);
        if (!mounted) return;
        setAllowedRecipients(recipients);

        await updatePresenceHeartbeat(currentProfile);
        await refreshConversations({ preserveActive: false });
      } catch (error) {
        console.error('[MobileMessages] bootstrap failed', error);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        updatePresenceHeartbeat(profile || null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [profile, updatePresenceHeartbeat]);

  useEffect(() => {
    if (!activeConversationId || !profile) {
      setMessages([]);
      return;
    }

    fetchMessages(activeConversationId);
  }, [activeConversationId, fetchMessages, profile]);

  useEffect(() => {
    if (!profile) return;

    const presenceChannel = supabase.channel('mobile-chat-presence', {
      config: { presence: { key: profile.id } },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUserIds(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            name: profile.full_name,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const globalChannel = supabase
      .channel(`mobile-messages:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `profile_id=eq.${profile.id}`,
        },
        async () => {
          await refreshConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as MobileChatMessage;
          if (!conversationIdsRef.current.includes(newMessage.conversation_id)) return;

          const fullMessage = await fetchMessageById(newMessage.id).catch(() => ({
            ...newMessage,
            status: normalizeMessageStatus(newMessage),
          }));

          if (newMessage.conversation_id === activeConversationIdRef.current) {
            setMessages((previous) => {
              if (previous.some((item) => item.id === fullMessage.id)) return previous;

              const optimisticIndex = previous.findIndex((item) =>
                shouldReplaceOptimistic(item, fullMessage)
              );

              if (optimisticIndex !== -1) {
                const next = [...previous];
                next[optimisticIndex] = fullMessage;
                return sortByCreatedAt(next);
              }

              return sortByCreatedAt([...previous, fullMessage]);
            });

            if (newMessage.sender_id !== profile.id) {
              await supabase
                .from('messages')
                .update({ is_read: true, status: 'read' })
                .eq('id', newMessage.id);
            }
          } else if (newMessage.sender_id !== profile.id && newMessage.status === 'sent') {
            await supabase
              .from('messages')
              .update({ status: 'delivered' })
              .eq('id', newMessage.id)
              .eq('status', 'sent');
          }

          await refreshConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const updatedMessage = payload.new as MobileChatMessage;
          if (!conversationIdsRef.current.includes(updatedMessage.conversation_id)) return;

          setMessages((previous) =>
            previous.map((item) =>
              item.id === updatedMessage.id
                ? { ...item, ...(updatedMessage as any), status: normalizeMessageStatus(updatedMessage) }
                : item
            )
          );

          setConversations((previous) =>
            previous.map((item) =>
              item.id === updatedMessage.conversation_id && item.last_message?.id === updatedMessage.id
                ? {
                    ...item,
                    last_message: {
                      ...item.last_message,
                      ...(updatedMessage as any),
                      status: normalizeMessageStatus(updatedMessage),
                    },
                  }
                : item
            )
          );

          await refreshConversations();
        }
      )
      .subscribe();

    globalChannelRef.current = globalChannel;

    return () => {
      supabase.removeChannel(globalChannel);
      globalChannelRef.current = null;
    };
  }, [profile, refreshConversations]);

  useEffect(() => {
    if (!activeConversationId || !profile) {
      setTypingUsers([]);
      return;
    }

    const typingChannel = supabase.channel(`typing:${activeConversationId}`, {
      config: { presence: { key: profile.id } },
    });
    typingChannelRef.current = typingChannel;
    isTypingSubscribedRef.current = false;

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState<{ name: string; typing: boolean }>();
        const names = Object.entries(state)
          .filter(([key, values]) => key !== profile.id && (values as any[])[0]?.typing)
          .map(([, values]) => (values as any[])[0]?.name || 'Someone');
        setTypingUsers(names);
      })
      .subscribe((status) => {
        isTypingSubscribedRef.current = status === 'SUBSCRIBED';
      });

    return () => {
      setTypingUsers([]);
      supabase.removeChannel(typingChannel);
      typingChannelRef.current = null;
      isTypingSubscribedRef.current = false;
    };
  }, [activeConversationId, profile]);

  const broadcastTyping = useCallback(
    async (isTyping: boolean) => {
      if (!typingChannelRef.current || !profile || !isTypingSubscribedRef.current) return;

      try {
        if (isTyping) {
          await typingChannelRef.current.track({
            name: profile.full_name,
            typing: true,
            at: new Date().toISOString(),
          });
        } else {
          await typingChannelRef.current.untrack();
        }
      } catch (error) {
        console.error('[MobileMessages] broadcastTyping failed', error);
      }
    },
    [profile]
  );

  const createConversationWithProfile = useCallback(
    async (targetProfileId: string) => {
      if (!profile) return null;

      const participantIds = Array.from(new Set([profile.id, targetProfileId]));
      const { data, error } = await supabase.rpc('upsert_conversation_v1', {
        p_participant_ids: participantIds,
        p_title: null,
        p_client_id: null,
        p_context_type: null,
        p_context_id: null,
      });

      if (error) throw error;

      const conversationId = data as string;
      await refreshConversations({ preserveActive: true });
      setActiveConversationId(conversationId);
      return conversationId;
    },
    [profile, refreshConversations]
  );

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!profile || !activeConversationId) return false;

      const trimmed = text.trim();
      if (!trimmed) return false;

      const tempMessage: MobileChatMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: activeConversationId,
        sender_id: profile.id,
        content: trimmed,
        message_type: 'text',
        file_url: null,
        file_name: null,
        file_size: null,
        mime_type: null,
        meeting_id: null,
        created_at: new Date().toISOString(),
        is_read: false,
        status: 'sending',
        sender: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url || null,
          role: profile.role,
        },
      };

      setMessages((previous) => sortByCreatedAt([...previous, tempMessage]));
      setIsSending(true);

      try {
        const { data: messageId, error } = await supabase.rpc('send_message_v2', {
          p_conversation_id: activeConversationId,
          p_content: trimmed,
          p_message_type: 'text',
        });

        if (error) throw error;

        const fullMessage = await fetchMessageById(messageId as string).catch(() => null);
        if (fullMessage) {
          setMessages((previous) =>
            sortByCreatedAt(
              previous.map((item) => (item.id === tempMessage.id ? fullMessage : item))
            )
          );
        }

        await refreshConversations();
        return true;
      } catch (error) {
        console.error('[MobileMessages] sendTextMessage failed', error);
        setMessages((previous) =>
          previous.map((item) =>
            item.id === tempMessage.id ? { ...item, status: 'error' } : item
          )
        );
        return false;
      } finally {
        setIsSending(false);
        broadcastTyping(false);
      }
    },
    [activeConversationId, broadcastTyping, profile, refreshConversations]
  );

  const uploadAndSendAsset = useCallback(
    async (asset: UploadAsset, type?: MessageType) => {
      if (!profile || !activeConversationId) return false;

      const normalizedType =
        type ||
        (asset.mimeType?.startsWith('image/')
          ? 'image'
          : asset.mimeType?.startsWith('audio/')
            ? 'audio'
            : 'file');

      setUploadingLabel(asset.name);
      setIsSending(true);

      try {
        const safeName = sanitizeFileName(asset.name);
        const filePath = `${activeConversationId}/${Date.now()}_${safeName}`;
        const fileBase64 =
          asset.base64Data ||
          (await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          }));
        const fileBuffer = base64ToArrayBuffer(fileBase64);

        const { error: uploadError } = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(filePath, fileBuffer, {
            contentType: asset.mimeType || undefined,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(filePath);

        const optimisticMessage: MobileChatMessage = {
          id: `temp-${Date.now()}`,
          conversation_id: activeConversationId,
          sender_id: profile.id,
          content: normalizedType === 'audio' ? String(asset.durationSeconds || 0) : null,
          message_type: normalizedType,
          file_url: publicUrl,
          file_name: asset.name,
          file_size: asset.size || null,
          mime_type: asset.mimeType || null,
          meeting_id: null,
          created_at: new Date().toISOString(),
          is_read: false,
          status: 'sending',
          local_uri: asset.uri || null,
          sender: {
            full_name: profile.full_name,
            avatar_url: profile.avatar_url || null,
            role: profile.role,
          },
        };

        setMessages((previous) => sortByCreatedAt([...previous, optimisticMessage]));

        const { data: messageId, error: sendError } = await supabase.rpc('send_message_v2', {
          p_conversation_id: activeConversationId,
          p_content: normalizedType === 'audio' ? String(asset.durationSeconds || 0) : null,
          p_message_type: normalizedType,
          p_file_url: publicUrl,
          p_file_name: asset.name,
          p_file_size: asset.size || null,
          p_mime_type: asset.mimeType || null,
        });

        if (sendError) throw sendError;

        const fullMessage = await fetchMessageById(messageId as string).catch(() => null);
        if (fullMessage) {
          setMessages((previous) =>
            sortByCreatedAt(
              previous.map((item) => (item.id === optimisticMessage.id ? fullMessage : item))
            )
          );
        }

        await refreshConversations();
        return true;
      } catch (error) {
        console.error('[MobileMessages] uploadAndSendAsset failed', error);
        return false;
      } finally {
        setUploadingLabel(null);
        setIsSending(false);
      }
    },
    [activeConversationId, profile, refreshConversations]
  );

  return {
    profile,
    allowedRecipients,
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    typingUsers,
    onlineUserIds,
    isBootstrapping,
    isRefreshingConversations,
    isRefreshingMessages,
    isSending,
    uploadingLabel,
    setActiveConversationId,
    refreshConversations,
    refreshMessages: fetchMessages,
    createConversationWithProfile,
    sendTextMessage,
    uploadAndSendAsset,
    broadcastTyping,
  };
}
