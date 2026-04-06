import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PresenceState {
  userId: string;
  onlineAt: string;
  status: 'online' | 'away';
}

export function usePresence() {
  const { profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState>>({});

  useEffect(() => {
    if (!profile) return;

    // 1. Initial heartbeat
    const updateLastSeen = async () => {
      await supabase.rpc('update_last_seen', { p_user_id: profile.id });
    };
    updateLastSeen();

    // 2. Heartbeat interval (every 30 seconds)
    const interval = setInterval(updateLastSeen, 30 * 1000);

    // 3. Realtime Presence
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const simplified: Record<string, PresenceState> = {};
        
        Object.entries(state).forEach(([key, value]) => {
          const presence = (value as any)[0];
          if (presence) {
            simplified[key] = {
              userId: key,
              onlineAt: presence.online_at,
              status: 'online',
            };
          }
        });
        setOnlineUsers(simplified);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const isOnline = useCallback((userId: string) => {
    return !!onlineUsers[userId];
  }, [onlineUsers]);

  return { onlineUsers, isOnline };
}
