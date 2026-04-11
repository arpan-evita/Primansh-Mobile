import { useCallback, useEffect, useState } from 'react';

import { useMobileSession } from '../context/MobileSessionContext';
import { supabase } from '../lib/supabase';

export type MobileNotification = {
  id: string;
  profile_id: string;
  title: string;
  message: string;
  type: 'task' | 'lead' | 'message' | 'system';
  metadata: Record<string, any> | null;
  read: boolean;
  created_at: string;
};

export function useMobileNotifications(limit = 20) {
  const { profile } = useMobileSession();
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(
    async (showLoader = true) => {
      if (!profile?.id) {
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setNotifications((data || []) as MobileNotification[]);
      } catch (error) {
        console.error('[MobileNotifications] fetch failed', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit, profile?.id]
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
      );
    } catch (error) {
      console.error('[MobileNotifications] markAsRead failed', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('profile_id', profile.id)
        .eq('read', false);

      if (error) throw error;
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error('[MobileNotifications] markAllAsRead failed', error);
    }
  }, [profile?.id]);

  useEffect(() => {
    void fetchNotifications(true);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`public:notifications:profile_id=eq.${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${profile.id}`,
        },
        () => {
          void fetchNotifications(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, profile?.id]);

  return {
    notifications,
    loading,
    refreshing,
    unreadCount: notifications.filter((item) => !item.read).length,
    refresh: () => fetchNotifications(false),
    markAsRead,
    markAllAsRead,
  };
}
