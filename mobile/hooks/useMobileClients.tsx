import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentMobileProfile, type MobileProfile } from '../lib/meetings';
import { supabase } from '../lib/supabase';
import {
  CLIENT_PAGE_SIZE,
  type ClientDetailSnapshot,
  type ClientEventType,
  type ClientFormInput,
  type MobileClient,
  type TeamMemberSummary,
  buildClientSlug,
  canCreateClient,
  canDeleteClient,
  canEditClientCore,
  canEditClientNotes,
  canEditClientStatus,
  canViewClient,
  emptyClientForm,
  isRetriableClientError,
  mapClientRow,
  mergeClientCollections,
  sortClients,
} from '../lib/clients';

type QueueItem =
  | { id: string; type: 'create'; tempId: string; payload: ClientFormInput; optimistic: MobileClient; createdAt: string }
  | { id: string; type: 'update'; clientId: string; patch: Partial<ClientFormInput>; createdAt: string }
  | { id: string; type: 'delete'; clientId: string; backup?: MobileClient | null; createdAt: string };

type CacheShape = {
  clients: MobileClient[];
  detailCache?: Record<string, ClientDetailSnapshot>;
  lastSyncedAt?: string | null;
};

type ClientContextValue = {
  profile: MobileProfile | null;
  clients: MobileClient[];
  teamMembers: TeamMemberSummary[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  flushingQueue: boolean;
  pendingQueueCount: number;
  lastSyncedAt: string | null;
  realtimeState: string;
  lastEvent: { type: ClientEventType; clientId: string } | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  retryPendingQueue: () => Promise<void>;
  getClientDetails: (clientId: string, force?: boolean) => Promise<ClientDetailSnapshot | null>;
  createClient: (input: ClientFormInput) => Promise<{ ok: boolean; queued?: boolean; clientId?: string | null }>;
  updateClient: (clientId: string, patch: Partial<Omit<ClientFormInput, 'password'>>) => Promise<{ ok: boolean; queued?: boolean }>;
  updateClientStatus: (clientId: string, status: 'active' | 'inactive' | 'trial') => Promise<{ ok: boolean; queued?: boolean }>;
  updateClientNotes: (clientId: string, notes: string) => Promise<{ ok: boolean; queued?: boolean }>;
  assignClient: (clientId: string, teamMemberId: string | null) => Promise<{ ok: boolean; queued?: boolean }>;
  deleteClient: (clientId: string) => Promise<{ ok: boolean; queued?: boolean }>;
  permissions: {
    canCreateClient: boolean;
    canDeleteClient: boolean;
    canViewClient: (client: MobileClient) => boolean;
    canEditClientCore: (client?: MobileClient | null) => boolean;
    canEditClientNotes: (client?: MobileClient | null) => boolean;
    canEditClientStatus: (client?: MobileClient | null) => boolean;
  };
};

const CLIENT_CACHE_KEY = 'primansh_mobile_clients_cache_v1';
const CLIENT_QUEUE_KEY = 'primansh_mobile_clients_queue_v1';

const MobileClientsContext = createContext<ClientContextValue | undefined>(undefined);

function storageKey(baseKey: string, ownerId: string | null) {
  return ownerId ? `${baseKey}:${ownerId}` : baseKey;
}

function asTeamMember(value: any): TeamMemberSummary | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as TeamMemberSummary) || null;
  return value as TeamMemberSummary;
}

function teamMap(members: TeamMemberSummary[]) {
  return members.reduce<Record<string, TeamMemberSummary>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

function hydrateRows(rows: any[], assignments: Record<string, TeamMemberSummary[]>, members: TeamMemberSummary[]) {
  const memberMap = teamMap(members);
  return rows.map((row: any) => {
    const primary = row.assigned_team_member_id ? memberMap[row.assigned_team_member_id] : null;
    return mapClientRow(row, assignments[row.id] || (primary ? [primary] : []));
  });
}

async function fetchPage(offset: number, limit: number) {
  try {
    const { data, error } = await supabase
      .from('client_health_overview')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // 42703: undefined_column, 42P01: undefined_table
      if (error.code === '42703' || error.code === '42P01') {
        console.warn('[MobileClients] View column issue, falling back to base table');
        // Select only the most basic columns that are guaranteed to exist in the underlying table
        const fallback = await supabase
          .from('clients')
          .select('id, firm_name, contact_name, contact_email, contact_phone, location, website_url, plan_type, status, health_score, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (fallback.error) throw fallback.error;
        return (fallback.data || []) as any[];
      }
      throw error;
    }
    return (data || []) as any[];
  } catch (err) {
    console.error('[MobileClients] fetchPage critical error', err);
    throw err;
  }
}

async function fetchClient(clientId: string) {
  try {
    const { data, error } = await supabase
      .from('client_health_overview')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) {
      if (error.code === '42703' || error.code === '42P01') {
        const fallback = await supabase
          .from('clients')
          .select('id, firm_name, contact_name, contact_email, contact_phone, location, website_url, plan_type, status, health_score, created_at, updated_at')
          .eq('id', clientId)
          .single();
        if (fallback.error) throw fallback.error;
        return fallback.data as any;
      }
      throw error;
    }
    return data as any;
  } catch (err) {
    console.error('[MobileClients] fetchClient critical error', err);
    throw err;
  }
}

async function fetchMembers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, email')
    .in('role', ['admin', 'team', 'seo', 'content', 'developer'])
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data || []) as TeamMemberSummary[];
}

