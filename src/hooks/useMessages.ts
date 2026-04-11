import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { startRtcSession } from '@/lib/rtcSessions';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'audio' | 'file' | 'meeting';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  meeting_id: string | null;
  client_message_id?: string | null;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  created_at: string;
  is_read: boolean;
  sender?: {
    full_name: string;
    avatar_url: string;
    role: string;
  };
  meeting?: {
    id: string;
    status: 'active' | 'ended' | 'scheduled';
    start_time: string;
    room_id: string;
    chat_summary?: any;
  };
}

export interface Conversation {
  id: string;
  title: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  participants: {
    profile_id: string;
    profile: {
      full_name: string;
      avatar_url: string;
      role: string;
    };
  }[];
  last_message?: Message;
}

const CHAT_MEDIA_BUCKET = 'chat-media';

function createClientMessageId(prefix = 'msg') {
  const maybeCrypto = (globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  }).crypto;
  const randomPart =
    typeof maybeCrypto?.randomUUID === 'function'
      ? maybeCrypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomPart}`;
}

export function useMessages(conversationId?: string) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const typingChannelRef = useRef<any>(null);
  const activeConvIdRef = useRef<string | null>(null);
  const [isTypingSubscribed, setIsTypingSubscribed] = useState(false);

  // Sync the ref with the state
  useEffect(() => {
    activeConvIdRef.current = conversationId || null;
  }, [conversationId]);

  // ── 1. Fetch Conversations ──────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;

    const fetchConversations = async () => {
      setIsLoading(true);
      try {
        const { data: participationData } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('profile_id', profile.id);

        const convIds = (participationData || []).map(p => p.conversation_id);

        if (convIds.length === 0) {
          setConversations([]);
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('conversations')
          .select(`
            *,
            participants:conversation_participants(
              profile_id,
              profile:profiles(full_name, avatar_url, role, last_seen_at)
            )
          `)
          .in('id', convIds)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        
        const enriched = await Promise.all((data || []).map(async (conv) => {
          const { data: lastMsgData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const lastMsg = lastMsgData?.[0] || null;
          
          return { ...conv, last_message: lastMsg };
        }));

        setConversations(enriched as any || []);
      } catch (err: any) {
        console.error('Error fetching conversations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [profile]);

  // ── 2. Global Real-time Synchronization (Profile Scoped) ────────────────
  useEffect(() => {
    if (!profile) return;

    const globalChannel = supabase
      .channel(`user-sync:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_participants',
        filter: `profile_id=eq.${profile.id}`
      }, async (payload) => {
        const { data: convData } = await supabase
          .from('conversations')
          .select(`
            *,
            participants:conversation_participants(
              profile_id,
              profile:profiles(full_name, avatar_url, role, last_seen_at)
            )
          `)
          .eq('id', payload.new.conversation_id)
          .single();
        
        if (convData) {
          setConversations(prev => {
            if (prev.find(c => c.id === convData.id)) return prev;
            return [convData as any, ...prev];
          });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        console.log('Real-time message received:', payload.new);
        const newMsg = payload.new as Message;
        
        setConversations(prev => {
          const exists = prev.find(c => c.id === newMsg.conversation_id);
          if (!exists) return prev;
          return prev.map(c => 
            c.id === newMsg.conversation_id 
              ? { ...c, updated_at: newMsg.created_at, last_message: newMsg } 
              : c
          ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });

        if (newMsg.conversation_id === activeConvIdRef.current) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            
              const hydrate = async () => {
                try {
                  const { data: senderData } = await supabase
                    .from('profiles').select('full_name, avatar_url, role').eq('id', newMsg.sender_id).single();

                  let meetingData = null;
                  if (newMsg.message_type === 'meeting' && newMsg.meeting_id) {
                    const { data: m } = await supabase
                      .from('meetings').select('id, status, start_time, room_id, chat_summary').eq('id', newMsg.meeting_id).single();
                    meetingData = m;
                  }

                  const fullMsg = { ...newMsg, sender: senderData, meeting: meetingData } as Message;
                  setMessages(cur => {
                    const idx = cur.findIndex((m) =>
                      m.id === fullMsg.id ||
                      (!!m.client_message_id && !!fullMsg.client_message_id && m.client_message_id === fullMsg.client_message_id) ||
                      (m.id.startsWith('temp-') && !m.client_message_id && m.content === fullMsg.content)
                    );
                    if (idx !== -1) {
                      const next = [...cur];
                      next[idx] = fullMsg;
                      return next;
                    }
                    return [...cur, fullMsg];
                  });
                } catch (err) {
                  console.error("Hydration failed, showing raw message:", err);
                  setMessages(cur => [...cur.filter(m => m.id !== newMsg.id), newMsg]);
                }

                if (newMsg.sender_id !== profile.id && window.document.hasFocus()) {
                  await supabase.from('messages').update({ is_read: true, status: 'read' }).eq('id', newMsg.id);
                }
              };
            hydrate();
            return prev;
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        if (payload.new.conversation_id === activeConvIdRef.current) {
          setMessages(prev => prev.map(m => 
            m.id === payload.new.id 
              ? { ...m, ...payload.new, status: payload.new.status || (payload.new.is_read ? 'read' : 'sent') } 
              : m
          ));
        }
      })
      .on('broadcast', { event: 'new_meeting' }, async ({ payload }) => {
        console.log('Broadcast meeting received:', payload);
        const { conversation_id, meeting_id } = payload;
        
        // Only if it's the current conversation and we don't have this message yet
        if (conversation_id === activeConvIdRef.current) {
           // We could manually trigger a fetch or just wait for the postgres_change.
           // Since postgres_change is already handled above, the broadcast is mostly for
           // UX/Animation or prioritizing the fetch.
           // However, to be 100% sure we show it, we can trigger a refresh of messages.
        }
      })
      .subscribe((status) => {
        console.log(`Global sync channel status for ${profile.id}:`, status);
      });

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [profile]);

  // ── 3. Fetch Messages & Active Presence ──────────────────────────────────
  useEffect(() => {
    if (!conversationId || !profile) { setMessages([]); return; }

    const conversationChannel = supabase.channel(`chat:${conversationId}`)
      .on('broadcast', { event: 'new_meeting' }, async ({ payload }) => {
        console.log('Instant meeting broadcast received:', payload);
        // Meeting invitations usually arrive via Postgres Changes, but this broadcast 
        // can trigger a proactive fetch if the DB event is delayed.
        const { data: m } = await supabase
          .from('messages')
          .select(`*, sender:profiles(full_name, avatar_url, role), meeting:meetings(*)`)
          .eq('meeting_id', payload.meeting_id)
          .single();
        
        if (m) {
          setMessages(prev => {
            if (prev.find(msg => msg.id === m.id)) return prev;
            return [...prev.filter(msg => !msg.id.startsWith('temp-')), m as any];
          });
        }
      })
      .subscribe();

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`*, sender:profiles(full_name, avatar_url, role), meeting:meetings(*)`)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        const mapped = (data || []).map(m => ({
          ...m,
          status: m.status || (m.is_read ? 'read' : 'sent')
        }));
        setMessages(mapped as any || []);

        // Mark as read
        await supabase
          .from('messages')
          .update({ is_read: true, status: 'read' })
          .eq('conversation_id', conversationId)
          .neq('sender_id', profile.id)
          .eq('is_read', false);
      } catch (err) {
        console.error('Fetch messages failed:', err);
      }
    };

    fetchMessages();

    // Typing presence channel
    const typingChannel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: profile.id } }
    });
    typingChannelRef.current = typingChannel;

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState<{ name: string; typing: boolean }>();
        const typingNames = Object.entries(state)
          .filter(([key, vals]) => key !== profile.id && (vals as any[])[0]?.typing)
          .map(([, vals]) => (vals as any[])[0]?.name || 'Someone');
        setTypingUsers(typingNames);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsTypingSubscribed(true);
      });

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(typingChannel);
      typingChannelRef.current = null;
      setIsTypingSubscribed(false);
    };
  }, [conversationId, profile]);

  // ── 4. Typing & Operations ──────────────────────────────────────────────
  const broadcastTyping = useCallback(async (isTyping: boolean) => {
    if (!conversationId || !profile || !typingChannelRef.current || !isTypingSubscribed) return;
    try {
      if (isTyping) await typingChannelRef.current.track({ name: profile.full_name, typing: true });
      else await typingChannelRef.current.untrack();
    } catch (err) {
      console.error('Error broadcasting typing:', err);
    }
  }, [conversationId, profile]);

  const sendMessage = async (content: string) => {
    if (!profile || !conversationId) return;
    
    // Optimistic update
    const clientMessageId = createClientMessageId('text');
    const tempId = `temp-${clientMessageId}`;
    const tempMsg: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: profile.id,
      content,
      message_type: 'text',
      status: 'sending',
      created_at: new Date().toISOString(),
      file_url: null,
      file_name: null,
      file_size: null,
      mime_type: null,
      meeting_id: null,
      client_message_id: clientMessageId,
      is_read: false
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const { data: msgId, error } = await supabase.rpc('send_message_v2', {
        p_conversation_id: conversationId,
        p_content: content,
        p_message_type: 'text',
        p_client_message_id: clientMessageId,
      });
      if (error) throw error;

      const { data: fullMsg } = await supabase
        .from('messages')
        .select('*, sender:profiles(full_name, avatar_url, role), meeting:meetings(*)')
        .eq('id', msgId)
        .maybeSingle();

      if (fullMsg) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId || message.client_message_id === clientMessageId
              ? (fullMsg as Message)
              : message
          )
        );
      }
      
      return true;
    } catch (err: any) {
      console.error("Error sending message:", err);
      toast.error(err.message || "Failed to send message. Please check your connection.");
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return false;
    }
  };

  const sendMedia = async (file: File) => {
    if (!profile || !conversationId) return;
    
    setUploadProgress(0);
    let uploadedFilePath: string | null = null;
    let persistedMessageId: string | null = null;
    let tempId: string | null = null;
    let clientMessageId: string | null = null;
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${conversationId}/${fileName}`;
      clientMessageId = createClientMessageId('media');
      uploadedFilePath = filePath;

      tempId = `temp-${clientMessageId}`;
      const tempMessage: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: profile.id,
        content: file.type.startsWith('audio/')
          ? file.name.match(/_(\d+)s_/)?.[1] || null
          : '',
        message_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
        status: 'sending',
        created_at: new Date().toISOString(),
        file_url: null,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        meeting_id: null,
        client_message_id: clientMessageId,
        is_read: false,
      };
      setMessages((prev) => [...prev, tempMessage]);

      // 1. Upload file
      const { error: uploadError } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .getPublicUrl(filePath);

      // 3. Save message record
      let content = "";
      if (file.type.startsWith('audio/')) {
        // Try to parse duration from name (AudioRecorder format: audio_12s_...)
        const match = file.name.match(/_(\d+)s_/);
        if (match) content = match[1];
      }

      const { data: msgId, error: sendError } = await supabase.rpc('send_message_v2', {
        p_conversation_id: conversationId,
        p_content: content,
        p_message_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file',
        p_file_url: publicUrl,
        p_file_name: file.name,
        p_file_size: file.size,
        p_mime_type: file.type || null,
        p_client_message_id: clientMessageId,
      });

      if (sendError) throw sendError;
      persistedMessageId = msgId as string;
      setUploadProgress(100);

      const { data: fullMsg } = await supabase
        .from('messages')
        .select('*, sender:profiles(full_name, avatar_url, role), meeting:meetings(*)')
        .eq('id', msgId)
        .maybeSingle();
      if (fullMsg) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId || message.client_message_id === clientMessageId
              ? (fullMsg as Message)
              : message
          )
        );
      }
    } catch (err: any) {
      console.error('sendMedia failed:', err);
      if (uploadedFilePath && !persistedMessageId) {
        await supabase.storage.from(CHAT_MEDIA_BUCKET).remove([uploadedFilePath]).catch(() => undefined);
      }
      if (tempId || clientMessageId) {
        setMessages((prev) =>
          prev.filter(
            (message) =>
              message.id !== tempId && message.client_message_id !== clientMessageId
          )
        );
      }
      toast.error(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTimeout(() => setUploadProgress(null), 500);
    }
  };

  // ── 6. Create Conversation ─────────────────────────────────────────────
  const createConversation = async (participantIds: string[], title?: string, clientId?: string, contextType?: string, contextId?: string) => {
    if (!profile) return;
    try {
      const { data: convId, error } = await supabase.rpc('upsert_conversation_v1', {
        p_participant_ids: Array.from(new Set([...participantIds, profile.id])),
        p_title: title || null,
        p_client_id: clientId || null,
        p_context_type: contextType || null,
        p_context_id: contextId || null
      });
      if (error) throw error;
      
      // Force immediate fetch of conversations to show it in sidebar
      const invokeFetch = async () => {
        const { data: participationData } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('profile_id', profile.id);
        const convIds = (participationData || []).map(p => p.conversation_id);
        if (convIds.length > 0) {
          const { data: convData } = await supabase
            .from('conversations')
            .select('*, participants:conversation_participants(profile_id, profile:profiles(full_name, avatar_url, role, last_seen_at))')
            .in('id', convIds)
            .order('updated_at', { ascending: false });
          if (convData) setConversations(convData as any);
        }
      };
      invokeFetch();

      return convId;
    } catch (err: any) {
      console.error('createConversation failed:', err);
      toast.error('Failed to start conversation');
    }
  };

  // ── 7. Delete Conversation ─────────────────────────────────────────────
  const deleteConversation = async (id: string) => {
    try {
      const { error } = await supabase.rpc('delete_conversation_v1', {
        p_conversation_id: id
      });
      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== id));
      toast.success('Conversation deleted');
      return true;
    } catch (err: any) {
      console.error('deleteConversation failed:', err);
      toast.error('Failed to delete conversation');
      return false;
    }
  };

  // ── 8. Delete Message ──────────────────────────────────────────────────
  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.rpc('delete_message_v1', {
        p_message_id: messageId
      });
      if (error) throw error;
      
      setMessages(prev => prev.filter(m => m.id !== messageId));
      
      // Also update conversations list if it was the last message
      setConversations(prev => prev.map(c => {
        if (c.last_message?.id === messageId) {
          return { ...c, last_message: undefined }; // UI will show "No messages yet" or we could fetch the new last one
        }
        return c;
      }));
      
      return true;
    } catch (err: any) {
      console.error('deleteMessage failed:', err);
      toast.error(err.message || 'Failed to delete message');
      return false;
    }
  };
  
  const deleteMessages = async (messageIds: string[]) => {
    try {
      const { error } = await supabase.rpc('delete_messages_v1', {
        p_message_ids: messageIds
      });
      if (error) throw error;
      setMessages(prev => prev.filter(m => !messageIds.includes(m.id)));
      toast.success(`${messageIds.length} messages deleted`);
      return true;
    } catch (err: any) {
      console.error('deleteMessages failed:', err);
      toast.error('Failed to delete messages');
      return false;
    }
  };

  return {
    conversations,
    messages,
    isLoading,
    typingUsers,
    uploadProgress,
    sendMessage,
    sendMedia,
    broadcastTyping,
    createConversation,
    deleteConversation,
    deleteMessage,
    deleteMessages,
    startCallSession: async (
      pConversationId?: string,
      callType: 'one_to_one' | 'group' = 'one_to_one'
    ) => {
      const targetConvId = pConversationId || conversationId;
      if (!profile || !targetConvId) return;

      try {
        return await startRtcSession({
          conversationId: targetConvId,
          sessionClass: 'call',
          mediaMode: 'audio',
          callType,
          metadata: {
            source: 'chat',
            platform: 'web',
          },
        });
      } catch (err: any) {
        console.error('startCallSession failed:', err);
        toast.error(err.message || 'Failed to start voice call');
      }
    },
    startStructuredMeetingSession: async (
      pConversationId?: string,
      options?: {
        title?: string;
        scheduledStartAt?: string | null;
      }
    ) => {
      const targetConvId = pConversationId || conversationId;
      if (!profile || !targetConvId) return;

      try {
        return await startRtcSession({
          conversationId: targetConvId,
          sessionClass: 'meeting',
          mediaMode: 'video',
          meetingType: options?.scheduledStartAt ? 'scheduled' : 'instant',
          title: options?.title || null,
          scheduledStartAt: options?.scheduledStartAt || null,
          metadata: {
            source: 'chat',
            platform: 'web',
          },
        });
      } catch (err: any) {
        console.error('startStructuredMeetingSession failed:', err);
        toast.error(err.message || 'Failed to start structured meeting');
      }
    },
    startMeeting: async (pConversationId?: string, isAudioOnly: boolean = false) => {
      const targetConvId = pConversationId || conversationId;
      if (!profile || !targetConvId) return;
      try {
        // Atomic start or join active meeting (Fixes the race condition)
        const { data: meetings, error: rpcError } = await supabase.rpc('start_or_get_active_meeting', {
          p_conversation_id: targetConvId,
          p_creator_id: profile.id,
          p_is_audio_only: isAudioOnly
        });

        if (rpcError) throw rpcError;
        
        // Grab the single meeting from the returned table
        const meeting = Array.isArray(meetings) ? meetings[0] : (meetings as any);
        if (!meeting) throw new Error("Could not start or join meeting");

        console.log('[Meeting] Atomic sync successful:', meeting.id);

        // 3. Send individual meeting invitations to each participant's 1:1 chat
        // First, get the participants of the target conversation
        supabase
          .from('conversation_participants')
          .select('profile_id')
          .eq('conversation_id', targetConvId)
          .then(async ({ data: participants }) => {
            if (!participants) return;
            
            for (const p of participants) {
              if (p.profile_id === profile.id) continue;
              
              // Get or create 1:1 chat
              const { data: convId } = await supabase.rpc('upsert_conversation_v1', {
                p_participant_ids: [profile.id, p.profile_id]
              });
              
              if (convId) {
                const { error } = await supabase.rpc('send_message_v2', {
                  p_conversation_id: convId,
                  p_content: isAudioOnly ? 'Voice Call Invitation' : 'Meeting Invitation',
                  p_message_type: 'meeting',
                  p_meeting_id: meeting.id
                });
                
                if (error) {
                  // Fallback
                  await supabase.rpc('send_message_v2', {
                    p_conversation_id: convId,
                    p_content: isAudioOnly ? 'Voice Call Invitation' : 'Meeting Invitation',
                    p_message_type: 'text'
                  });
                }
              }
            }
            
            // Broadcast for zero-latency join to the meeting conversation
            supabase.channel(`chat:${targetConvId}`).send({
              type: 'broadcast',
              event: 'new_meeting',
              payload: { conversation_id: targetConvId, meeting_id: meeting.id }
            });
          });
        
        // 4. Send OS-level push notifications to all participants (fire-and-forget)
        console.log('[Push] Triggering call notification API...', { meeting_id: meeting.id, caller_id: profile.id });
        fetch('/api/send-call-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meeting_id: meeting.id,
            caller_id: profile.id,
            caller_name: profile.full_name || 'Someone',
            is_audio_only: isAudioOnly,
            conversation_id: targetConvId,
          }),
        })
        .then(res => res.json())
        .then(data => console.log('[Push] API Response:', data))
        .catch(err => {
          console.error('[Push] API Call failed:', err);
        });

        return meeting;
      } catch (err: any) {
        console.error('startMeeting failed:', err);
        toast.error(err.message || 'Failed to start meeting');
      }
    }
  };
}
