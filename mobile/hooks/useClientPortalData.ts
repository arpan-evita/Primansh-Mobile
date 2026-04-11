import { useCallback, useEffect, useMemo, useState } from 'react';

import { useMobileSession } from '../context/MobileSessionContext';
import { listAccessibleMeetings, type MobileMeeting } from '../lib/meetings';
import { supabase } from '../lib/supabase';
import { useMobileClients } from './useMobileClients';
import { useMobileNotifications } from './useMobileNotifications';
import type { ClientDetailSnapshot } from '../lib/clients';

export type ClientPortalDocument = {
  id: string;
  name: string;
  type: string;
  client_id: string;
  visibility: string;
  file_path: string;
  size: number;
  secure: boolean;
  mime_type?: string | null;
  created_at: string;
};

export function useClientPortalData() {
  const { profile } = useMobileSession();
  const { getClientDetails } = useMobileClients();
  const notifications = useMobileNotifications(12);
  const [detail, setDetail] = useState<ClientDetailSnapshot | null>(null);
  const [documents, setDocuments] = useState<ClientPortalDocument[]>([]);
  const [meetings, setMeetings] = useState<MobileMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const clientId = profile?.normalizedRole === 'client' ? profile.associated_client_id || null : null;

  const refresh = useCallback(
    async (showLoader = true) => {
      if (!clientId || !profile) {
        setDetail(null);
        setDocuments([]);
        setMeetings([]);
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
        const [nextDetail, documentsResult, meetingData] = await Promise.all([
          getClientDetails(clientId, true),
          supabase
            .from('client_documents')
            .select('id, name, type, client_id, visibility, file_path, size, secure, mime_type, created_at')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(40),
          listAccessibleMeetings(profile),
        ]);

        if (documentsResult.error) throw documentsResult.error;

        setDetail(nextDetail);
        setDocuments((documentsResult.data || []) as ClientPortalDocument[]);
        setMeetings(
          meetingData.filter(
            (meeting) =>
              meeting.status === 'active' ||
              (meeting.start_time && new Date(meeting.start_time).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 30)
          )
        );
      } catch (error) {
        console.error('[ClientPortal] refresh failed', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clientId, getClientDetails, profile]
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!clientId || !profile?.id) return;

    const channel = supabase
      .channel(`mobile-client-portal:${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `client_id=eq.${clientId}` },
        () => {
          void refresh(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `client_id=eq.${clientId}` },
        () => {
          void refresh(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_documents', filter: `client_id=eq.${clientId}` },
        () => {
          void refresh(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_analytics', filter: `client_id=eq.${clientId}` },
        () => {
          void refresh(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        () => {
          void refresh(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, profile?.id, refresh]);

  const summary = useMemo(() => {
    const tasks = detail?.tasks || [];
    const invoices = detail?.invoices || [];
    const analytics = detail?.siteAnalytics || [];

    const pendingInvoices = invoices.filter((invoice: any) => invoice.status !== 'paid');
    const upcomingMeetings = meetings.filter((meeting) => {
      if (!meeting.start_time) return meeting.status === 'active';
      return new Date(meeting.start_time).getTime() >= Date.now() - 1000 * 60 * 60;
    });

    return {
      activeTasks: tasks.filter((task: any) => task.status !== 'done').length,
      completedTasks: tasks.filter((task: any) => task.status === 'done').length,
      pendingInvoices: pendingInvoices.length,
      unreadNotifications: notifications.unreadCount,
      upcomingMeetings: upcomingMeetings.length,
      documentCount: documents.length,
      last30DayViews: analytics.length,
    };
  }, [detail?.invoices, detail?.siteAnalytics, detail?.tasks, documents.length, meetings, notifications.unreadCount]);

  return {
    profile,
    clientId,
    detail,
    documents,
    meetings,
    loading,
    refreshing,
    summary,
    notifications: notifications.notifications,
    unreadNotifications: notifications.unreadCount,
    notificationsLoading: notifications.loading,
    markNotificationRead: notifications.markAsRead,
    markAllNotificationsRead: notifications.markAllAsRead,
    refresh: () => Promise.all([refresh(false), notifications.refresh()]),
  };
}