async function fetchAssignments(clientIds: string[]) {
  if (clientIds.length === 0) return {} as Record<string, TeamMemberSummary[]>;
  const { data, error } = await supabase
    .from('team_assigned_clients')
    .select('client_id, team_member_id, team_member:profiles(id, full_name, avatar_url, role, email)')
    .in('client_id', clientIds);
  if (error) throw error;
  return (data || []).reduce<Record<string, TeamMemberSummary[]>>((acc, row: any) => {
    const member = asTeamMember(row.team_member);
    if (!member) return acc;
    if (!acc[row.client_id]) acc[row.client_id] = [];
    if (!acc[row.client_id].some((item) => item.id === member.id)) acc[row.client_id].push(member);
    return acc;
  }, {});
}

function buildUpdates(snapshot: { client: MobileClient; tasks: any[]; leads: any[]; invoices: any[]; keywords: any[] }) {
  const items: ClientDetailSnapshot['updates'] = [];
  if (snapshot.client.notes) {
    items.push({
      id: `note-${snapshot.client.id}`,
      type: 'note',
      title: 'Client note updated',
      description: snapshot.client.notes,
      created_at: snapshot.client.updated_at,
    });
  }
  snapshot.tasks.slice(0, 8).forEach((task) => items.push({
    id: `task-${task.id}`,
    type: 'task',
    title: task.title || 'Task update',
    description: task.description || task.module || null,
    created_at: task.updated_at || task.created_at || new Date().toISOString(),
    status: task.status || null,
  }));
  snapshot.leads.slice(0, 6).forEach((lead) => items.push({
    id: `lead-${lead.id}`,
    type: 'lead',
    title: lead.name || 'Lead update',
    description: lead.notes || lead.source || null,
    created_at: lead.created_at || new Date().toISOString(),
    status: lead.status || null,
  }));
  snapshot.invoices.slice(0, 6).forEach((invoice) => items.push({
    id: `invoice-${invoice.id}`,
    type: 'invoice',
    title: invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : 'Invoice update',
    description: invoice.notes || `${invoice.status || 'pending'} invoice`,
    created_at: invoice.issued_date || invoice.created_at || new Date().toISOString(),
    status: invoice.status || null,
  }));
  snapshot.keywords.slice(0, 6).forEach((keyword) => items.push({
    id: `keyword-${keyword.id}`,
    type: 'seo',
    title: keyword.keyword || 'Keyword update',
    description: keyword.current_pos ? `Current position #${keyword.current_pos}` : keyword.trend || null,
    created_at: keyword.last_checked || keyword.created_at || new Date().toISOString(),
    status: keyword.trend || null,
  }));
  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

async function safeQuery(baseQuery: any, fallbackOrderCol: string = 'created_at') {
  const { data, error } = await baseQuery;
  if (error && (error.code === '42703' || error.code === '42P01')) {
    console.warn(`[MobileClients] Query failed with ${error.code}, attempting fallback without failing columns`);
    // Attempt to rebuild the query by stripping ordering if the order column was the one missing
    // Since we can't easily introspect the query builder, we just return empty as a safe fallback
    // to prevent the entire dashboard from crashing.
    return { data: [], error: null };
  }
  return { data: data || [], error };
}

async function buildDetail(clientId: string) {
  const [clientRow, members, tasksRes, leadsRes, keywordsRes, invoicesRes, analyticsRes, conversationsRes, assignmentsRes] = await Promise.all([
    fetchClient(clientId),
    fetchMembers(),
    supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('leads').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('keywords').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('site_analytics').select('*').eq('client_id', clientId).order('timestamp', { ascending: false }).limit(100),
    supabase.from('conversations').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(10),
    (async () => {
      try {
        return await supabase
          .from('team_assigned_clients')
          .select('client_id, team_member_id, team_member:profiles(id, full_name, avatar_url, role, email)')
          .eq('client_id', clientId);
      } catch {
        return { data: [], error: null };
      }
    })(),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (leadsRes.error) throw leadsRes.error;
  if (keywordsRes.error) throw keywordsRes.error;
  if (invoicesRes.error) throw invoicesRes.error;
  if (analyticsRes.error) throw analyticsRes.error;
  if (conversationsRes.error) throw conversationsRes.error;
  const assignments = (assignmentsRes.data || []).reduce<Record<string, TeamMemberSummary[]>>((acc, row: any) => {
    const member = asTeamMember(row.team_member);
    if (!member) return acc;
    if (!acc[row.client_id]) acc[row.client_id] = [];
    if (!acc[row.client_id].some((item) => item.id === member.id)) acc[row.client_id].push(member);
    return acc;
  }, {});

  const client = mapClientRow(clientRow as any, assignments[clientId] || []);
  const tasks = (tasksRes.data || []) as any[];
  const leads = (leadsRes.data || []) as any[];
  const keywords = (keywordsRes.data || []) as any[];
  const invoices = (invoicesRes.data || []) as any[];
  const siteAnalytics = (analyticsRes.data || []) as any[];
  const conversations = (conversationsRes.data || []) as any[];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const messagesRes = conversationIds.length
    ? await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, message_type, file_url, file_name, file_size, mime_type, meeting_id, created_at, is_read, status, sender:profiles(full_name, avatar_url, role)')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(40)
    : { data: [], error: null };

  if (messagesRes.error) throw messagesRes.error;
  const messages = (messagesRes.data || []) as any[];

  const metrics = {
    tasks: tasks.length,
    openTasks: tasks.filter((task) => task.status !== 'done').length,
    leads: leads.length,
    invoices: invoices.length,
    overdueInvoices: invoices.filter((invoice) => invoice.status === 'overdue').length,
    keywords: keywords.length,
    siteViews: siteAnalytics.length,
    messages: messages.length,
  };

  return {
    client: { ...client, keyMetrics: metrics },
    teamMembers: assignments[clientId] || [],
    tasks,
    leads,
    keywords,
    invoices,
    siteAnalytics,
    messages,
    updates: buildUpdates({ client, tasks, leads, invoices, keywords }),
    metrics,
    fetchedAt: new Date().toISOString(),
  } satisfies ClientDetailSnapshot;
}

function resolveAssignedTeamMemberIds(input: Partial<ClientFormInput>) {
  const ids = new Set<string>();
  (Array.isArray(input.assigned_team_member_ids) ? input.assigned_team_member_ids : []).forEach((id) => {
    if (id) ids.add(id);
  });
  if (input.assigned_team_member_id) {
    ids.add(input.assigned_team_member_id);
  }
  return Array.from(ids);
}

function getCurrentAssignedTeamMemberIds(client: MobileClient) {
  const ids = new Set<string>();
  if (client.assigned_team_member_id) ids.add(client.assigned_team_member_id);
  (client.assigned_team_members || []).forEach((member) => {
    if (member?.id) ids.add(member.id);
  });
  return Array.from(ids);
}

function stripClientWriteFields(input: Partial<ClientFormInput>) {
  const { password, assigned_team_member_ids, ...rest } = input as Partial<ClientFormInput> & {
    assigned_team_member_ids?: string[];
    password?: string;
  };
  void password;
  void assigned_team_member_ids;
  return rest;
}

export function MobileClientsProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [clients, setClients] = useState<MobileClient[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberSummary[]>([]);
  const [detailCache, setDetailCache] = useState<Record<string, ClientDetailSnapshot>>({});
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [flushingQueue, setFlushingQueue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState('idle');
  const [lastEvent, setLastEvent] = useState<{ type: ClientEventType; clientId: string } | null>(null);

  const clientsRef = useRef<MobileClient[]>([]);
  const teamMembersRef = useRef<TeamMemberSummary[]>([]);
  const detailCacheRef = useRef<Record<string, ClientDetailSnapshot>>({});
  const queueRef = useRef<QueueItem[]>([]);
  const loadedCountRef = useRef(0);
  const flushingRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const storageOwnerIdRef = useRef<string | null>(null);
  const hydratingRef = useRef(false);

  useEffect(() => { clientsRef.current = clients; }, [clients]);
  useEffect(() => { teamMembersRef.current = teamMembers; }, [teamMembers]);
  useEffect(() => { detailCacheRef.current = detailCache; }, [detailCache]);
  useEffect(() => { queueRef.current = pendingQueue; }, [pendingQueue]);

  const resetClientState = useCallback(() => {
    setProfile(null);
    setClients([]);
    setTeamMembers([]);
    setDetailCache({});
    setPendingQueue([]);
    setHasMore(true);
    setLoadingMore(false);
    setRefreshing(false);
    setFlushingQueue(false);
    setLastSyncedAt(null);
    setRealtimeState('idle');
    setLastEvent(null);
    loadedCountRef.current = 0;
    storageOwnerIdRef.current = null;
  }, []);

  const persist = useCallback(async () => {
    if (hydratingRef.current) return;

    const ownerId = storageOwnerIdRef.current;
    if (!ownerId) return;

    const snapshot: CacheShape = {
      clients: clientsRef.current,
      detailCache: detailCacheRef.current,
      lastSyncedAt,
    };
    await Promise.all([
      AsyncStorage.setItem(storageKey(CLIENT_CACHE_KEY, ownerId), JSON.stringify(snapshot)),
      AsyncStorage.setItem(storageKey(CLIENT_QUEUE_KEY, ownerId), JSON.stringify(queueRef.current)),
    ]);
  }, [lastSyncedAt]);

  useEffect(() => { void persist(); }, [clients, detailCache, lastSyncedAt, pendingQueue, persist]);

  const loadCache = useCallback(async () => {
    try {
      hydratingRef.current = true;
      const { data: { session } } = await supabase.auth.getSession();
      const ownerId = session?.user?.id ?? null;
      const previousOwnerId = storageOwnerIdRef.current;

      if (previousOwnerId && previousOwnerId !== ownerId) {
        resetClientState();
      }

      storageOwnerIdRef.current = ownerId;

      if (!ownerId) {
        resetClientState();
        return;
      }

      const [cacheValue, queueValue] = await Promise.all([
        AsyncStorage.getItem(storageKey(CLIENT_CACHE_KEY, ownerId)),
        AsyncStorage.getItem(storageKey(CLIENT_QUEUE_KEY, ownerId)),
      ]);

      if (cacheValue) {
        const cache = JSON.parse(cacheValue) as CacheShape;
        setClients(cache.clients || []);
        setDetailCache(cache.detailCache || {});
        loadedCountRef.current = (cache.clients || []).length;
        setLastSyncedAt(cache.lastSyncedAt || null);
      }

      if (queueValue) setPendingQueue(JSON.parse(queueValue) as QueueItem[]);
    } catch (error) {
      console.error('[MobileClients] loadCache failed', error);
    } finally {
      hydratingRef.current = false;
    }
  }, [resetClientState]);

  const applyQueue = useCallback((base: MobileClient[], queue: QueueItem[], members: TeamMemberSummary[], current: MobileProfile | null) => {
    const memberMap = teamMap(members);
    let next = [...base];

    for (const item of queue) {
      if (item.type === 'create' && !next.some((client) => client.id === item.tempId)) {
        next = sortClients([item.optimistic, ...next]);
      }

      if (item.type === 'update') {
        const selectedIds = Array.isArray((item.patch as any).assigned_team_member_ids)
          ? ((item.patch as any).assigned_team_member_ids as string[])
          : item.patch.assigned_team_member_id
            ? [item.patch.assigned_team_member_id]
            : null;

        next = next.map((client) =>
          client.id === item.clientId
            ? {
                ...client,
                ...item.patch,
                name: item.patch.contact_name || item.patch.firm_name || client.name,
                status: (item.patch.status as any) || client.status,
                plan_type: (item.patch.plan_type as any) || client.plan_type,
                updated_at: new Date().toISOString(),
                syncState: 'pending',
                assigned_team_members: selectedIds
                  ? selectedIds.map((id) => memberMap[id]).filter(Boolean) as TeamMemberSummary[]
                  : client.assigned_team_members,
              }
            : client
        );
      }

      if (item.type === 'delete') {
        next = next.filter((client) => client.id !== item.clientId);
      }
    }

    if (current) next = next.filter((client) => canViewClient(current, client));
    return sortClients(next);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCache();

      const { data: { session } } = await supabase.auth.getSession();
      const sessionUserId = session?.user?.id ?? null;
      let current = profile;

      if (!sessionUserId) {
        current = null;
      } else if (!current || current.id !== sessionUserId) {
        current = await getCurrentMobileProfile().catch(() => null);
      }

      if (!current) {
        if (!sessionUserId) {
          resetClientState();
        }
        setLoading(false);
        return;
      }

      setProfile(current);

      const [members, rows] = await Promise.all([fetchMembers(), fetchPage(0, CLIENT_PAGE_SIZE)]);
      let assignments: Record<string, TeamMemberSummary[]> = {};
      try { assignments = await fetchAssignments(rows.map((row) => row.id)); } catch {}

      const hydrated = hydrateRows(rows, assignments, members);
      loadedCountRef.current = hydrated.length;
      setHasMore(hydrated.length === CLIENT_PAGE_SIZE);
      setTeamMembers(members);
      setClients((currentClients) => applyQueue(sortClients(hydrated), queueRef.current, members, current));
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error('[MobileClients] refresh failed', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      await persist();
    }
  }, [applyQueue, loadCache, persist, profile, resetClientState]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(loadedCountRef.current, CLIENT_PAGE_SIZE);
      let assignments: Record<string, TeamMemberSummary[]> = {};
      try { assignments = await fetchAssignments(rows.map((row) => row.id)); } catch {}

      const hydrated = hydrateRows(rows, assignments, teamMembersRef.current);
      loadedCountRef.current += hydrated.length;
      setHasMore(hydrated.length === CLIENT_PAGE_SIZE);
      setClients((currentClients) => applyQueue(mergeClientCollections(currentClients, hydrated), queueRef.current, teamMembersRef.current, profile));
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error('[MobileClients] loadMore failed', error);
    } finally {
      setLoadingMore(false);
      await persist();
    }
  }, [applyQueue, hasMore, loadingMore, persist, profile]);

  const removeClientFromState = useCallback((clientId: string) => {
    setClients((current) => current.filter((client) => client.id !== clientId));
    setDetailCache((current) => {
      if (!current[clientId]) return current;
      const next = { ...current };
      delete next[clientId];
      return next;
    });
  }, []);

  const replaceClientInState = useCallback((previousId: string, nextClient: MobileClient) => {
    setClients((current) => sortClients(current.map((client) => (client.id === previousId ? nextClient : client))));
    setDetailCache((current) => {
      const next = { ...current };
      if (next[previousId]) {
        next[nextClient.id] = {
          ...next[previousId],
          client: nextClient,
          teamMembers: next[nextClient.id]?.teamMembers || next[previousId].teamMembers,
        };
        if (previousId !== nextClient.id) {
          delete next[previousId];
        }
      }
      return next;
    });
    setPendingQueue((current) =>
      current.map((item) => {
        if (item.type === 'create' && item.tempId === previousId) {
          return { ...item, tempId: nextClient.id } as QueueItem;
        }
        if ('clientId' in item && item.clientId === previousId) {
          return { ...item, clientId: nextClient.id } as QueueItem;
        }
        return item;
      })
    );
  }, []);

  const syncAssignments = useCallback(async (clientId: string, memberIds: string[]) => {
    const selectedIds = Array.from(new Set(memberIds.filter(Boolean)));
    const { data: existingRows, error: existingError } = await supabase
      .from('team_assigned_clients')
      .select('team_member_id')
      .eq('client_id', clientId);

    if (existingError) throw existingError;

    const existingIds = ((existingRows || []) as any[]).map((row) => row.team_member_id).filter(Boolean);

    if (selectedIds.length === 0) {
      const { error: deleteError } = await supabase.from('team_assigned_clients').delete().eq('client_id', clientId);
      if (deleteError) throw deleteError;
      return;
    }

    const staleIds = existingIds.filter((id) => !selectedIds.includes(id));
    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('team_assigned_clients')
        .delete()
        .eq('client_id', clientId)
        .in('team_member_id', staleIds);
      if (deleteError) throw deleteError;
    }

    const rows = selectedIds.map((teamMemberId) => ({ client_id: clientId, team_member_id: teamMemberId }));
    const { error: upsertError } = await supabase.from('team_assigned_clients').upsert(rows, {
      onConflict: 'team_member_id,client_id',
    });
    if (upsertError) throw upsertError;
  }, []);

  const upsertClientFromServer = useCallback(
    async (clientId: string, eventType: ClientEventType) => {
      try {
        const [row, assignments] = await Promise.all([
          fetchClient(clientId),
          fetchAssignments([clientId]).catch(() => ({} as Record<string, TeamMemberSummary[]>)),
        ]);

        const nextClient = mapClientRow(row, assignments[clientId] || []);
        if (profile && !canViewClient(profile, nextClient)) {
          removeClientFromState(clientId);
          return null;
        }

        setClients((current) => mergeClientCollections(current.filter((client) => client.id !== clientId), [nextClient]));
        setDetailCache((current) => {
          if (!current[clientId]) return current;
          return {
            ...current,
            [clientId]: {
              ...current[clientId],
              client: nextClient,
              teamMembers: assignments[clientId] || current[clientId].teamMembers,
              fetchedAt: new Date().toISOString(),
            },
          };
        });
        setLastEvent({ type: eventType, clientId });
        setLastSyncedAt(new Date().toISOString());
        return nextClient;
      } catch (error) {
        console.error('[MobileClients] upsertClientFromServer failed', error);
        const existingClient = clientsRef.current.find((client) => client.id === clientId) || null;
        if (existingClient && isRetriableClientError(error)) {
          setClients((current) =>
            sortClients(
              current.map((client) =>
                client.id === clientId ? { ...client, syncState: 'error' } : client
              )
            )
          );
          return existingClient;
        }

        removeClientFromState(clientId);
        return null;
      }
    },
    [profile, removeClientFromState]
  );

  const persistDetailSnapshot = useCallback(
    (snapshot: ClientDetailSnapshot) => {
      setDetailCache((current) => ({ ...current, [snapshot.client.id]: snapshot }));
      setLastSyncedAt(new Date().toISOString());
    },
    []
  );

  const getClientDetails = useCallback(
    async (clientId: string, force = false) => {
      const cached = detailCacheRef.current[clientId];
      if (cached && !force) return cached;
      if (!force && cached && !profile) return cached;

      try {
        const snapshot = await buildDetail(clientId);
        if (profile && !canViewClient(profile, snapshot.client)) {
          return cached || null;
        }

        persistDetailSnapshot(snapshot);
        return snapshot;
      } catch (error) {
        console.error('[MobileClients] getClientDetails failed', error);
        return cached || null;
      }
    },
    [persistDetailSnapshot, profile]
  );

  const updateRemoteClient = useCallback(
    async (
      clientId: string,
      patch: Partial<ClientFormInput>,
      eventType: ClientEventType = 'client_updated'
    ): Promise<{ ok: boolean; queued?: boolean }> => {
      const currentClient = clientsRef.current.find((client) => client.id === clientId) || null;
      if (!currentClient) return { ok: false };

      const sanitizedPatch = stripClientWriteFields(patch);
      const hasAssignmentFields =
        Object.prototype.hasOwnProperty.call(patch, 'assigned_team_member_id') ||
        Object.prototype.hasOwnProperty.call(patch, 'assigned_team_member_ids');
      const selectedIds = hasAssignmentFields
        ? resolveAssignedTeamMemberIds(patch)
        : getCurrentAssignedTeamMemberIds(currentClient);
      const nextPrimaryId = selectedIds[0] || null;
      const optimisticClient: MobileClient = {
        ...currentClient,
        ...sanitizedPatch,
        firm_name: sanitizedPatch.firm_name ?? currentClient.firm_name,
        name: sanitizedPatch.contact_name || sanitizedPatch.firm_name || currentClient.name,
        plan_type: (sanitizedPatch.plan_type as any) || currentClient.plan_type,
        status: (sanitizedPatch.status as any) || currentClient.status,
        onboarding_date: sanitizedPatch.onboarding_date ?? currentClient.onboarding_date,
        notes: sanitizedPatch.notes ?? currentClient.notes,
        updated_at: new Date().toISOString(),
        syncState: 'pending',
        assigned_team_member_id: hasAssignmentFields ? nextPrimaryId : currentClient.assigned_team_member_id || null,
        assigned_team_members: selectedIds
          .map((id) => teamMembersRef.current.find((member) => member.id === id))
          .filter(Boolean) as TeamMemberSummary[],
      };

      setClients((current) => mergeClientCollections(current.filter((client) => client.id !== clientId), [optimisticClient]));
      setDetailCache((current) => {
        if (!current[clientId]) return current;
        return {
          ...current,
          [clientId]: {
            ...current[clientId],
            client: optimisticClient,
            fetchedAt: new Date().toISOString(),
          },
        };
      });

      try {
        const payload: Record<string, any> = {
          ...sanitizedPatch,
        };

        if (hasAssignmentFields) {
          payload.assigned_team_member_id = nextPrimaryId;
        }

        if (payload.firm_name || payload.contact_name || payload.slug) {
          payload.slug = payload.slug || buildClientSlug(payload.firm_name || payload.contact_name || currentClient.firm_name);
        }

        if (payload.onboarding_date === '') {
          payload.onboarding_date = null;
        }

        const { error } = await supabase.from('clients').update(payload).eq('id', clientId);
        if (error) throw error;

        if (hasAssignmentFields) {
          await syncAssignments(clientId, selectedIds);
        }

        const nextClient = await upsertClientFromServer(clientId, eventType);
        if (nextClient) {
          setClients((current) => sortClients(current.map((client) => (client.id === clientId ? { ...nextClient, syncState: 'synced' } : client))));
        }
        await persist();
        return { ok: true };
      } catch (error) {
        if (!isRetriableClientError(error)) {
          console.error('[MobileClients] updateRemoteClient failed', error);
          setClients((current) =>
            sortClients(
              current.map((client) =>
                client.id === clientId
                  ? { ...currentClient, syncState: 'error' }
                  : client
              )
            )
          );
          return { ok: false };
        }

        setPendingQueue((current) => [
          ...current,
          {
            id: `queue-${Date.now()}`,
            type: 'update',
            clientId,
            patch,
            createdAt: new Date().toISOString(),
          },
        ]);
        return { ok: true, queued: true };
      }
    },
    [persist, syncAssignments, upsertClientFromServer]
  );

  const createClient = useCallback(
    async (input: ClientFormInput) => {
      if (!profile || !canCreateClient(profile)) return { ok: false };

      const tempId = `temp-client-${Date.now()}`;
      const selectedIds = resolveAssignedTeamMemberIds(input);
      const nextPrimaryId = selectedIds[0] || null;
      const now = new Date().toISOString();
      const optimisticClient: MobileClient = {
        id: tempId,
        name: input.contact_name || input.firm_name || 'Client',
        firm_name: input.firm_name || 'Client',
        location: input.location || null,
        website_url: input.website_url || null,
        contact_name: input.contact_name || null,
        contact_email: input.contact_email || null,
        contact_phone: input.contact_phone || null,
        plan_type: input.plan_type,
        status: input.status,
        health_score: input.health_score,
        task_score: null,
        conversion_score: null,
        seo_score: null,
        billing_score: null,
        total_health_score: input.health_score,
        assigned_to: null,
        assigned_team_member_id: nextPrimaryId,
        assigned_team_members: selectedIds
          .map((id) => teamMembersRef.current.find((member) => member.id === id))
          .filter(Boolean) as TeamMemberSummary[],
        onboarding_date: input.onboarding_date || now.slice(0, 10),
        notes: input.notes || null,
        services: input.services || [],
        slug: buildClientSlug(input.firm_name || input.contact_name || 'client'),
        monthly_revenue: null,
        tracking_id: null,
        site_api_key: null,
        connected_at: null,
        created_at: now,
        updated_at: now,
        syncState: 'pending',
      };

      setClients((current) => mergeClientCollections([optimisticClient], current));

      const payload: Record<string, any> = {
        firm_name: input.firm_name?.trim() || input.contact_name?.trim() || 'Client',
        location: input.location?.trim() || null,
        website_url: input.website_url?.trim() || null,
        contact_name: input.contact_name?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        contact_phone: input.contact_phone?.trim() || null,
        plan_type: input.plan_type,
        status: input.status,
        health_score: Math.max(0, Math.min(100, Number(input.health_score) || 50)),
        assigned_team_member_id: nextPrimaryId,
        onboarding_date: input.onboarding_date || now.slice(0, 10),
        notes: input.notes?.trim() || null,
        services: (input.services || []).map((service) => service.trim()).filter(Boolean),
        slug: buildClientSlug(input.firm_name || input.contact_name || 'client'),
      };

      try {
        const { data: insertedRow, error } = await supabase
          .from('clients')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;

        const clientId = (insertedRow as any)?.id || tempId;
        await syncAssignments(clientId, selectedIds).catch(() => null);

        const nextClient = await upsertClientFromServer(clientId, 'client_created');
        if (!nextClient) {
          setClients((current) =>
            sortClients(current.map((client) => (client.id === tempId ? { ...optimisticClient, id: clientId, syncState: 'synced' } : client)))
          );
        } else {
          setClients((current) => sortClients(current.filter((client) => client.id !== tempId)));
        }

        if (input.password && input.contact_email && clientId) {
          try {
            const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
              body: {
                email: input.contact_email,
                password: input.password,
                full_name: input.contact_name || input.firm_name,
                role: 'client',
                associated_client_id: clientId,
              },
            });

            if (fnError) throw fnError;
            if ((fnData as any)?.error) throw new Error((fnData as any).error);
          } catch (accountError) {
            console.error('[MobileClients] create-user failed', accountError);
          }
        }

        setLastEvent({ type: 'client_created', clientId });
        setLastSyncedAt(new Date().toISOString());
        await persist();
        return { ok: true, clientId };
      } catch (error) {
        if (!isRetriableClientError(error)) {
          console.error('[MobileClients] createClient failed', error);
          setClients((current) =>
            sortClients(current.map((client) => (client.id === tempId ? { ...client, syncState: 'error' } : client)))
          );
          return { ok: false };
        }

        setPendingQueue((current) => [
          ...current,
          {
            id: `queue-${Date.now()}`,
            type: 'create',
            tempId,
            payload: input,
            optimistic: optimisticClient,
            createdAt: now,
          },
        ]);
        return { ok: true, queued: true, clientId: tempId };
      }
    },
    [persist, profile, syncAssignments, upsertClientFromServer]
  );

  const updateClient = useCallback(
    async (clientId: string, patch: Partial<Omit<ClientFormInput, 'password'>>) => {
      const currentClient = clientsRef.current.find((client) => client.id === clientId) || null;
      if (!currentClient) return { ok: false };

      if (!canEditClientCore(profile, currentClient)) {
        const filteredPatch: Partial<ClientFormInput> = {};
        if (canEditClientNotes(profile, currentClient) && patch.notes !== undefined) {
          filteredPatch.notes = patch.notes;
        }
        if (canEditClientStatus(profile, currentClient) && patch.status !== undefined) {
          filteredPatch.status = patch.status;
        }

        if (Object.keys(filteredPatch).length === 0) {
          return { ok: false };
        }

        return updateRemoteClient(clientId, filteredPatch);
      }

      const result = await updateRemoteClient(clientId, patch as Partial<ClientFormInput>);
      return result;
    },
    [profile, updateRemoteClient]
  );

  const updateClientStatus = useCallback(
    async (clientId: string, status: 'active' | 'inactive' | 'trial') => {
      const currentClient = clientsRef.current.find((client) => client.id === clientId) || null;
      if (!canEditClientStatus(profile, currentClient)) return { ok: false };
      return updateRemoteClient(clientId, { status });
    },
    [profile, updateRemoteClient]
  );

  const updateClientNotes = useCallback(
    async (clientId: string, notes: string) => {
      const currentClient = clientsRef.current.find((client) => client.id === clientId) || null;
      if (!canEditClientNotes(profile, currentClient)) return { ok: false };
      return updateRemoteClient(clientId, { notes });
    },
    [profile, updateRemoteClient]
  );

  const assignClient = useCallback(
    async (clientId: string, teamMemberId: string | null) => {
      const currentClient = clientsRef.current.find((client) => client.id === clientId) || null;
      if (!canEditClientCore(profile, currentClient)) return { ok: false };
      return updateRemoteClient(clientId, {
        assigned_team_member_id: teamMemberId,
        assigned_team_member_ids: teamMemberId ? [teamMemberId] : [],
      } as Partial<ClientFormInput>);
    },
    [profile, updateRemoteClient]
  );

  const deleteClient = useCallback(
    async (clientId: string) => {
      const currentClient = clientsRef.current.find((client) => client.id === clientId) || null;
      if (!currentClient || !canDeleteClient(profile)) return { ok: false };

      removeClientFromState(clientId);

      try {
        const { error } = await supabase.from('clients').delete().eq('id', clientId);
        if (error) throw error;

        await persist();
        setLastEvent({ type: 'client_deleted', clientId });
        return { ok: true };
      } catch (error) {
        if (!isRetriableClientError(error)) {
          console.error('[MobileClients] deleteClient failed', error);
          setClients((current) => mergeClientCollections(current, [currentClient]));
          return { ok: false };
        }

        setPendingQueue((current) => [
          ...current,
          {
            id: `queue-${Date.now()}`,
            type: 'delete',
            clientId,
            backup: currentClient,
            createdAt: new Date().toISOString(),
          },
        ]);
        return { ok: true, queued: true };
      }
    },
    [persist, profile, removeClientFromState]
  );

  const retryPendingQueue = useCallback(async () => {
    const currentProfile = profile || (await getCurrentMobileProfile().catch(() => null));
    if (flushingRef.current || !currentProfile || queueRef.current.length === 0) return;

    if (!profile) setProfile(currentProfile);

    flushingRef.current = true;
    setFlushingQueue(true);

    try {
      let nextQueue = [...queueRef.current];

      for (const item of queueRef.current) {
        try {
          if (item.type === 'create') {
            const payload = {
              firm_name: item.payload.firm_name?.trim() || item.payload.contact_name?.trim() || 'Client',
              location: item.payload.location?.trim() || null,
              website_url: item.payload.website_url?.trim() || null,
              contact_name: item.payload.contact_name?.trim() || null,
              contact_email: item.payload.contact_email?.trim() || null,
              contact_phone: item.payload.contact_phone?.trim() || null,
              plan_type: item.payload.plan_type,
              status: item.payload.status,
              health_score: Math.max(0, Math.min(100, Number(item.payload.health_score) || 50)),
              assigned_team_member_id: item.payload.assigned_team_member_id || null,
              onboarding_date: item.payload.onboarding_date || new Date().toISOString().slice(0, 10),
              notes: item.payload.notes?.trim() || null,
              services: (item.payload.services || []).map((service) => service.trim()).filter(Boolean),
              slug: buildClientSlug(item.payload.firm_name || item.payload.contact_name || 'client'),
            };

            const { data: insertedRow, error } = await supabase.from('clients').insert(payload).select('id').single();
            if (error) throw error;

            const clientId = (insertedRow as any)?.id || item.tempId;
            await syncAssignments(clientId, resolveAssignedTeamMemberIds(item.payload)).catch(() => null);

            const nextClient = await upsertClientFromServer(clientId, 'client_created');
            if (!nextClient) {
              setClients((current) =>
                sortClients(
                  current.map((client) =>
                    client.id === item.tempId
                      ? { ...item.optimistic, id: clientId, syncState: 'synced' }
                      : client
                  )
                )
              );
            } else {
              setClients((current) => sortClients(current.filter((client) => client.id !== item.tempId)));
            }
            nextQueue = nextQueue.filter((queueItem) => queueItem.id !== item.id);
            continue;
          }

          if (item.type === 'update') {
            const hasAssignmentFields =
              Object.prototype.hasOwnProperty.call(item.patch, 'assigned_team_member_id') ||
              Object.prototype.hasOwnProperty.call(item.patch, 'assigned_team_member_ids');
            const updatePayload: Record<string, any> = {
              ...stripClientWriteFields(item.patch),
            };
            if (hasAssignmentFields) {
              updatePayload.assigned_team_member_id = item.patch.assigned_team_member_id || null;
            }

            const { error } = await supabase.from('clients').update(updatePayload).eq('id', item.clientId);
            if (error) throw error;

            if (hasAssignmentFields) {
              await syncAssignments(item.clientId, resolveAssignedTeamMemberIds(item.patch));
            }

            const nextClient = await upsertClientFromServer(item.clientId, 'client_updated');
            if (nextClient) {
              setClients((current) => sortClients(current.map((client) => (client.id === item.clientId ? { ...nextClient, syncState: 'synced' } : client))));
            }
            nextQueue = nextQueue.filter((queueItem) => queueItem.id !== item.id);
            continue;
          }

          if (item.type === 'delete') {
            const { error } = await supabase.from('clients').delete().eq('id', item.clientId);
            if (error) throw error;
            removeClientFromState(item.clientId);
            nextQueue = nextQueue.filter((queueItem) => queueItem.id !== item.id);
            continue;
          }
        } catch (error) {
          if (!isRetriableClientError(error)) {
            console.error('[MobileClients] dropping non-retriable queued op', item.type, error);
            if (item.type === 'create') {
              setClients((current) =>
                sortClients(current.map((client) => (client.id === item.tempId ? { ...client, syncState: 'error' } : client)))
              );
            }
            if (item.type === 'update') {
              setClients((current) =>
                sortClients(current.map((client) => (client.id === item.clientId ? { ...client, syncState: 'error' } : client)))
              );
            }
            if (item.type === 'delete' && item.backup) {
              setClients((current) => mergeClientCollections(current, [item.backup as MobileClient]));
            }
            nextQueue = nextQueue.filter((queueItem) => queueItem.id !== item.id);
            continue;
          }

          throw error;
        }
      }

      setPendingQueue(nextQueue);
      setLastSyncedAt(new Date().toISOString());
      await persist();
    } finally {
      flushingRef.current = false;
      setFlushingQueue(false);
    }
  }, [persist, profile, removeClientFromState, replaceClientInState, syncAssignments, upsertClientFromServer]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;

    const bootstrap = async () => {
      if (cancelled) return;
      await refresh();
      await retryPendingQueue();
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refresh, retryPendingQueue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        void retryPendingQueue();
      }
    });

    const intervalId = setInterval(() => {
      void retryPendingQueue();
    }, 25000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [refresh, retryPendingQueue]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwnerId = session?.user?.id ?? null;
      if (storageOwnerIdRef.current === nextOwnerId) return;
      void refresh();
      void retryPendingQueue();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh, retryPendingQueue]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`mobile-clients:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, async (payload) => {
        const eventType = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        const clientId = (newRow?.id || oldRow?.id) as string | undefined;
        if (!clientId) return;

        if (eventType === 'DELETE') {
          removeClientFromState(clientId);
          setLastEvent({ type: 'client_deleted', clientId });
          await persist();
          return;
        }

        const nextType: ClientEventType =
          eventType === 'INSERT'
            ? 'client_created'
            : newRow?.assigned_team_member_id !== oldRow?.assigned_team_member_id
              ? 'client_assigned'
              : newRow?.status !== oldRow?.status
                ? 'client_status_changed'
                : 'client_updated';

        await upsertClientFromServer(clientId, nextType);
        await persist();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assigned_clients' }, async (payload) => {
        const clientId = ((payload.new as any)?.client_id || (payload.old as any)?.client_id) as string | undefined;
        if (!clientId) return;
        await upsertClientFromServer(clientId, 'client_assigned');
        await persist();
      })
      .subscribe((status) => {
        setRealtimeState(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [persist, profile, removeClientFromState, upsertClientFromServer]);

  const permissions = useMemo(
    () => ({
      canCreateClient: canCreateClient(profile),
      canDeleteClient: canDeleteClient(profile),
      canViewClient: (client: MobileClient) => canViewClient(profile, client),
      canEditClientCore: (client?: MobileClient | null) => canEditClientCore(profile, client),
      canEditClientNotes: (client?: MobileClient | null) => canEditClientNotes(profile, client),
      canEditClientStatus: (client?: MobileClient | null) => canEditClientStatus(profile, client),
    }),
    [profile]
  );

  const value = useMemo<ClientContextValue>(
    () => ({
      profile,
      clients,
      teamMembers,
      loading,
      refreshing,
      loadingMore,
      hasMore,
      flushingQueue,
      pendingQueueCount: pendingQueue.length,
      lastSyncedAt,
      realtimeState,
      lastEvent,
      refresh,
      loadMore,
      retryPendingQueue,
      getClientDetails,
      createClient,
      updateClient,
      updateClientStatus,
      updateClientNotes,
      assignClient,
      deleteClient,
      permissions,
    }),
    [
      assignClient,
      clients,
      createClient,
      deleteClient,
      flushingQueue,
      getClientDetails,
      hasMore,
      lastEvent,
      lastSyncedAt,
      loadMore,
      loading,
      loadingMore,
      pendingQueue.length,
      permissions,
      profile,
      realtimeState,
      refresh,
      refreshing,
      retryPendingQueue,
      teamMembers,
      updateClient,
      updateClientNotes,
      updateClientStatus,
    ]
  );

  return <MobileClientsContext.Provider value={value}>{children}</MobileClientsContext.Provider>;
}

export function useMobileClients() {
  const context = useContext(MobileClientsContext);
  if (!context) {
    throw new Error('useMobileClients must be used inside MobileClientsProvider');
  }
  return context;
}

export function defaultClientForm() {
  return emptyClientForm();
}
