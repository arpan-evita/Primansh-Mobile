import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { getCurrentMobileProfile, normalizeRole, type MobileProfile } from '../lib/meetings';
import { supabase } from '../lib/supabase';
import {
  TASK_ATTACHMENT_BUCKET,
  TASK_PAGE_SIZE,
  type CreateTaskInput,
  type MobileTask,
  type SyncState,
  type TaskAttachment,
  type TaskComment,
  type TaskEventType,
  type TaskPriority,
  type TaskStatus,
  type TaskUploadAsset,
  type UpdateTaskInput,
  canChangeTaskStatus,
  canCommentOnTask,
  canCreateTasks,
  canDeleteTask,
  canEditTask,
  isRetriableTaskError,
  mergeTaskCollections,
  sanitizeTaskFileName,
  sortTasks,
} from '../lib/tasks';

type ClientSummary = {
  id: string;
  firm_name: string;
  assigned_team_member_id?: string | null;
};

type TeamMemberSummary = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

type TaskRelation<T> = T | T[] | null | undefined;

type RawTaskRow = {
  id: string;
  title: string;
  description?: string | null;
  client_id?: string | null;
  created_by?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  module?: string | null;
  assigned_to?: string | null;
  assigned_to_user_id?: string | null;
  client?: TaskRelation<ClientSummary>;
  assigned_profile?: TaskRelation<TeamMemberSummary>;
};

type PendingTaskOperation =
  | {
      id: string;
      type: 'create_task';
      tempId: string;
      payload: CreateTaskInput;
      optimisticTask: MobileTask;
      createdAt: string;
    }
  | {
      id: string;
      type: 'update_task';
      taskId: string;
      patch: UpdateTaskInput;
      createdAt: string;
    }
  | {
      id: string;
      type: 'delete_task';
      taskId: string;
      backup?: MobileTask | null;
      createdAt: string;
    }
  | {
      id: string;
      type: 'add_comment';
      taskId: string;
      body: string;
      tempId: string;
      optimisticComment: TaskComment;
      createdAt: string;
    }
  | {
      id: string;
      type: 'upload_attachment';
      taskId: string;
      asset: TaskUploadAsset;
      tempId: string;
      optimisticAttachment: TaskAttachment;
      createdAt: string;
    };

type CachedTaskSnapshot = {
  tasks: MobileTask[];
  clients: ClientSummary[];
  teamMembers: TeamMemberSummary[];
  commentsByTask: Record<string, TaskComment[]>;
  attachmentsByTask: Record<string, TaskAttachment[]>;
  lastSyncedAt?: string | null;
};

type TaskActionResult = {
  ok: boolean;
  queued?: boolean;
  errorMessage?: string;
};

type TaskContextValue = {
  profile: MobileProfile | null;
  tasks: MobileTask[];
  clients: ClientSummary[];
  teamMembers: TeamMemberSummary[];
  commentsByTask: Record<string, TaskComment[]>;
  attachmentsByTask: Record<string, TaskAttachment[]>;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  flushingQueue: boolean;
  pendingQueueCount: number;
  lastSyncedAt: string | null;
  realtimeState: string;
  lastEvent: { type: TaskEventType; taskId: string } | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  retryPendingQueue: () => Promise<void>;
  ensureTaskDetails: (taskId: string, force?: boolean) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<TaskActionResult>;
  updateTask: (taskId: string, patch: UpdateTaskInput) => Promise<TaskActionResult>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<TaskActionResult>;
  deleteTask: (taskId: string) => Promise<TaskActionResult>;
  addComment: (taskId: string, body: string) => Promise<TaskActionResult>;
  uploadAttachment: (taskId: string, asset: TaskUploadAsset) => Promise<TaskActionResult>;
  permissions: {
    canCreateTasks: boolean;
    canEditTask: (task: MobileTask) => boolean;
    canDeleteTask: (task: MobileTask) => boolean;
    canChangeTaskStatus: (task: MobileTask) => boolean;
    canCommentOnTask: (task: MobileTask) => boolean;
    resolveClientProfile: (clientId: string) => Promise<MobileProfile | null>;
  };
};

const TASK_CACHE_KEY = 'primansh_mobile_tasks_cache_v1';
const TASK_QUEUE_KEY = 'primansh_mobile_tasks_queue_v1';
const TASK_SELECT_FIELDS =
  'id, title, description, client_id, created_by, status, priority, due_date, created_at, updated_at, module, assigned_to, assigned_to_user_id, client:clients(id, firm_name, assigned_team_member_id), assigned_profile:profiles!assigned_to_user_id(id, full_name, avatar_url, role)';
const TASK_LEGACY_SELECT_FIELDS =
  'id, title, description, client_id, status, priority, due_date, created_at, module, assigned_to, client:clients(id, firm_name)';

const MobileTasksContext = createContext<TaskContextValue | undefined>(undefined);

function storageKey(baseKey: string, ownerId: string | null) {
  return ownerId ? `${baseKey}:${ownerId}` : baseKey;
}

function extractTaskErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'This task could not be saved right now.';
  }

  const message = 'message' in error ? String((error as { message?: string }).message || '') : '';
  const details = 'details' in error ? String((error as { details?: string }).details || '') : '';
  const hint = 'hint' in error ? String((error as { hint?: string }).hint || '') : '';

  return [message, details, hint].filter(Boolean).join('\n').trim() || 'This task could not be saved right now.';
}

function isTaskSchemaCompatibilityError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code || '') : '';
  const normalized = extractTaskErrorMessage(error).toLowerCase();

  return (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST200' ||
    code === 'PGRST204' ||
    normalized.includes('schema cache') ||
    normalized.includes('does not exist') ||
    normalized.includes('column') ||
    normalized.includes('assigned_to_user_id') ||
    normalized.includes('created_by') ||
    normalized.includes('updated_at') ||
    normalized.includes('assigned_team_member_id')
  );
}

