import type { MobileProfile } from './meetings';
import { normalizeRole } from './meetings';

export const TASK_PAGE_SIZE = 40;
export const TASK_ATTACHMENT_BUCKET = 'task-attachments';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskColumnKey = 'backlog' | 'inProgress' | 'completed';
export type SyncState = 'synced' | 'pending' | 'error';

export type TaskEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_status_changed'
  | 'task_assigned';

export type TaskComment = {
  id: string;
  task_id: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  syncState?: SyncState;
  author?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
  } | null;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_url?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by: string;
  created_at: string;
  signed_url?: string | null;
  local_uri?: string | null;
  syncState?: SyncState;
};

export type MobileTask = {
  id: string;
  title: string;
  description?: string | null;
  client_id: string | null;
  created_by?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  module?: string | null;
  assigned_to?: string | null;
  assigned_to_user_id?: string | null;
  client_name?: string | null;
  assigned_user_name?: string | null;
  assigned_user_avatar?: string | null;
  assigned_team_member_id?: string | null;
  comment_count: number;
  attachment_count: number;
  syncState?: SyncState;
};

export type TaskFilters = {
  status: 'all' | TaskStatus;
  priority: 'all' | TaskPriority;
  assignedUserId: 'all' | string;
  clientId: 'all' | string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  client_id: string;
  assigned_to_user_id?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  module?: string | null;
};

export type UpdateTaskInput = Partial<Pick<CreateTaskInput, 'title' | 'description' | 'client_id' | 'assigned_to_user_id' | 'priority' | 'status' | 'due_date' | 'module'>>;

export type TaskUploadAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Pending',
  in_progress: 'In Progress',
  done: 'Completed',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export function mapTaskStatusToColumn(status: TaskStatus): TaskColumnKey {
  if (status === 'in_progress') return 'inProgress';
  if (status === 'done') return 'completed';
  return 'backlog';
}

export function formatTaskDueLabel(value?: string | null) {
  if (!value) return undefined;

  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return undefined;
  }
}

export function sanitizeTaskFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_');
}

export function buildTaskSearchValue(task: MobileTask) {
  return [
    task.title,
    task.description,
    task.client_name,
    task.assigned_user_name,
    task.module,
    TASK_STATUS_LABELS[task.status],
    TASK_PRIORITY_LABELS[task.priority],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getTaskPriorityTone(priority: TaskPriority, status: TaskStatus) {
  if (status === 'done') return 'done' as const;
  return priority;
}

export function getTaskAccent(task: MobileTask) {
  if (task.status === 'done') return 'rgba(34, 197, 94, 0.5)';
  if (task.priority === 'high') return '#d7383b';
  if (task.priority === 'medium') return '#9093ff';
  return '#475569';
}

export function getTaskProgress(task: MobileTask) {
  if (task.status === 'done') return 100;
  if (task.status === 'in_progress') return 60;
  return 12;
}

export function sortTasks(tasks: MobileTask[]) {
  return [...tasks].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at).getTime();
    const rightTime = new Date(right.updated_at || right.created_at).getTime();
    return rightTime - leftTime;
  });
}

export function mergeTaskCollections(current: MobileTask[], incoming: MobileTask[]) {
  const byId = new Map<string, MobileTask>();

  for (const item of current) {
    byId.set(item.id, item);
  }

  for (const item of incoming) {
    const previous = byId.get(item.id);
    byId.set(item.id, {
      ...previous,
      ...item,
      syncState: item.syncState ?? previous?.syncState ?? 'synced',
    });
  }

  return sortTasks(Array.from(byId.values()));
}

export function isRetriableTaskError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as any).message)
        : '';

  const normalized = message.toLowerCase();
  return (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('offline') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('connection')
  );
}

function normalizeTaskPerson(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

export function isTaskAssignedToProfile(task: MobileTask, profile: MobileProfile | null) {
  if (!profile) return false;

  if (task.assigned_to_user_id === profile.id) {
    return true;
  }

  const taskAssignee = normalizeTaskPerson(task.assigned_to || task.assigned_user_name);
  const profileName = normalizeTaskPerson(profile.full_name);

  return Boolean(taskAssignee && profileName && taskAssignee === profileName);
}

export function canCreateTasks(profile: MobileProfile | null) {
  if (!profile) return false;
  const role = normalizeRole(profile.role);
  return ['admin', 'team', 'seo', 'content', 'developer', 'client'].includes(role);
}

export function canDeleteTask(profile: MobileProfile | null) {
  if (!profile) return false;
  return normalizeRole(profile.role) === 'admin';
}

export function canEditTask(profile: MobileProfile | null) {
  if (!profile) return false;
  return normalizeRole(profile.role) === 'admin';
}

export function canChangeTaskStatus(profile: MobileProfile | null, task: MobileTask) {
  if (!profile) return false;

  const role = normalizeRole(profile.role);
  if (role === 'admin') return true;

  if (role === 'client') return false;

  return isTaskAssignedToProfile(task, profile);
}

export function canCommentOnTask(profile: MobileProfile | null, task: MobileTask) {
  if (!profile) return false;
  const role = normalizeRole(profile.role);
  if (role === 'admin') return true;
  if (role === 'client') return profile.associated_client_id === task.client_id;
  return isTaskAssignedToProfile(task, profile);
}