function withLegacyTaskShape(row: Record<string, any>) {
  return {
    ...row,
    created_by: row.created_by || null,
    updated_at: row.updated_at || row.created_at,
    assigned_to_user_id: row.assigned_to_user_id || null,
    client: row.client || null,
  } as RawTaskRow;
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

function groupByTaskId(rows: { task_id: string }[]) {
  return rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.task_id] = (accumulator[row.task_id] || 0) + 1;
    return accumulator;
  }, {});
}

function markTaskSyncState(tasks: MobileTask[], taskId: string, syncState: SyncState) {
  return tasks.map((task) => (task.id === taskId ? { ...task, syncState } : task));
}

function unwrapTaskRelation<T>(value: TaskRelation<T>) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function mapTaskRow(
  row: RawTaskRow,
  commentCountMap: Record<string, number> = {},
  attachmentCountMap: Record<string, number> = {}
): MobileTask {
  const client = unwrapTaskRelation(row.client);
  const assignedProfile = unwrapTaskRelation(row.assigned_profile);

  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    client_id: row.client_id || null,
    created_by: row.created_by || null,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date || null,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    module: row.module || 'general',
    assigned_to: row.assigned_to || null,
    assigned_to_user_id: row.assigned_to_user_id || null,
    client_name: client?.firm_name || 'Unassigned Client',
    assigned_user_name: assignedProfile?.full_name || row.assigned_to || 'Unassigned',
    assigned_user_avatar: assignedProfile?.avatar_url || null,
    assigned_team_member_id: client?.assigned_team_member_id || null,
    comment_count: commentCountMap[row.id] || 0,
    attachment_count: attachmentCountMap[row.id] || 0,
    syncState: 'synced',
  };
}

async function fetchTaskCountMaps(taskIds: string[]) {
  if (taskIds.length === 0) {
    return {
      commentCountMap: {} as Record<string, number>,
      attachmentCountMap: {} as Record<string, number>,
    };
  }

  const [{ data: commentRows, error: commentError }, { data: attachmentRows, error: attachmentError }] =
    await Promise.all([
      supabase.from('task_comments').select('task_id').in('task_id', taskIds),
      supabase.from('task_attachments').select('task_id').in('task_id', taskIds),
    ]);

  if (commentError) throw commentError;
  if (attachmentError) throw attachmentError;

  return {
    commentCountMap: groupByTaskId((commentRows || []) as { task_id: string }[]),
    attachmentCountMap: groupByTaskId((attachmentRows || []) as { task_id: string }[]),
  };
}

async function fetchTaskRows(offset: number, limit: number) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT_FIELDS)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (!isTaskSchemaCompatibilityError(error)) throw error;

    const fallback = await supabase
      .from('tasks')
      .select(TASK_LEGACY_SELECT_FIELDS)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map((row) => withLegacyTaskShape(row as Record<string, any>));
  }

  return (data || []) as unknown as RawTaskRow[];
}

async function fetchTaskById(taskId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT_FIELDS)
    .eq('id', taskId)
    .single();

  if (error) {
    if (!isTaskSchemaCompatibilityError(error)) throw error;

    const fallback = await supabase
      .from('tasks')
      .select(TASK_LEGACY_SELECT_FIELDS)
      .eq('id', taskId)
      .single();

    if (fallback.error) throw fallback.error;

    const { commentCountMap, attachmentCountMap } = await fetchTaskCountMaps([taskId]);
    return mapTaskRow(withLegacyTaskShape(fallback.data as Record<string, any>), commentCountMap, attachmentCountMap);
  }

  const { commentCountMap, attachmentCountMap } = await fetchTaskCountMaps([taskId]);
  return mapTaskRow(data as unknown as RawTaskRow, commentCountMap, attachmentCountMap);
}

async function fetchTaskComments(taskId: string) {
  const { data, error } = await supabase
    .from('task_comments')
    .select('id, task_id, body, created_by, created_at, updated_at, author:profiles(id, full_name, avatar_url, role)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data || []) as any[]).map(
    (item) =>
      ({
        ...item,
        syncState: 'synced',
      }) as TaskComment
  );
}

async function fetchTaskAttachments(taskId: string) {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('id, task_id, file_name, file_path, file_url, file_size, mime_type, uploaded_by, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const items = (data || []) as TaskAttachment[];
  return Promise.all(
    items.map(async (item) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .createSignedUrl(item.file_path, 60 * 60);

      return {
        ...item,
        file_url: item.file_url || signed?.signedUrl || null,
        signed_url: signedError ? item.file_url || null : signed?.signedUrl || item.file_url || null,
        syncState: 'synced' as SyncState,
      };
    })
  );
}

async function persistAssetForOffline(asset: TaskUploadAsset) {
  const targetUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${Date.now()}_${sanitizeTaskFileName(asset.name)}`;
  await FileSystem.copyAsync({
    from: asset.uri,
    to: targetUri,
  });
  return {
    ...asset,
    uri: targetUri,
  };
}

function createOptimisticTask(
  input: CreateTaskInput,
  profile: MobileProfile,
  clients: ClientSummary[],
  teamMembers: TeamMemberSummary[]
): MobileTask {
  const assignee = input.assigned_to_user_id
    ? teamMembers.find((member) => member.id === input.assigned_to_user_id) || null
    : null;
  const client = clients.find((item) => item.id === input.client_id) || null;

  return {
    id: `temp-task-${Date.now()}`,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    client_id: input.client_id,
    created_by: profile.id,
    status: input.status || 'todo',
    priority: input.priority || 'medium',
    due_date: input.due_date || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    module: input.module || 'general',
    assigned_to: assignee?.full_name || null,
    assigned_to_user_id: assignee?.id || null,
    client_name: client?.firm_name || 'Unassigned Client',
    assigned_user_name: assignee?.full_name || 'Unassigned',
    assigned_user_avatar: assignee?.avatar_url || null,
    assigned_team_member_id: client?.assigned_team_member_id || null,
    comment_count: 0,
    attachment_count: 0,
    syncState: 'pending',
  };
}

function applyQueueToTasks(baseTasks: MobileTask[], queue: PendingTaskOperation[]) {
  let nextTasks = [...baseTasks];

  for (const operation of queue) {
    if (operation.type === 'create_task') {
      if (!nextTasks.some((task) => task.id === operation.tempId)) {
        nextTasks = mergeTaskCollections(nextTasks, [operation.optimisticTask]);
      }
      continue;
    }

    if (operation.type === 'update_task') {
      nextTasks = nextTasks.map((task) =>
        task.id === operation.taskId
          ? {
              ...task,
              ...operation.patch,
              updated_at: new Date().toISOString(),
              syncState: 'pending',
            }
          : task
      );
      continue;
    }

    if (operation.type === 'delete_task') {
      nextTasks = nextTasks.filter((task) => task.id !== operation.taskId);
      continue;
    }

    if (operation.type === 'add_comment') {
      nextTasks = nextTasks.map((task) =>
        task.id === operation.taskId
          ? { ...task, comment_count: task.comment_count + 1, syncState: 'pending' }
          : task
      );
      continue;
    }

    if (operation.type === 'upload_attachment') {
      nextTasks = nextTasks.map((task) =>
        task.id === operation.taskId
          ? { ...task, attachment_count: task.attachment_count + 1, syncState: 'pending' }
          : task
      );
    }
  }

  return sortTasks(nextTasks);
}

export function MobileTasksProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberSummary[]>([]);
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({});
  const [attachmentsByTask, setAttachmentsByTask] = useState<Record<string, TaskAttachment[]>>({});
  const [pendingQueue, setPendingQueue] = useState<PendingTaskOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [flushingQueue, setFlushingQueue] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState('idle');
  const [lastEvent, setLastEvent] = useState<{ type: TaskEventType; taskId: string } | null>(null);

  const tasksRef = useRef<MobileTask[]>([]);
  const clientsRef = useRef<ClientSummary[]>([]);
  const teamMembersRef = useRef<TeamMemberSummary[]>([]);
  const commentsRef = useRef<Record<string, TaskComment[]>>({});
  const attachmentsRef = useRef<Record<string, TaskAttachment[]>>({});
  const pendingQueueRef = useRef<PendingTaskOperation[]>([]);
  const loadingRemoteCountRef = useRef(0);
  const flushingQueueRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const storageOwnerIdRef = useRef<string | null>(null);
  const hydratingRef = useRef(false);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  useEffect(() => {
    teamMembersRef.current = teamMembers;
  }, [teamMembers]);

  useEffect(() => {
    commentsRef.current = commentsByTask;
  }, [commentsByTask]);

  useEffect(() => {
    attachmentsRef.current = attachmentsByTask;
  }, [attachmentsByTask]);

  useEffect(() => {
    pendingQueueRef.current = pendingQueue;
  }, [pendingQueue]);

  const resetTaskState = useCallback(() => {
    setProfile(null);
    setTasks([]);
    setClients([]);
    setTeamMembers([]);
    setCommentsByTask({});
    setAttachmentsByTask({});
    setPendingQueue([]);
    setHasMore(true);
    setLoading(true);
    setRefreshing(false);
    setLoadingMore(false);
    setFlushingQueue(false);
    setLastSyncedAt(null);
    setRealtimeState('idle');
    setLastEvent(null);
    loadingRemoteCountRef.current = 0;
    storageOwnerIdRef.current = null;
  }, []);

  const persistState = useCallback(async () => {
    if (hydratingRef.current) return;

    const ownerId = storageOwnerIdRef.current;
    if (!ownerId) return;

    const snapshot: CachedTaskSnapshot = {
      tasks: tasksRef.current,
      clients: clientsRef.current,
      teamMembers: teamMembersRef.current,
      commentsByTask: commentsRef.current,
      attachmentsByTask: attachmentsRef.current,
      lastSyncedAt,
    };

    await Promise.all([
      AsyncStorage.setItem(storageKey(TASK_CACHE_KEY, ownerId), JSON.stringify(snapshot)),
      AsyncStorage.setItem(storageKey(TASK_QUEUE_KEY, ownerId), JSON.stringify(pendingQueueRef.current)),
    ]);
  }, [lastSyncedAt]);

  useEffect(() => {
    void persistState();
  }, [attachmentsByTask, clients, commentsByTask, lastSyncedAt, pendingQueue, persistState, tasks, teamMembers]);

  const loadCachedState = useCallback(async () => {
    try {
      hydratingRef.current = true;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const ownerId = session?.user?.id ?? null;
      const previousOwnerId = storageOwnerIdRef.current;

      if (previousOwnerId && previousOwnerId !== ownerId) {
        resetTaskState();
      }

      storageOwnerIdRef.current = ownerId;

      if (!ownerId) {
        resetTaskState();
        return;
      }

      const [cacheValue, queueValue] = await Promise.all([
        AsyncStorage.getItem(storageKey(TASK_CACHE_KEY, ownerId)),
        AsyncStorage.getItem(storageKey(TASK_QUEUE_KEY, ownerId)),
      ]);

      if (cacheValue) {
        const cache = JSON.parse(cacheValue) as CachedTaskSnapshot;
        setTasks(cache.tasks || []);
        setClients(cache.clients || []);
        setTeamMembers(cache.teamMembers || []);
        setCommentsByTask(cache.commentsByTask || {});
        setAttachmentsByTask(cache.attachmentsByTask || {});
        setLastSyncedAt(cache.lastSyncedAt || null);
        loadingRemoteCountRef.current = (cache.tasks || []).filter((item) => !item.id.startsWith('temp-task-')).length;
      }

      if (queueValue) {
        const queue = JSON.parse(queueValue) as PendingTaskOperation[];
        setPendingQueue(queue || []);
      } else {
        setPendingQueue([]);
      }
    } catch (error) {
      console.error('[MobileTasks] Failed to load cached task state', error);
    } finally {
      hydratingRef.current = false;
    }
  }, [resetTaskState]);

  const fetchMetadata = useCallback(async () => {
    const [clientsResult, membersResult] = await Promise.all([
      supabase
        .from('clients')
        .select('id, firm_name, assigned_team_member_id')
        .order('firm_name', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .order('full_name', { ascending: true }),
    ]);

    let nextClients = (clientsResult.data || []) as ClientSummary[];
    if (clientsResult.error) {
      if (!isTaskSchemaCompatibilityError(clientsResult.error)) throw clientsResult.error;

      const fallbackClients = await supabase
        .from('clients')
        .select('id, firm_name')
        .order('firm_name', { ascending: true });

      if (fallbackClients.error) throw fallbackClients.error;
      nextClients = (fallbackClients.data || []).map((client) => ({
        ...(client as ClientSummary),
        assigned_team_member_id: null,
      }));
    }

    if (membersResult.error) throw membersResult.error;

    setClients(nextClients);
    setTeamMembers(
      ((membersResult.data || []) as TeamMemberSummary[]).filter(
        (member) => normalizeRole(member.role || 'client') !== 'client'
      )
    );
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const currentProfile = profile || (await getCurrentMobileProfile());
      setProfile(currentProfile);
      if (!currentProfile) {
        resetTaskState();
        setLoading(false);
        setRefreshing(false);
        return;
      }

      await fetchMetadata();
      const rows = await fetchTaskRows(0, TASK_PAGE_SIZE);
      const taskIds = rows.map((row) => row.id);
      const { commentCountMap, attachmentCountMap } = await fetchTaskCountMaps(taskIds);
      const remoteTasks = rows.map((row) => mapTaskRow(row, commentCountMap, attachmentCountMap));

      loadingRemoteCountRef.current = remoteTasks.length;
      setHasMore(remoteTasks.length === TASK_PAGE_SIZE);
      setLastSyncedAt(new Date().toISOString());
      setTasks(applyQueueToTasks(remoteTasks, pendingQueueRef.current));
    } catch (error) {
      console.error('[MobileTasks] refresh failed', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      await persistState();
    }
  }, [fetchMetadata, persistState, profile, resetTaskState]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchTaskRows(loadingRemoteCountRef.current, TASK_PAGE_SIZE);
      const taskIds = rows.map((row) => row.id);
      const { commentCountMap, attachmentCountMap } = await fetchTaskCountMaps(taskIds);
      const remoteTasks = rows.map((row) => mapTaskRow(row, commentCountMap, attachmentCountMap));

      loadingRemoteCountRef.current += remoteTasks.length;
      setHasMore(remoteTasks.length === TASK_PAGE_SIZE);
      setTasks((current) => applyQueueToTasks(mergeTaskCollections(current, remoteTasks), pendingQueueRef.current));
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error('[MobileTasks] loadMore failed', error);
    } finally {
      setLoadingMore(false);
      await persistState();
    }
  }, [hasMore, loadingMore, persistState]);

  const ensureTaskDetails = useCallback(async (taskId: string, force = false) => {
    if (!force && commentsRef.current[taskId] && attachmentsRef.current[taskId]) {
      return;
    }

    try {
      const [comments, attachments] = await Promise.all([
        fetchTaskComments(taskId),
        fetchTaskAttachments(taskId),
      ]);

      setCommentsByTask((current) => ({ ...current, [taskId]: comments }));
      setAttachmentsByTask((current) => ({ ...current, [taskId]: attachments }));
      await persistState();
    } catch (error) {
      console.error('[MobileTasks] ensureTaskDetails failed', error);
    }
  }, [persistState]);

  const enqueueOperation = useCallback(async (operation: PendingTaskOperation) => {
    setPendingQueue((current) => [...current, operation]);
    await persistState();
  }, [persistState]);

  const replaceTaskIdReferences = useCallback(async (fromId: string, toId: string, replacement: MobileTask) => {
    setTasks((current) =>
      sortTasks(
        current.map((task) => (task.id === fromId ? { ...replacement, syncState: 'synced' } : task))
      )
    );

    setCommentsByTask((current) => {
      if (!current[fromId]) return current;
      const next = { ...current };
      next[toId] = (current[fromId] || []).map((item) => ({ ...item, task_id: toId }));
      delete next[fromId];
      return next;
    });

    setAttachmentsByTask((current) => {
      if (!current[fromId]) return current;
      const next = { ...current };
      next[toId] = (current[fromId] || []).map((item) => ({ ...item, task_id: toId }));
      delete next[fromId];
      return next;
    });

    setPendingQueue((current) =>
      current
        .filter((item) => !(item.type === 'create_task' && item.tempId === fromId))
        .map((item) => {
          if ('taskId' in item && item.taskId === fromId) {
            return { ...item, taskId: toId } as PendingTaskOperation;
          }
          return item;
        })
    );

    await persistState();
  }, [persistState]);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    if (!profile) return { ok: false };

    const optimisticTask = createOptimisticTask(input, profile, clientsRef.current, teamMembersRef.current);
    setTasks((current) => mergeTaskCollections(current, [optimisticTask]));

    const payload = {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      client_id: input.client_id,
      assigned_to_user_id: input.assigned_to_user_id || null,
      assigned_to:
        input.assigned_to_user_id
          ? teamMembersRef.current.find((member) => member.id === input.assigned_to_user_id)?.full_name || null
          : null,
      priority: input.priority || 'medium',
      status: input.status || 'todo',
      due_date: input.due_date || null,
      module: input.module || 'general',
      created_by: profile.id,
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
        .select(TASK_SELECT_FIELDS)
        .single();

      if (error) {
        if (!isTaskSchemaCompatibilityError(error)) throw error;

        const legacyPayload = {
          title: payload.title,
          description: payload.description,
          client_id: payload.client_id,
          assigned_to: payload.assigned_to,
          priority: payload.priority,
          status: payload.status,
          due_date: payload.due_date,
          module: payload.module,
        };

        const legacyResult = await supabase
          .from('tasks')
          .insert(legacyPayload)
          .select(TASK_LEGACY_SELECT_FIELDS)
          .single();

        if (legacyResult.error) throw legacyResult.error;

        const task = mapTaskRow(withLegacyTaskShape(legacyResult.data as Record<string, any>));
        setTasks((current) => sortTasks(current.map((item) => (item.id === optimisticTask.id ? task : item))));
        setLastSyncedAt(new Date().toISOString());
        await persistState();
        return { ok: true };
      }

      const task = mapTaskRow(data as unknown as RawTaskRow);
      setTasks((current) => sortTasks(current.map((item) => (item.id === optimisticTask.id ? task : item))));
      setLastSyncedAt(new Date().toISOString());
      await persistState();
      return { ok: true };
    } catch (error) {
      if (!isRetriableTaskError(error)) {
        console.error('[MobileTasks] createTask failed', error);
        setTasks((current) => markTaskSyncState(current, optimisticTask.id, 'error'));
        await persistState();
        return { ok: false, errorMessage: extractTaskErrorMessage(error) };
      }

      await enqueueOperation({
        id: `queue-${Date.now()}`,
        type: 'create_task',
        tempId: optimisticTask.id,
        payload: input,
        optimisticTask,
        createdAt: new Date().toISOString(),
      });

      return { ok: true, queued: true };
    }
  }, [enqueueOperation, persistState, profile]);

  const updateTask = useCallback(async (taskId: string, patch: UpdateTaskInput) => {
    const previousTask = tasksRef.current.find((task) => task.id === taskId) || null;
    if (!previousTask) return { ok: false };

    setTasks((current) =>
      sortTasks(
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...patch,
                updated_at: new Date().toISOString(),
                syncState: 'pending',
              }
            : task
        )
      )
    );

    try {
      const payload: Record<string, any> = { ...patch };
      if (payload.assigned_to_user_id) {
        payload.assigned_to =
          teamMembersRef.current.find((member) => member.id === payload.assigned_to_user_id)?.full_name || null;
      }

      const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
      if (error) throw error;

      const nextTask = await fetchTaskById(taskId);
      setTasks((current) => sortTasks(current.map((task) => (task.id === taskId ? nextTask : task))));
      setLastSyncedAt(new Date().toISOString());
      await persistState();
      return { ok: true };
    } catch (error) {
      if (!isRetriableTaskError(error)) {
        const errorMessage = extractTaskErrorMessage(error);
        console.error('[MobileTasks] updateTask failed', error, errorMessage);
        setTasks((current) =>
          sortTasks(current.map((task) => (task.id === taskId && previousTask ? previousTask : task)))
        );
        await persistState();
        return { ok: false, errorMessage };
      }

      await enqueueOperation({
        id: `queue-${Date.now()}`,
        type: 'update_task',
        taskId,
        patch,
        createdAt: new Date().toISOString(),
      });

      return { ok: true, queued: true };
    }
  }, [enqueueOperation, persistState]);

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    return updateTask(taskId, { status });
  }, [updateTask]);

  const deleteTask = useCallback(async (taskId: string) => {
    const backup = tasksRef.current.find((task) => task.id === taskId) || null;
    if (!backup) return { ok: false };

    setTasks((current) => current.filter((task) => task.id !== taskId));

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;

      setLastSyncedAt(new Date().toISOString());
      await persistState();
      return { ok: true };
    } catch (error) {
      if (!isRetriableTaskError(error)) {
        console.error('[MobileTasks] deleteTask failed', error);
        if (backup) {
          setTasks((current) => mergeTaskCollections(current, [backup]));
        }
        await persistState();
        return { ok: false };
      }

      await enqueueOperation({
        id: `queue-${Date.now()}`,
        type: 'delete_task',
        taskId,
        backup,
        createdAt: new Date().toISOString(),
      });

      return { ok: true, queued: true };
    }
  }, [enqueueOperation, persistState]);

  const addComment = useCallback(async (taskId: string, body: string) => {
    if (!profile) return { ok: false };
    const trimmed = body.trim();
    if (!trimmed) return { ok: false };

    const optimisticComment: TaskComment = {
      id: `temp-comment-${Date.now()}`,
      task_id: taskId,
      body: trimmed,
      created_by: profile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      syncState: 'pending',
      author: {
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url || null,
        role: profile.role,
      },
    };

    setCommentsByTask((current) => ({
      ...current,
      [taskId]: [...(current[taskId] || []), optimisticComment],
    }));
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, comment_count: task.comment_count + 1, syncState: 'pending' }
          : task
      )
    );

    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          body: trimmed,
          created_by: profile.id,
        })
        .select('id, task_id, body, created_by, created_at, updated_at, author:profiles(id, full_name, avatar_url, role)')
        .single();

      if (error) throw error;

      setCommentsByTask((current) => ({
        ...current,
        [taskId]: (current[taskId] || []).map((item) =>
          item.id === optimisticComment.id ? ({ ...(data as any), syncState: 'synced' } as TaskComment) : item
        ),
      }));
      setTasks((current) => markTaskSyncState(current, taskId, 'synced'));
      setLastSyncedAt(new Date().toISOString());
      await persistState();
      return { ok: true };
    } catch (error) {
      if (!isRetriableTaskError(error)) {
        console.error('[MobileTasks] addComment failed', error);
        setCommentsByTask((current) => ({
          ...current,
          [taskId]: (current[taskId] || []).map((item) =>
            item.id === optimisticComment.id ? { ...item, syncState: 'error' } : item
          ),
        }));
        await persistState();
        return { ok: false };
      }

      await enqueueOperation({
        id: `queue-${Date.now()}`,
        type: 'add_comment',
        taskId,
        body: trimmed,
        tempId: optimisticComment.id,
        optimisticComment,
        createdAt: new Date().toISOString(),
      });

      return { ok: true, queued: true };
    }
  }, [enqueueOperation, persistState, profile]);

  const uploadAttachment = useCallback(async (taskId: string, asset: TaskUploadAsset) => {
    if (!profile) return { ok: false };

    const optimisticAttachment: TaskAttachment = {
      id: `temp-attachment-${Date.now()}`,
      task_id: taskId,
      file_name: asset.name,
      file_path: '',
      file_size: asset.size || null,
      mime_type: asset.mimeType || null,
      uploaded_by: profile.id,
      created_at: new Date().toISOString(),
      local_uri: asset.uri,
      file_url: asset.uri,
      syncState: 'pending',
    };

    setAttachmentsByTask((current) => ({
      ...current,
      [taskId]: [optimisticAttachment, ...(current[taskId] || [])],
    }));
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, attachment_count: task.attachment_count + 1, syncState: 'pending' }
          : task
      )
    );

    const executeUpload = async (uploadAsset: TaskUploadAsset, tempId: string) => {
      const filePath = `${taskId}/${Date.now()}_${sanitizeTaskFileName(uploadAsset.name)}`;
      const fileBase64 = await FileSystem.readAsStringAsync(uploadAsset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileBuffer = base64ToArrayBuffer(fileBase64);

      const { error: uploadError } = await supabase.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .upload(filePath, fileBuffer, {
          contentType: uploadAsset.mimeType || undefined,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: signed } = await supabase.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .createSignedUrl(filePath, 60 * 60);

      const { data, error } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: uploadAsset.name,
          file_path: filePath,
          file_size: uploadAsset.size || null,
          mime_type: uploadAsset.mimeType || null,
          uploaded_by: profile.id,
        })
        .select('id, task_id, file_name, file_path, file_url, file_size, mime_type, uploaded_by, created_at')
        .single();

      if (error) throw error;

      setAttachmentsByTask((current) => ({
        ...current,
        [taskId]: (current[taskId] || []).map((item) =>
          item.id === tempId
            ? ({
                ...(data as any),
                file_url: signed?.signedUrl || null,
                signed_url: signed?.signedUrl || null,
                syncState: 'synced',
              } as TaskAttachment)
            : item
        ),
      }));
      setTasks((current) => markTaskSyncState(current, taskId, 'synced'));
      setLastSyncedAt(new Date().toISOString());
    };

    try {
      await executeUpload(asset, optimisticAttachment.id);
      await persistState();
      return { ok: true };
    } catch (error) {
      if (!isRetriableTaskError(error)) {
        console.error('[MobileTasks] uploadAttachment failed', error);
        setAttachmentsByTask((current) => ({
          ...current,
          [taskId]: (current[taskId] || []).map((item) =>
            item.id === optimisticAttachment.id ? { ...item, syncState: 'error' } : item
          ),
        }));
        await persistState();
        return { ok: false };
      }

      const persistentAsset = await persistAssetForOffline(asset);
      const updatedAttachment = { ...optimisticAttachment, local_uri: persistentAsset.uri, file_url: persistentAsset.uri };
      setAttachmentsByTask((current) => ({
        ...current,
        [taskId]: (current[taskId] || []).map((item) =>
          item.id === optimisticAttachment.id ? updatedAttachment : item
        ),
      }));

      await enqueueOperation({
        id: `queue-${Date.now()}`,
        type: 'upload_attachment',
        taskId,
        asset: persistentAsset,
        tempId: optimisticAttachment.id,
        optimisticAttachment: updatedAttachment,
        createdAt: new Date().toISOString(),
      });

      return { ok: true, queued: true };
    }
  }, [enqueueOperation, persistState, profile]);

  const retryPendingQueue = useCallback(async () => {
    const currentProfile = profile || (await getCurrentMobileProfile().catch(() => null));
    if (flushingQueueRef.current || !currentProfile || pendingQueueRef.current.length === 0) return;

    if (!profile) {
      setProfile(currentProfile);
    }

    flushingQueueRef.current = true;
    setFlushingQueue(true);

    try {
      let nextQueue = [...pendingQueueRef.current];

      for (const operation of pendingQueueRef.current) {
        try {
          if (operation.type === 'create_task') {
            const createPayload = {
              title: operation.payload.title.trim(),
              description: operation.payload.description?.trim() || null,
              client_id: operation.payload.client_id,
              assigned_to_user_id: operation.payload.assigned_to_user_id || null,
              assigned_to:
                operation.payload.assigned_to_user_id
                  ? teamMembersRef.current.find((member) => member.id === operation.payload.assigned_to_user_id)?.full_name || null
                  : null,
              priority: operation.payload.priority || 'medium',
              status: operation.payload.status || 'todo',
              due_date: operation.payload.due_date || null,
              module: operation.payload.module || 'general',
              created_by: currentProfile.id,
            };

            const result = await supabase
              .from('tasks')
              .insert(createPayload)
              .select(TASK_SELECT_FIELDS)
              .single();

            let replacement: MobileTask;
            if (result.error) {
              if (!isTaskSchemaCompatibilityError(result.error)) throw result.error;

              const legacyResult = await supabase
                .from('tasks')
                .insert({
                  title: createPayload.title,
                  description: createPayload.description,
                  client_id: createPayload.client_id,
                  assigned_to: createPayload.assigned_to,
                  priority: createPayload.priority,
                  status: createPayload.status,
                  due_date: createPayload.due_date,
                  module: createPayload.module,
                })
                .select(TASK_LEGACY_SELECT_FIELDS)
                .single();

              if (legacyResult.error) throw legacyResult.error;
              replacement = mapTaskRow(withLegacyTaskShape(legacyResult.data as Record<string, any>));
            } else {
              replacement = mapTaskRow(result.data as unknown as RawTaskRow);
            }

            await replaceTaskIdReferences(operation.tempId, replacement.id, replacement);
            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            continue;
          }

          if (operation.type === 'update_task') {
            const payload: Record<string, any> = { ...operation.patch };
            if (payload.assigned_to_user_id) {
              payload.assigned_to =
                teamMembersRef.current.find((member) => member.id === payload.assigned_to_user_id)?.full_name || null;
            }

            const { error } = await supabase.from('tasks').update(payload).eq('id', operation.taskId);
            if (error) throw error;

            const nextTask = await fetchTaskById(operation.taskId);
            setTasks((current) => sortTasks(current.map((task) => (task.id === operation.taskId ? nextTask : task))));
            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            continue;
          }

          if (operation.type === 'delete_task') {
            const { error } = await supabase.from('tasks').delete().eq('id', operation.taskId);
            if (error) throw error;
            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            continue;
          }

          if (operation.type === 'add_comment') {
            const { data, error } = await supabase
              .from('task_comments')
              .insert({
                task_id: operation.taskId,
                body: operation.body,
                created_by: currentProfile.id,
              })
              .select('id, task_id, body, created_by, created_at, updated_at, author:profiles(id, full_name, avatar_url, role)')
              .single();

            if (error) throw error;

            setCommentsByTask((current) => ({
              ...current,
              [operation.taskId]: (current[operation.taskId] || []).map((item) =>
                item.id === operation.tempId ? ({ ...(data as any), syncState: 'synced' } as TaskComment) : item
              ),
            }));
            setTasks((current) => markTaskSyncState(current, operation.taskId, 'synced'));
            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            continue;
          }

          if (operation.type === 'upload_attachment') {
            const filePath = `${operation.taskId}/${Date.now()}_${sanitizeTaskFileName(operation.asset.name)}`;
            const fileBase64 = await FileSystem.readAsStringAsync(operation.asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const fileBuffer = base64ToArrayBuffer(fileBase64);

            const { error: uploadError } = await supabase.storage
              .from(TASK_ATTACHMENT_BUCKET)
              .upload(filePath, fileBuffer, {
                contentType: operation.asset.mimeType || undefined,
                upsert: false,
              });

            if (uploadError) throw uploadError;

            const { data: signed } = await supabase.storage
              .from(TASK_ATTACHMENT_BUCKET)
              .createSignedUrl(filePath, 60 * 60);

            const { data, error } = await supabase
              .from('task_attachments')
              .insert({
                task_id: operation.taskId,
                file_name: operation.asset.name,
                file_path: filePath,
                file_size: operation.asset.size || null,
                mime_type: operation.asset.mimeType || null,
                uploaded_by: currentProfile.id,
              })
              .select('id, task_id, file_name, file_path, file_url, file_size, mime_type, uploaded_by, created_at')
              .single();

            if (error) throw error;

            setAttachmentsByTask((current) => ({
              ...current,
              [operation.taskId]: (current[operation.taskId] || []).map((item) =>
                item.id === operation.tempId
                  ? ({
                      ...(data as any),
                      file_url: signed?.signedUrl || null,
                      signed_url: signed?.signedUrl || null,
                      syncState: 'synced',
                    } as TaskAttachment)
                  : item
              ),
            }));
            setTasks((current) => markTaskSyncState(current, operation.taskId, 'synced'));
            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            continue;
          }
        } catch (error) {
          if (!isRetriableTaskError(error)) {
            console.error('[MobileTasks] dropping non-retriable queued op', operation.type, error);

            if (operation.type === 'create_task') {
              setTasks((current) => markTaskSyncState(current, operation.tempId, 'error'));
            } else if (operation.type === 'add_comment') {
              setCommentsByTask((current) => ({
                ...current,
                [operation.taskId]: (current[operation.taskId] || []).map((item) =>
                  item.id === operation.tempId ? { ...item, syncState: 'error' } : item
                ),
              }));
            } else if (operation.type === 'upload_attachment') {
              setAttachmentsByTask((current) => ({
                ...current,
                [operation.taskId]: (current[operation.taskId] || []).map((item) =>
                  item.id === operation.tempId ? { ...item, syncState: 'error' } : item
                ),
              }));
            } else if (operation.type === 'delete_task' && operation.backup) {
              setTasks((current) => mergeTaskCollections(current, [operation.backup as MobileTask]));
            }

            nextQueue = nextQueue.filter((item) => item.id !== operation.id);
            continue;
          }

          break;
        }
      }

      setPendingQueue(nextQueue);
      setLastSyncedAt(new Date().toISOString());
      await persistState();
    } finally {
      flushingQueueRef.current = false;
      setFlushingQueue(false);
    }
  }, [persistState, profile, replaceTaskIdReferences]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;

    const bootstrap = async () => {
      await loadCachedState();
      const currentProfile = await getCurrentMobileProfile().catch(() => null);
      if (cancelled) return;
      setProfile(currentProfile);
      await refresh();
      await retryPendingQueue();
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadCachedState, refresh, retryPendingQueue]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
        void retryPendingQueue();
      }
    });

    const intervalId = setInterval(() => {
      void retryPendingQueue();
    }, 20000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [refresh, retryPendingQueue]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwnerId = session?.user?.id ?? null;
      if (storageOwnerIdRef.current === nextOwnerId) return;
      void (async () => {
        await loadCachedState();
        await refresh();
        await retryPendingQueue();
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadCachedState, refresh, retryPendingQueue]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`mobile-tasks:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async (payload) => {
        const eventType = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        const taskId = (newRow?.id || oldRow?.id) as string | undefined;
        if (!taskId) return;

        if (eventType === 'DELETE') {
          setTasks((current) => current.filter((task) => task.id !== taskId));
          setLastEvent({ type: 'task_deleted', taskId });
          await persistState();
          return;
        }

        const nextType: TaskEventType =
          eventType === 'INSERT'
            ? 'task_created'
            : newRow?.status !== oldRow?.status
              ? 'task_status_changed'
              : newRow?.assigned_to_user_id !== oldRow?.assigned_to_user_id
                ? 'task_assigned'
                : 'task_updated';

        try {
          const nextTask = await fetchTaskById(taskId);
          setTasks((current) => mergeTaskCollections(current.filter((task) => task.id !== taskId), [nextTask]));
          setLastEvent({ type: nextType, taskId });
          setLastSyncedAt(new Date().toISOString());
          await persistState();
        } catch {
          setTasks((current) => current.filter((task) => task.id !== taskId));
          await persistState();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, async (payload) => {
        const taskId = ((payload.new as any)?.task_id || (payload.old as any)?.task_id) as string | undefined;
        if (!taskId) return;

        try {
          const comments = commentsRef.current[taskId] ? await fetchTaskComments(taskId) : null;
          if (comments) {
            setCommentsByTask((current) => ({ ...current, [taskId]: comments }));
          }

          const commentDelta = payload.eventType === 'INSERT' ? 1 : payload.eventType === 'DELETE' ? -1 : 0;
          const commentCount = comments ? comments.length : Math.max(0, (tasksRef.current.find((task) => task.id === taskId)?.comment_count || 0) + commentDelta);
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    comment_count: Math.max(commentCount, 0),
                    syncState: 'synced',
                  }
                : task
            )
          );
          await persistState();
        } catch (error) {
          console.error('[MobileTasks] realtime comments sync failed', error);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_attachments' }, async (payload) => {
        const taskId = ((payload.new as any)?.task_id || (payload.old as any)?.task_id) as string | undefined;
        if (!taskId) return;

        try {
          const attachments = attachmentsRef.current[taskId] ? await fetchTaskAttachments(taskId) : null;
          if (attachments) {
            setAttachmentsByTask((current) => ({ ...current, [taskId]: attachments }));
          }

          const attachmentDelta = payload.eventType === 'INSERT' ? 1 : payload.eventType === 'DELETE' ? -1 : 0;
          const attachmentCount = attachments ? attachments.length : Math.max(0, (tasksRef.current.find((task) => task.id === taskId)?.attachment_count || 0) + attachmentDelta);
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    attachment_count: Math.max(attachmentCount, 0),
                    syncState: 'synced',
                  }
                : task
            )
          );
          await persistState();
        } catch (error) {
          console.error('[MobileTasks] realtime attachments sync failed', error);
        }
      })
      .subscribe((status) => {
        setRealtimeState(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [persistState, profile]);

  const resolveClientProfile = useCallback(async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, associated_client_id')
        .eq('associated_client_id', clientId)
        .limit(1)
        .single();

      if (error) throw error;
      return data as MobileProfile;
    } catch (error) {
      console.error('[MobileTasks] resolveClientProfile failed', error);
      return null;
    }
  }, []);

  const permissions = useMemo(
    () => ({
      canCreateTasks: canCreateTasks(profile),
      canEditTask: (task: MobileTask) => canEditTask(profile) && task.syncState !== 'pending',
      canDeleteTask: (task: MobileTask) => canDeleteTask(profile) && task.syncState !== 'pending',
      canChangeTaskStatus: (task: MobileTask) => canChangeTaskStatus(profile, task),
      canCommentOnTask: (task: MobileTask) => canCommentOnTask(profile, task),
      resolveClientProfile,
    }),
    [profile, resolveClientProfile]
  );

  const value = useMemo<TaskContextValue>(
    () => ({
      profile,
      tasks,
      clients,
      teamMembers,
      commentsByTask,
      attachmentsByTask,
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
      ensureTaskDetails,
      createTask,
      updateTask,
      updateTaskStatus,
      deleteTask,
      addComment,
      uploadAttachment,
      permissions,
    }),
    [
      addComment,
      attachmentsByTask,
      clients,
      commentsByTask,
      createTask,
      deleteTask,
      ensureTaskDetails,
      flushingQueue,
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
      tasks,
      teamMembers,
      updateTask,
      updateTaskStatus,
      uploadAttachment,
    ]
  );

  return <MobileTasksContext.Provider value={value}>{children}</MobileTasksContext.Provider>;
}

export function useMobileTasks() {
  const context = useContext(MobileTasksContext);
  if (!context) {
    throw new Error('useMobileTasks must be used inside MobileTasksProvider');
  }
  return context;
}
