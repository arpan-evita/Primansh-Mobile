import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';

import { useMobileTasks } from '../../hooks/useMobileTasks';
import { useMobileMessages } from '../../hooks/useMobileMessages';
import {
  getCurrentMobileProfile,
  normalizeRole,
  startInstantMeeting,
  type MobileProfile,
} from '../../lib/meetings';
import { useRouter } from 'expo-router';
import { Phone } from 'lucide-react-native';
import {
  type CreateTaskInput,
  type MobileTask,
  type TaskAttachment,
  type TaskComment,
  type TaskFilters,
  type TaskStatus,
  formatTaskDueLabel,
  getTaskAccent,
  getTaskPriorityTone,
  getTaskProgress,
  isTaskAssignedToProfile,
  mapTaskStatusToColumn,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '../../lib/tasks';
import { Colors, Fonts } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

type ViewMode = 'kanban' | 'list';
type ColumnKey = 'backlog' | 'inProgress' | 'completed';

type TaskCard = {
  id: string;
  title: string;
  description?: string;
  priorityLabel: string;
  priorityTone: 'high' | 'medium' | 'low' | 'done';
  accent: string;
  dueLabel?: string;
  comments: number;
  attachments: number;
  tag?: string;
  progress?: number;
  statusNote?: string;
  statusTone?: 'active' | 'urgent' | 'approved';
  team: string[];
  completed?: boolean;
  status: TaskStatus;
};

type ColumnData = {
  key: ColumnKey;
  title: string;
  count: number;
  dot: string;
  badgeBackground: string;
  badgeText: string;
  cards: TaskCard[];
};

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, active: false },
  { key: 'clients', label: 'Clients', icon: Users, active: false },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2, active: true },
  { key: 'assets', label: 'Assets', icon: FolderOpen, active: false },
] as const;

const EMPTY_FILTERS: TaskFilters = {
  status: 'all',
  priority: 'all',
  assignedUserId: 'all',
  clientId: 'all',
};

function getPriorityTheme(tone: TaskCard['priorityTone']) {
  if (tone === 'high') return { background: 'rgba(159, 5, 25, 0.20)', text: '#ff716c' };
  if (tone === 'medium') return { background: 'rgba(144, 147, 255, 0.20)', text: '#cdcdff' };
  if (tone === 'done') return { background: 'rgba(34, 197, 94, 0.20)', text: '#4ade80' };
  return { background: '#191f31', text: '#a6aabc' };
}

function getStatusTheme(tone?: TaskCard['statusTone']) {
  if (tone === 'active') return { color: '#85adff', icon: 'active' as const };
  if (tone === 'urgent') return { color: '#ff716c', icon: 'urgent' as const };
  if (tone === 'approved') return { color: '#4ade80', icon: 'approved' as const };
  return null;
}

function buildTaskCard(task: MobileTask): TaskCard {
  return {
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    priorityLabel: TASK_PRIORITY_LABELS[task.priority],
    priorityTone: getTaskPriorityTone(task.priority, task.status),
    accent: getTaskAccent(task),
    dueLabel: formatTaskDueLabel(task.due_date),
    comments: task.comment_count,
    attachments: task.attachment_count,
    tag: task.syncState === 'pending' ? 'SYNCING' : task.client_name || undefined,
    progress: task.status === 'done' ? undefined : getTaskProgress(task),
    statusNote: task.status === 'done' ? 'Approved' : task.status === 'in_progress' ? 'Active' : undefined,
    statusTone: task.status === 'done' ? 'approved' : task.status === 'in_progress' ? 'active' : undefined,
    team: task.assigned_user_avatar ? [task.assigned_user_avatar] : [],
    completed: task.status === 'done',
    status: task.status,
  };
}

function defaultTaskForm(role: string, profile: MobileProfile | null, clientId?: string) {
  return {
    title: '',
    description: '',
    client_id: clientId || '',
    assigned_to_user_id: role === 'admin' ? null : profile?.id || null,
    priority: 'medium',
    status: 'todo',
    due_date: '',
    module: 'general',
  } satisfies CreateTaskInput;
}

export default function LiveTasksScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const router = useRouter();
  const boardWidth: DimensionValue = isDesktop ? '31.8%' : '100%';
  const {
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
    pendingQueueCount,
    lastSyncedAt,
    refresh,
    loadMore,
    ensureTaskDetails,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    addComment,
    uploadAttachment,
    permissions,
  } = useMobileTasks();
  const role = normalizeRole(profile?.role || 'client');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [composerState, setComposerState] = useState<CreateTaskInput>(defaultTaskForm(role, profile));
  const [detailDraft, setDetailDraft] = useState<Partial<MobileTask> | null>(null);
  const [discussDialog, setDiscussDialog] = useState<{
    task: MobileTask;
    targetName: string;
    profileId: string;
  } | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { createConversationWithProfile, sendTextMessage } = useMobileMessages();

  const availableClients = useMemo(() => {
    if (role === 'admin') return clients;
    if (role === 'client') return clients.filter((item) => item.id === profile?.associated_client_id);
    return clients.filter((item) => item.assigned_team_member_id === profile?.id);
  }, [clients, profile?.associated_client_id, profile?.id, role]);

  const availableAssignees = useMemo(() => {
    if (role === 'admin') return teamMembers;
    return teamMembers.filter((member) => member.id === profile?.id);
  }, [profile?.id, role, teamMembers]);

  const scopedTasks = useMemo(() => {
    if (role === 'admin') return tasks;
    if (role === 'client') {
      return tasks.filter((task) => task.client_id === profile?.associated_client_id);
    }

    return tasks.filter((task) => isTaskAssignedToProfile(task, profile));
  }, [profile, role, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [selectedTaskId, tasks]
  );

  useEffect(() => {
    if (!isComposerOpen) return;
    setComposerState((current) => ({
      ...defaultTaskForm(role, profile, availableClients[0]?.id),
      ...current,
      client_id: current.client_id || availableClients[0]?.id || '',
      assigned_to_user_id:
        role === 'admin'
          ? current.assigned_to_user_id || availableAssignees[0]?.id || null
          : profile?.id || null,
    }));
  }, [availableAssignees, availableClients, isComposerOpen, profile, role]);

  useEffect(() => {
    if (!selectedTask) {
      setDetailDraft(null);
      setCommentDraft('');
      return;
    }

    setDetailDraft({
      title: selectedTask.title,
      description: selectedTask.description,
      priority: selectedTask.priority,
      due_date: selectedTask.due_date,
      assigned_to_user_id: selectedTask.assigned_to_user_id,
      client_id: selectedTask.client_id,
    });
  }, [selectedTask]);

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return scopedTasks.filter((task) => {
      const matchesSearch =
        !term ||
        [
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
          .toLowerCase()
          .includes(term);
      const matchesStatus = filters.status === 'all' || task.status === filters.status;
      const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
      const matchesAssignee =
        filters.assignedUserId === 'all' || task.assigned_to_user_id === filters.assignedUserId;
      const matchesClient = filters.clientId === 'all' || task.client_id === filters.clientId;
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesClient;
    });
  }, [filters, scopedTasks, search]);

  const boardSourceTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return scopedTasks.filter((task) => {
      const matchesSearch =
        !term ||
        [
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
          .toLowerCase()
          .includes(term);
      // IGNORE status filter for the board
      const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
      const matchesAssignee =
        filters.assignedUserId === 'all' || task.assigned_to_user_id === filters.assignedUserId;
      const matchesClient = filters.clientId === 'all' || task.client_id === filters.clientId;
      return matchesSearch && matchesPriority && matchesAssignee && matchesClient;
    });
  }, [filters.assignedUserId, filters.clientId, filters.priority, scopedTasks, search]);

  const board = useMemo<ColumnData[]>(() => {
    const source = boardSourceTasks.map((task) => ({
      task,
      card: buildTaskCard(task),
      column: mapTaskStatusToColumn(task.status),
    }));

    const columns: ColumnData[] = [
      {
        key: 'backlog',
        title: 'Backlog',
        count: source.filter((item) => item.column === 'backlog').length,
        dot: '#64748b',
        badgeBackground: '#1e2538',
        badgeText: '#a6aabc',
        cards: source.filter((item) => item.column === 'backlog').map((item) => item.card),
      },
      {
        key: 'inProgress',
        title: 'In Progress',
        count: source.filter((item) => item.column === 'inProgress').length,
        dot: '#85adff',
        badgeBackground: 'rgba(133, 173, 255, 0.20)',
        badgeText: '#85adff',
        cards: source.filter((item) => item.column === 'inProgress').map((item) => item.card),
      },
      {
        key: 'completed',
        title: 'Completed',
        count: source.filter((item) => item.column === 'completed').length,
        dot: '#22c55e',
        badgeBackground: 'rgba(34, 197, 94, 0.10)',
        badgeText: '#22c55e',
        cards: source.filter((item) => item.column === 'completed').map((item) => item.card),
      },
    ];

    return viewMode === 'kanban' ? columns : columns.filter((column) => column.cards.length > 0);
  }, [viewMode, visibleTasks]);

  const selectedComments = selectedTask ? commentsByTask[selectedTask.id] || [] : [];
  const selectedAttachments = selectedTask ? attachmentsByTask[selectedTask.id] || [] : [];

  const openTask = async (taskId: string) => {
    setSelectedTaskId(taskId);
    await ensureTaskDetails(taskId);
  };

  const handleCreateTask = async () => {
    if (!composerState.title.trim() || !composerState.client_id || (role !== 'client' && !composerState.assigned_to_user_id)) {
      Alert.alert('Missing Details', role === 'client' ? 'Please provide a task title and client.' : 'Please provide a task title, client, and assignee.');
      return;
    }

    const result = await createTask(composerState);
    if (!result.ok) {
      Alert.alert('Task Sync Failed', result.errorMessage || 'This task could not be saved right now.');
      return;
    }

    setComposerState(defaultTaskForm(role, profile, availableClients[0]?.id));
    setIsComposerOpen(false);
  };

  const handleSaveTaskDetail = async () => {
    if (!selectedTask || !detailDraft) return;

    const result = await updateTask(selectedTask.id, {
      title: detailDraft.title?.trim(),
      description: detailDraft.description?.trim(),
      priority: detailDraft.priority as any,
      due_date: detailDraft.due_date || null,
      assigned_to_user_id: detailDraft.assigned_to_user_id || null,
      client_id: detailDraft.client_id || undefined,
    });

    if (!result.ok) {
      Alert.alert('Update Failed', result.errorMessage || 'This task could not be updated.');
      return;
    }

    setSelectedTaskId(null);
  };

  const handleDeleteTask = () => {
    if (!selectedTask) return;
    Alert.alert('Delete Task', 'This task will be removed for all users.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteTask(selectedTask.id);
          if (!result.ok) {
            Alert.alert('Delete Failed', 'This task could not be deleted.');
            return;
          }
          setSelectedTaskId(null);
        },
      },
    ]);
  };

  const handleDiscuss = async (personType: 'team' | 'client', task: MobileTask) => {
    if (personType === 'team') {
      if (!task.assigned_to_user_id) {
        Alert.alert('No Assignee', 'This task is not currently assigned to a team member.');
        return;
      }
      setDiscussDialog({
        task,
        targetName: task.assigned_user_name || 'Team Member',
        profileId: task.assigned_to_user_id,
      });
    } else {
      if (!task.client_id) return;
      
      const clientProfile = await permissions.resolveClientProfile(task.client_id);
      if (!clientProfile) {
        Alert.alert('Client unavailable', 'We could not find a registered user for this client project.');
        return;
      }
      
      setDiscussDialog({
        task,
        targetName: task.client_name || 'Client',
        profileId: clientProfile.id,
      });
    }
  };

  const handleStartCall = async (profileId: string) => {
    if (!profile || !discussDialog) return;
    
    try {
      const meeting = await startInstantMeeting({
        currentProfile: profile,
        participantIds: [profileId],
        title: `Discuss: ${discussDialog.task.title}`,
        isAudioOnly: true,
      });
      
      setDiscussDialog(null);
      router.push(`/portal/meetings/room?id=${meeting.id}&audioOnly=true`);
    } catch (error) {
      console.error('[LiveTasks] startCall failed', error);
      Alert.alert('Call Failed', 'We could not start the call right now.');
    }
  };

  const handleOpenChat = async (profileId: string) => {
    if (!discussDialog) return;
    
    try {
      const taskTitle = discussDialog.task.title;
      setDiscussDialog(null);
      
      // 1. Create/Navigate to conversation
      const conversationId = await createConversationWithProfile(profileId);
      if (!conversationId) throw new Error('Could not open chat');
      
      // 2. Send context message
      await sendTextMessage(`Discussing task: "${taskTitle}"`, conversationId);
      
      // 3. Switch to messages tab
      router.push('/messages');
    } catch (error) {
      console.error('[LiveTasks] openChat failed', error);
      Alert.alert('Chat Unavailable', 'We could not open the chat for this person.');
    }
  };

  const handleSidebarNav = (key: (typeof SIDEBAR_ITEMS)[number]['key']) => {
    setIsSidebarOpen(false);
    switch (key) {
      case 'dashboard':
        router.push('/');
        break;
      case 'clients':
        router.push('/clients');
        break;
      case 'tasks':
        // Already here
        break;
      case 'assets':
        router.push('/docs');
        break;
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const handlePickAttachment = async () => {
    if (!selectedTask) return;

    let DocumentPicker: typeof import('expo-document-picker');
    try {
      DocumentPicker = require('expo-document-picker');
    } catch {
      Alert.alert('Attachment Picker Unavailable', 'Rebuild the app to enable task attachments.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    await uploadAttachment(selectedTask.id, {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size || null,
    });
  };

  if (loading && tasks.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingShell}>
          <ActivityIndicator size="large" color="#85adff" />
          <Text style={styles.loadingText}>Synchronizing task board...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundGlow} />

      <View style={styles.headerShell}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => setIsSidebarOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Menu color="#85adff" size={20} />
            </TouchableOpacity>
            <Text style={styles.headerBrand}>Agency OS</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setViewMode('kanban')}
                style={[styles.modeButton, viewMode === 'kanban' && styles.modeButtonActive]}
              >
                <LayoutGrid color={viewMode === 'kanban' ? '#85adff' : '#a6aabc'} size={14} />
                <Text style={[styles.modeButtonText, viewMode === 'kanban' && styles.modeButtonTextActive]}>Kanban</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setViewMode('list')}
                style={[styles.modeButton, viewMode === 'list' && styles.modeButtonActive]}
              >
                <List color={viewMode === 'list' ? '#85adff' : '#a6aabc'} size={14} />
                <Text style={[styles.modeButtonText, viewMode === 'list' && styles.modeButtonTextActive]}>List</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.85} style={styles.botButton} onPress={() => setIsFilterOpen(true)}>
              <Bot color="#85adff" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.layout}>
        {isDesktop ? <DesktopSidebar profile={profile} /> : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.accent} />}
          onScroll={({ nativeEvent }) => {
            const reachedBottom =
              nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
              nativeEvent.contentSize.height - 240;
            if (reachedBottom && hasMore && !loadingMore) {
              void loadMore();
            }
          }}
          scrollEventThrottle={32}
        >
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.pageTitle}>Active Projects</Text>
              <Text style={styles.pageSubtitle}>
                {pendingQueueCount > 0
                  ? `${pendingQueueCount} updates queued while offline.`
                  : `Managing ${visibleTasks.length} tasks across ${availableClients.length || clients.length} active client projects.`}
              </Text>
              <Text style={styles.metaLine}>
                {lastSyncedAt ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Waiting for initial sync'}
              </Text>
            </View>

            <View style={styles.pageActions}>
              <View style={styles.searchWrap}>
                <Search color="#a6aabc" size={16} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search tasks..."
                  placeholderTextColor="rgba(166,170,188,0.5)"
                  style={styles.searchInput}
                />
              </View>

              {permissions.canCreateTasks ? (
                <TouchableOpacity activeOpacity={0.9} style={styles.newTaskButton} onPress={() => setIsComposerOpen(true)}>
                  <Plus color="#000000" size={16} />
                  <Text style={styles.newTaskButtonText}>New Task</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.boardGrid}>
            {board.map((column) => (
              <View key={column.key} style={[styles.column, { width: viewMode === 'list' ? '100%' : boardWidth }]}>
                <View style={styles.columnHeader}>
                  <View style={styles.columnTitleWrap}>
                    <View style={[styles.columnDot, { backgroundColor: column.dot }]} />
                    <Text style={styles.columnTitle}>{column.title}</Text>
                    <View style={[styles.columnBadge, { backgroundColor: column.badgeBackground }]}>
                      <Text style={[styles.columnBadgeText, { color: column.badgeText }]}>{column.count}</Text>
                    </View>
                  </View>

                  <TouchableOpacity activeOpacity={0.85} onPress={() => setIsFilterOpen(true)}>
                    <MoreHorizontal color="#a6aabc" size={18} />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardStack}>
                  {column.cards.map((card) => (
                    <TaskCardView 
                      key={card.id} 
                      card={card} 
                      onPress={() => void openTask(card.id)} 
                      onStatusToggle={(status) => void updateTaskStatus(card.id, status)}
                      onDiscussTeam={() => {
                        const task = boardSourceTasks.find(t => t.id === card.id);
                        if (task) void handleDiscuss('team', task);
                      }}
                      onDiscussClient={() => {
                        const task = boardSourceTasks.find(t => t.id === card.id);
                        if (task) void handleDiscuss('client', task);
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>

          {loadingMore ? (
            <View style={styles.loadMoreWrap}>
              <ActivityIndicator color="#85adff" />
            </View>
          ) : null}
        </ScrollView>
      </View>

      {permissions.canCreateTasks ? (
        <TouchableOpacity activeOpacity={0.9} style={styles.fabWrap} onPress={() => setIsComposerOpen(true)}>
          <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Plus color="#000000" size={26} />
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      <TaskFiltersModal
        visible={isFilterOpen}
        filters={filters}
        clients={availableClients}
        teamMembers={availableAssignees}
        onClose={() => setIsFilterOpen(false)}
        onChange={setFilters}
      />

      <TaskComposerModal
        visible={isComposerOpen}
        form={composerState}
        clients={availableClients}
        teamMembers={availableAssignees}
        role={role}
        onClose={() => setIsComposerOpen(false)}
        onChange={setComposerState}
        onSubmit={() => void handleCreateTask()}
      />

      <TaskDetailModal
        visible={!!selectedTask}
        task={selectedTask}
        detailDraft={detailDraft}
        comments={selectedComments}
        attachments={selectedAttachments}
        canEdit={!!selectedTask && permissions.canEditTask(selectedTask)}
        canDelete={!!selectedTask && permissions.canDeleteTask(selectedTask)}
        canChangeStatus={!!selectedTask && permissions.canChangeTaskStatus(selectedTask)}
        canComment={!!selectedTask && permissions.canCommentOnTask(selectedTask)}
        assignees={role === 'admin' ? teamMembers : availableAssignees}
        clients={availableClients}
        commentDraft={commentDraft}
        onCommentDraftChange={setCommentDraft}
        onDraftChange={setDetailDraft}
        onClose={() => setSelectedTaskId(null)}
        onStatusChange={(status) => selectedTask ? void updateTaskStatus(selectedTask.id, status) : undefined}
        onSave={() => void handleSaveTaskDetail()}
        onDelete={handleDeleteTask}
        onCommentSubmit={async () => {
          if (!selectedTask || !commentDraft.trim()) return;
          const result = await addComment(selectedTask.id, commentDraft);
          if (result.ok) setCommentDraft('');
        }}
        onAttachmentPress={() => void handlePickAttachment()}
        onAttachmentOpen={(url) => void Linking.openURL(url)}
      />
      <Modal
        animationType="fade"
        transparent
        visible={!!discussDialog}
        onRequestClose={() => setDiscussDialog(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
            onPress={() => setDiscussDialog(null)} 
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Discuss Task</Text>
                <Text style={styles.modalSubtitle}>With {discussDialog?.targetName}</Text>
              </View>
              <TouchableOpacity onPress={() => setDiscussDialog(null)} style={styles.iconButtonSmall}>
                <X color="#fff" size={16} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, gap: 12 }}>
              <TouchableOpacity 
                style={styles.discussOption} 
                onPress={() => discussDialog && handleStartCall(discussDialog.profileId)}
              >
                <View style={[styles.discussIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Phone color="#22c55e" size={20} />
                </View>
                <View>
                  <Text style={styles.discussOptionTitle}>Discuss on Call</Text>
                  <Text style={styles.discussOptionSubtitle}>Start an instant audio room</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.discussOption} 
                onPress={() => discussDialog && handleOpenChat(discussDialog.profileId)}
              >
                <View style={[styles.discussIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <MessageSquare color="#3b82f6" size={20} />
                </View>
                <View>
                  <Text style={styles.discussOptionTitle}>Discuss on Message</Text>
                  <Text style={styles.discussOptionSubtitle}>Open chat with task tag</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="none"
        transparent
        visible={isSidebarOpen}
        onRequestClose={() => setIsSidebarOpen(false)}
      >
        <View style={styles.sidebarOverlay}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.sidebarBackdrop} 
            onPress={() => setIsSidebarOpen(false)}
          />
          <View style={styles.sidebarMobile}>
            <View style={styles.sidebarMobileContent}>
              <View style={styles.sidebarProfile}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.sidebarAvatar} />
                ) : (
                  <View style={[styles.sidebarAvatar, styles.sidebarAvatarFallback]}>
                    <Text style={styles.sidebarAvatarText}>{profile?.full_name?.[0] || 'U'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sidebarName} numberOfLines={1}>{profile?.full_name || 'Agency Operator'}</Text>
                  <Text style={styles.sidebarRole}>{(profile?.role || 'client').toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={styles.iconButtonSmall}>
                  <X color="#94a3b8" size={16} />
                </TouchableOpacity>
              </View>

              <View style={styles.sidebarNav}>
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={0.85}
                      style={[styles.sidebarItem, item.active && styles.sidebarItemActive]}
                      onPress={() => handleSidebarNav(item.key)}
                    >
                      <Icon color={item.active ? '#85adff' : '#94a3b8'} size={20} />
                      <Text style={[styles.sidebarItemText, item.active && styles.sidebarItemTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 'auto', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 20 }}>
                <TouchableOpacity 
                  activeOpacity={0.85} 
                  style={styles.sidebarItem} 
                  onPress={handleLogout}
                >
                  <LogOut color="#ff716c" size={20} />
                  <Text style={[styles.sidebarItemText, { color: '#ff716c' }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DesktopSidebar({ profile }: { profile: MobileProfile | null }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarProfile}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.sidebarAvatar} />
        ) : (
          <View style={[styles.sidebarAvatar, styles.sidebarAvatarFallback]}>
            <Text style={styles.sidebarAvatarText}>{profile?.full_name?.[0] || 'U'}</Text>
          </View>
        )}
        <View>
          <Text style={styles.sidebarName}>{profile?.full_name || 'Agency Operator'}</Text>
          <Text style={styles.sidebarRole}>{(profile?.role || 'client').toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.sidebarNav}>
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              style={[styles.sidebarItem, item.active && styles.sidebarItemActive]}
            >
              <Icon color={item.active ? '#85adff' : '#94a3b8'} size={18} />
              <Text style={[styles.sidebarItemText, item.active && styles.sidebarItemTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TaskCardView({
  card,
  onPress,
  onStatusToggle,
  onDiscussTeam,
  onDiscussClient,
}: {
  card: TaskCard;
  onPress: () => void;
  onStatusToggle: (status: TaskStatus) => void;
  onDiscussTeam: () => void;
  onDiscussClient: () => void;
}) {
  const priorityTheme = getPriorityTheme(card.priorityTone);
  const statusTheme = getStatusTheme(card.statusTone);

  const renderStatusButton = () => {
    if (card.status === 'todo') {
      return (
        <TouchableOpacity
          style={styles.quickStatusButton}
          onPress={(e) => {
            e.stopPropagation();
            onStatusToggle('in_progress');
          }}
        >
          <RefreshCw color="#85adff" size={12} />
          <Text style={styles.quickStatusButtonText}>Start</Text>
        </TouchableOpacity>
      );
    }
    if (card.status === 'in_progress') {
      return (
        <TouchableOpacity
          style={[styles.quickStatusButton, styles.quickStatusButtonDone]}
          onPress={(e) => {
            e.stopPropagation();
            onStatusToggle('done');
          }}
        >
          <CheckCircle2 color="#4ade80" size={12} />
          <Text style={[styles.quickStatusButtonText, styles.quickStatusButtonTextDone]}>Finish</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={styles.quickStatusButton}
        onPress={(e) => {
          e.stopPropagation();
          onStatusToggle('in_progress');
        }}
      >
        <RefreshCw color="#94a3b8" size={12} />
        <Text style={styles.quickStatusButtonText}>Reopen</Text>
      </TouchableOpacity>
    );
  };

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      <View style={[styles.taskCard, { borderLeftColor: card.accent }, card.completed && styles.taskCardDone]}>
        {card.progress ? (
          <LinearGradient
            colors={['#85adff', '#9093ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressStripe}
          />
        ) : null}

        <View style={styles.taskCardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.priorityBadge, { backgroundColor: priorityTheme.background }]}>
              <Text style={[styles.priorityBadgeText, { color: priorityTheme.text }]}>{card.priorityLabel}</Text>
            </View>
            {renderStatusButton()}
          </View>

          <TouchableOpacity
            style={styles.avatarCluster}
            onPress={(e) => {
              e.stopPropagation();
              onDiscussTeam();
            }}
          >
            {card.team.slice(0, 2).map((avatar, index) => (
              <Image
                key={`${card.id}-${index}`}
                source={{ uri: avatar }}
                style={[styles.teamAvatar, index > 0 && styles.teamAvatarOverlap]}
              />
            ))}
          </TouchableOpacity>
        </View>

        <Text style={[styles.taskTitle, card.completed && styles.taskTitleDone]}>{card.title}</Text>
        {card.description ? <Text style={styles.taskDescription}>{card.description}</Text> : null}

        {card.progress ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Current Progress</Text>
              <Text style={styles.progressValue}>{card.progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#85adff', '#9093ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${card.progress}%` }]}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.taskFooter}>
          {card.dueLabel ? (
            <View style={styles.footerMetaRow}>
              <CalendarDays color="#a6aabc" size={13} />
              <Text style={styles.footerMetaText}>{card.dueLabel}</Text>
            </View>
          ) : statusTheme ? (
            <View style={styles.footerMetaRow}>
              {statusTheme.icon === 'active' ? <RefreshCw color={statusTheme.color} size={13} /> : null}
              {statusTheme.icon === 'urgent' ? <AlertTriangle color={statusTheme.color} size={13} /> : null}
              {statusTheme.icon === 'approved' ? <CheckCircle2 color={statusTheme.color} size={13} /> : null}
              <Text style={[styles.statusText, { color: statusTheme.color }]}>{card.statusNote}</Text>
            </View>
          ) : (
            <View />
          )}

          <View style={styles.footerRight}>
            <View style={styles.footerMetaRow}>
              <MessageSquare color="#a6aabc" size={13} />
              <Text style={styles.footerMetaText}>{card.comments}</Text>
            </View>
            <View style={styles.footerMetaRow}>
              <Paperclip color="#a6aabc" size={13} />
              <Text style={styles.footerMetaText}>{card.attachments}</Text>
            </View>
            {card.tag ? (
              <TouchableOpacity
                style={styles.tagBadge}
                onPress={(e) => {
                  e.stopPropagation();
                  onDiscussClient();
                }}
              >
                <Text style={styles.tagText}>{card.tag}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

type PickerOption = {
  id: string;
  label: string;
};

type ExpandedComposerPanel = 'client' | 'assignee' | 'dueDate' | null;

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parseTaskDateValue(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((item) => Number(item));
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatTaskDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTaskDateDisplay(value?: string | null) {
  const parsed = parseTaskDateValue(value);
  if (!parsed) return 'Select due date';

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function resolveCalendarMonth(value?: string | null) {
  const parsed = parseTaskDateValue(value) || new Date();
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

function buildCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(gridStart);
    value.setDate(gridStart.getDate() + index);

    return {
      key: `${month.getFullYear()}-${month.getMonth()}-${index}`,
      label: value.getDate(),
      value: formatTaskDateValue(value),
      inMonth: value.getMonth() === month.getMonth(),
    };
  });
}

function PickerField({
  value,
  placeholder,
  onPress,
  disabled,
  icon,
}: {
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.88}
      disabled={disabled}
      onPress={onPress}
      style={[styles.selectorField, disabled && styles.selectorFieldDisabled]}
    >
      <View style={styles.selectorFieldContent}>
        {icon ? <View style={styles.selectorFieldIcon}>{icon}</View> : null}
        <Text style={[styles.selectorFieldText, !value && styles.selectorFieldPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      <ChevronDown color={disabled ? '#475569' : '#94a3b8'} size={16} />
    </TouchableOpacity>
  );
}

function PickerOptionsPanel({
  options,
  selectedValue,
  onSelect,
}: {
  options: PickerOption[];
  selectedValue?: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.selectorPanel}>
      <ScrollView nestedScrollEnabled style={styles.selectorPanelScroll} showsVerticalScrollIndicator={false}>
        {options.map((option) => {
          const active = option.id === selectedValue;
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.88}
              style={[styles.selectorOption, active && styles.selectorOptionActive]}
              onPress={() => onSelect(option.id)}
            >
              <Text style={[styles.selectorOptionText, active && styles.selectorOptionTextActive]}>{option.label}</Text>
              {active ? <Check color="#85adff" size={16} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CalendarPanel({
  month,
  selectedDate,
  onMonthChange,
  onSelect,
  onClear,
}: {
  month: Date;
  selectedDate?: string | null;
  onMonthChange: (month: Date) => void;
  onSelect: (value: string) => void;
  onClear: () => void;
}) {
  const days = useMemo(() => buildCalendarDays(month), [month]);

  return (
    <View style={styles.calendarPanel}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          style={styles.calendarNavButton}
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <ChevronLeft color="#94a3b8" size={16} />
        </TouchableOpacity>
        <Text style={styles.calendarMonthLabel}>
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity
          style={styles.calendarNavButton}
          onPress={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <ChevronRight color="#94a3b8" size={16} />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarWeekdays}>
        {CALENDAR_WEEKDAYS.map((label) => (
          <Text key={label} style={styles.calendarWeekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {days.map((day) => {
          const active = selectedDate === day.value;
          return (
            <TouchableOpacity
              key={day.key}
              activeOpacity={0.88}
              style={[
                styles.calendarCell,
                !day.inMonth && styles.calendarCellMuted,
                active && styles.calendarCellActive,
              ]}
              onPress={() => onSelect(day.value)}
            >
              <Text
                style={[
                  styles.calendarCellText,
                  !day.inMonth && styles.calendarCellTextMuted,
                  active && styles.calendarCellTextActive,
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.calendarClearButton} onPress={onClear}>
        <Text style={styles.calendarClearButtonText}>Clear date</Text>
      </TouchableOpacity>
    </View>
  );
}

function TaskFiltersModal({
  visible,
  filters,
  clients,
  teamMembers,
  onClose,
  onChange,
}: {
  visible: boolean;
  filters: TaskFilters;
  clients: { id: string; firm_name: string }[];
  teamMembers: { id: string; full_name?: string | null }[];
  onClose: () => void;
  onChange: (filters: TaskFilters) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>Task Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconButtonSmall}>
              <X color="#94a3b8" size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSectionLabel}>Status</Text>
          <View style={styles.chipWrap}>
            <FilterChip label="All Statuses" active={filters.status === 'all'} onPress={() => onChange({ ...filters, status: 'all' })} />
            <FilterChip label="Pending" active={filters.status === 'todo'} onPress={() => onChange({ ...filters, status: 'todo' })} />
            <FilterChip label="In Progress" active={filters.status === 'in_progress'} onPress={() => onChange({ ...filters, status: 'in_progress' })} />
            <FilterChip label="Completed" active={filters.status === 'done'} onPress={() => onChange({ ...filters, status: 'done' })} />
          </View>
          <Text style={styles.modalSectionLabel}>Priority</Text>
          <View style={styles.chipWrap}>
            <FilterChip label="All Priorities" active={filters.priority === 'all'} onPress={() => onChange({ ...filters, priority: 'all' })} />
            <FilterChip label="High" active={filters.priority === 'high'} onPress={() => onChange({ ...filters, priority: 'high' })} />
            <FilterChip label="Medium" active={filters.priority === 'medium'} onPress={() => onChange({ ...filters, priority: 'medium' })} />
            <FilterChip label="Low" active={filters.priority === 'low'} onPress={() => onChange({ ...filters, priority: 'low' })} />
          </View>
          <Text style={styles.modalSectionLabel}>Assignee</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipWrap}>
            <FilterChip label="All Team" active={filters.assignedUserId === 'all'} onPress={() => onChange({ ...filters, assignedUserId: 'all' })} />
            {teamMembers.map((member) => (
              <FilterChip
                key={member.id}
                label={member.full_name || 'Member'}
                active={filters.assignedUserId === member.id}
                onPress={() => onChange({ ...filters, assignedUserId: member.id })}
              />
            ))}
          </ScrollView>
          <Text style={styles.modalSectionLabel}>Client</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipWrap}>
            <FilterChip label="All Clients" active={filters.clientId === 'all'} onPress={() => onChange({ ...filters, clientId: 'all' })} />
            {clients.map((client) => (
              <FilterChip
                key={client.id}
                label={client.firm_name}
                active={filters.clientId === client.id}
                onPress={() => onChange({ ...filters, clientId: client.id })}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TaskComposerModal({
  visible,
  form,
  clients,
  teamMembers,
  role,
  onClose,
  onChange,
  onSubmit,
}: {
  visible: boolean;
  form: CreateTaskInput;
  clients: { id: string; firm_name: string }[];
  teamMembers: { id: string; full_name?: string | null }[];
  role: string;
  onClose: () => void;
  onChange: React.Dispatch<React.SetStateAction<CreateTaskInput>>;
  onSubmit: () => void;
}) {
  const [expandedPanel, setExpandedPanel] = useState<ExpandedComposerPanel>(null);
  const [calendarMonth, setCalendarMonth] = useState(resolveCalendarMonth(form.due_date));

  const clientOptions = useMemo<PickerOption[]>(
    () => clients.map((client) => ({ id: client.id, label: client.firm_name })),
    [clients]
  );
  const assigneeOptions = useMemo<PickerOption[]>(
    () => teamMembers.map((member) => ({ id: member.id, label: member.full_name || 'Member' })),
    [teamMembers]
  );
  const selectedClientLabel =
    clientOptions.find((option) => option.id === form.client_id)?.label || null;
  const selectedAssigneeLabel =
    assigneeOptions.find((option) => option.id === form.assigned_to_user_id)?.label || null;

  useEffect(() => {
    if (!visible) {
      setExpandedPanel(null);
      return;
    }

    setCalendarMonth(resolveCalendarMonth(form.due_date));
  }, [form.due_date, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
          <Pressable style={styles.modalCardLarge} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>New Task</Text>
              <TouchableOpacity onPress={onClose} style={styles.iconButtonSmall}>
                <X color="#94a3b8" size={16} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput 
                value={form.title} 
                onChangeText={(value) => onChange((current) => ({ ...current, title: value }))} 
                placeholder="Task title" 
                placeholderTextColor="#64748b" 
                style={styles.modalInput} 
              />
              <TextInput 
                value={form.description || ''} 
                onChangeText={(value) => onChange((current) => ({ ...current, description: value }))} 
                placeholder="Description" 
                placeholderTextColor="#64748b" 
                style={[styles.modalInput, styles.modalTextarea]} 
                multiline 
              />
              <Text style={styles.modalSectionLabel}>Client</Text>
              <View style={{ zIndex: 10 }}>
                <PickerField
                  value={selectedClientLabel}
                  placeholder="Select client"
                  onPress={() => setExpandedPanel((current) => (current === 'client' ? null : 'client'))}
                />
                {expandedPanel === 'client' ? (
                  <PickerOptionsPanel
                    options={clientOptions}
                    selectedValue={form.client_id}
                    onSelect={(value) => {
                      onChange((current) => ({ ...current, client_id: value }));
                      setExpandedPanel(null);
                    }}
                  />
                ) : null}
              </View>
              <Text style={styles.modalSectionLabel}>Priority</Text>
              <View style={styles.chipWrap}>
                <FilterChip label="High" active={form.priority === 'high'} onPress={() => onChange((current) => ({ ...current, priority: 'high' }))} />
                <FilterChip label="Medium" active={form.priority === 'medium'} onPress={() => onChange((current) => ({ ...current, priority: 'medium' }))} />
                <FilterChip label="Low" active={form.priority === 'low'} onPress={() => onChange((current) => ({ ...current, priority: 'low' }))} />
              </View>
              <Text style={styles.modalSectionLabel}>Assignee</Text>
              <View style={{ zIndex: 9 }}>
                <PickerField
                  value={selectedAssigneeLabel}
                  placeholder={role === 'client' ? 'Assigned by agency' : 'Select team member'}
                  onPress={() => setExpandedPanel((current) => (current === 'assignee' ? null : 'assignee'))}
                  disabled={assigneeOptions.length === 0}
                />
                {expandedPanel === 'assignee' ? (
                  <PickerOptionsPanel
                    options={assigneeOptions}
                    selectedValue={form.assigned_to_user_id}
                    onSelect={(value) => {
                      onChange((current) => ({ ...current, assigned_to_user_id: value }));
                      setExpandedPanel(null);
                    }}
                  />
                ) : null}
              </View>
              <Text style={styles.modalSectionLabel}>Due Date</Text>
              <View style={{ zIndex: expandedPanel === 'dueDate' ? 50 : 8 }}>
                <PickerField
                  value={form.due_date ? formatTaskDateDisplay(form.due_date) : null}
                  placeholder="Select due date"
                  icon={<CalendarDays color="#94a3b8" size={16} />}
                  onPress={() => setExpandedPanel((current) => (current === 'dueDate' ? null : 'dueDate'))}
                />
                {expandedPanel === 'dueDate' ? (
                  <CalendarPanel
                    month={calendarMonth}
                    selectedDate={form.due_date}
                    onMonthChange={setCalendarMonth}
                    onSelect={(value) => {
                      onChange((current) => ({ ...current, due_date: value }));
                      setExpandedPanel(null);
                    }}
                    onClear={() => {
                      onChange((current) => ({ ...current, due_date: null }));
                      setExpandedPanel(null);
                    }}
                  />
                ) : null}
              </View>
            </ScrollView>
            <View style={styles.stickyModalFooter}>
              <TouchableOpacity style={styles.primaryModalButtonSticky} onPress={onSubmit}>
                <Text style={styles.primaryModalButtonText}>{role === 'client' ? 'Submit Request' : 'Create Task'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function TaskDetailModal({
  visible,
  task,
  detailDraft,
  comments,
  attachments,
  canEdit,
  canDelete,
  canChangeStatus,
  canComment,
  assignees,
  clients,
  commentDraft,
  onCommentDraftChange,
  onDraftChange,
  onClose,
  onStatusChange,
  onSave,
  onDelete,
  onCommentSubmit,
  onAttachmentPress,
  onAttachmentOpen,
}: {
  visible: boolean;
  task: MobileTask | null;
  detailDraft: Partial<MobileTask> | null;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canComment: boolean;
  assignees: { id: string; full_name?: string | null }[];
  clients: { id: string; firm_name: string }[];
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<Partial<MobileTask> | null>>;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onSave: () => void;
  onDelete: () => void;
  onCommentSubmit: () => void;
  onAttachmentPress: () => void;
  onAttachmentOpen: (url: string) => void;
}) {
  const [expandedPanel, setExpandedPanel] = useState<ExpandedComposerPanel>(null);
  const [calendarMonth, setCalendarMonth] = useState(resolveCalendarMonth(detailDraft?.due_date));

  const clientOptions = useMemo<PickerOption[]>(
    () => clients.map((client) => ({ id: client.id, label: client.firm_name })),
    [clients]
  );
  const assigneeOptions = useMemo<PickerOption[]>(
    () => assignees.map((member) => ({ id: member.id, label: member.full_name || 'Member' })),
    [assignees]
  );
  const selectedClientLabel =
    clientOptions.find((option) => option.id === detailDraft?.client_id)?.label || null;
  const selectedAssigneeLabel =
    assigneeOptions.find((option) => option.id === detailDraft?.assigned_to_user_id)?.label || null;

  useEffect(() => {
    if (!visible) {
      setExpandedPanel(null);
      return;
    }

    setCalendarMonth(resolveCalendarMonth(detailDraft?.due_date));
  }, [detailDraft?.due_date, visible]);

  if (!task || !detailDraft) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
          <Pressable style={styles.modalCardTall} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>Task Details</Text>
              <TouchableOpacity onPress={onClose} style={styles.iconButtonSmall}>
                <X color="#94a3b8" size={16} />
              </TouchableOpacity>
            </View>
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                value={detailDraft.title || ''}
                editable={canEdit}
                onChangeText={(value) => onDraftChange((current) => ({ ...(current || {}), title: value }))}
                style={[styles.modalInput, !canEdit && styles.readonlyInput]}
                placeholder="Task title"
                placeholderTextColor="#64748b"
              />
              <TextInput
                value={detailDraft.description || ''}
                editable={canEdit}
                onChangeText={(value) => onDraftChange((current) => ({ ...(current || {}), description: value }))}
                style={[styles.modalInput, styles.modalTextarea, !canEdit && styles.readonlyInput]}
                placeholder="Description"
                placeholderTextColor="#64748b"
                multiline
              />
              <Text style={styles.modalSectionLabel}>Status</Text>
              <View style={styles.chipWrap}>
                <FilterChip label="Pending" active={task.status === 'todo'} onPress={() => canChangeStatus && onStatusChange('todo')} />
                <FilterChip label="In Progress" active={task.status === 'in_progress'} onPress={() => canChangeStatus && onStatusChange('in_progress')} />
                <FilterChip label="Completed" active={task.status === 'done'} onPress={() => canChangeStatus && onStatusChange('done')} />
              </View>
              <Text style={styles.modalSectionLabel}>Priority</Text>
              <View style={styles.chipWrap}>
                {(['high', 'medium', 'low'] as const).map((priority) => (
                  <FilterChip
                    key={priority}
                    label={priority.toUpperCase()}
                    active={detailDraft.priority === priority}
                    onPress={() => canEdit && onDraftChange((current) => ({ ...(current || {}), priority }))}
                  />
                ))}
              </View>
              <Text style={styles.modalSectionLabel}>Client</Text>
              <View style={{ zIndex: 10 }}>
                <PickerField
                  value={selectedClientLabel}
                  placeholder="Select client"
                  disabled={!canEdit}
                  onPress={() => setExpandedPanel((current) => (current === 'client' ? null : 'client'))}
                />
                {expandedPanel === 'client' ? (
                  <PickerOptionsPanel
                    options={clientOptions}
                    selectedValue={detailDraft.client_id}
                    onSelect={(value) => {
                      onDraftChange((current) => ({ ...(current || {}), client_id: value }));
                      setExpandedPanel(null);
                    }}
                  />
                ) : null}
              </View>
              <Text style={styles.modalSectionLabel}>Assignee</Text>
              <View style={{ zIndex: 9 }}>
                <PickerField
                  value={selectedAssigneeLabel}
                  placeholder="Select team member"
                  disabled={!canEdit || assigneeOptions.length === 0}
                  onPress={() => setExpandedPanel((current) => (current === 'assignee' ? null : 'assignee'))}
                />
                {expandedPanel === 'assignee' ? (
                  <PickerOptionsPanel
                    options={assigneeOptions}
                    selectedValue={detailDraft.assigned_to_user_id}
                    onSelect={(value) => {
                      onDraftChange((current) => ({ ...(current || {}), assigned_to_user_id: value }));
                      setExpandedPanel(null);
                    }}
                  />
                ) : null}
              </View>
              <Text style={styles.modalSectionLabel}>Due Date</Text>
              <View style={{ zIndex: expandedPanel === 'dueDate' ? 50 : 8 }}>
                <PickerField
                  value={detailDraft.due_date ? formatTaskDateDisplay(detailDraft.due_date) : null}
                  placeholder="Select due date"
                  disabled={!canEdit}
                  icon={<CalendarDays color="#94a3b8" size={16} />}
                  onPress={() => setExpandedPanel((current) => (current === 'dueDate' ? null : 'dueDate'))}
                />
                {expandedPanel === 'dueDate' ? (
                  <CalendarPanel
                    month={calendarMonth}
                    selectedDate={detailDraft.due_date}
                    onMonthChange={setCalendarMonth}
                    onSelect={(value) => {
                      onDraftChange((current) => ({ ...(current || {}), due_date: value }));
                      setExpandedPanel(null);
                    }}
                    onClear={() => {
                      onDraftChange((current) => ({ ...(current || {}), due_date: null }));
                      setExpandedPanel(null);
                    }}
                  />
                ) : null}
              </View>
              <View style={styles.modalSectionRow}>
                <Text style={styles.modalSectionLabel}>Attachments</Text>
                {canComment ? (
                  <TouchableOpacity onPress={onAttachmentPress}>
                    <Text style={styles.inlineActionText}>Add</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {attachments.length === 0 ? (
                <Text style={styles.emptyText}>No attachments yet.</Text>
              ) : (
                attachments.map((attachment) => (
                  <TouchableOpacity
                    key={attachment.id}
                    style={styles.attachmentRow}
                    onPress={() => attachment.file_url ? onAttachmentOpen(attachment.file_url) : undefined}
                  >
                    <Paperclip color="#85adff" size={16} />
                    <Text style={styles.attachmentName}>{attachment.file_name}</Text>
                  </TouchableOpacity>
                ))
              )}
              <Text style={styles.modalSectionLabel}>Comments</Text>
              {comments.length === 0 ? (
                <Text style={styles.emptyText}>No comments yet.</Text>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <Text style={styles.commentAuthor}>{comment.author?.full_name || 'Operator'}</Text>
                    <Text style={styles.commentBody}>{comment.body}</Text>
                  </View>
                ))
              )}
              {canComment ? (
                <>
                  <TextInput
                    value={commentDraft}
                    onChangeText={onCommentDraftChange}
                    style={[styles.modalInput, styles.modalTextarea]}
                    placeholder="Add a comment"
                    placeholderTextColor="#64748b"
                    multiline
                  />
                  <TouchableOpacity style={styles.secondaryModalButton} onPress={onCommentSubmit}>
                    <Text style={styles.secondaryModalButtonText}>Post Comment</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
            <View style={styles.stickyModalFooter}>
              {canDelete ? (
                <TouchableOpacity style={styles.dangerButton} onPress={onDelete}>
                  <Trash2 color="#ff716c" size={16} />
                  <Text style={styles.dangerButtonText}>Delete</Text>
                </TouchableOpacity>
              ) : <View />}
              {canEdit ? (
                <TouchableOpacity style={styles.primaryModalButtonSticky} onPress={onSave}>
                  <Text style={styles.primaryModalButtonText}>Save</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#a6aabc',
    fontFamily: Fonts.Outfit_500Medium,
  },
  backgroundGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(133,173,255,0.08)',
  },
  headerShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'rgba(9, 14, 27, 0.74)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  header: {
    height: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerBrand: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#85adff',
    letterSpacing: -0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#0d1321',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#1e2538',
  },
  modeButtonText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
    color: '#a6aabc',
  },
  modeButtonTextActive: {
    color: '#85adff',
  },
  botButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 18, 0.7)',
  },
  sidebarMobile: {
    width: 280,
    height: '100%',
    backgroundColor: '#090e1b',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  sidebarMobileContent: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sidebar: {
    width: 248,
    paddingTop: 86,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#090e1b',
  },
  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  sidebarAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sidebarAvatarFallback: {
    backgroundColor: '#1e2538',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarAvatarText: {
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_700Bold,
  },
  sidebarName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#e4e7fb',
  },
  sidebarRole: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
  },
  sidebarNav: {
    gap: 6,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(133,173,255,0.10)',
    borderLeftWidth: 2,
    borderLeftColor: '#85adff',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  sidebarItemText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    color: '#94a3b8',
  },
  sidebarItemTextActive: {
    color: '#85adff',
  },
  content: {
    paddingTop: 96,
    paddingHorizontal: 20,
    paddingBottom: 140,
    flexGrow: 1,
  },
  contentDesktop: {
    paddingHorizontal: 28,
  },
  pageHeader: {
    marginBottom: 24,
    gap: 18,
  },
  pageTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 34,
    color: '#e4e7fb',
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    color: '#a6aabc',
  },
  metaLine: {
    marginTop: 6,
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 12,
    color: '#64748b',
  },
  pageActions: {
    gap: 12,
  },
  searchWrap: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0d1321',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
  },
  newTaskButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#85adff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  newTaskButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#000000',
  },
  boardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  column: {
    gap: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  columnTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  columnTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#e4e7fb',
  },
  columnBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  columnBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
  },
  cardStack: {
    gap: 12,
  },
  taskCard: {
    position: 'relative',
    backgroundColor: '#131929',
    borderRadius: 18,
    padding: 18,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  taskCardDone: {
    backgroundColor: 'rgba(19,25,41,0.55)',
    opacity: 0.85,
  },
  progressStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  taskCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  avatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#131929',
  },
  teamAvatarOverlap: {
    marginLeft: -8,
  },
  taskTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#e4e7fb',
    marginBottom: 8,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    opacity: 0.65,
  },
  taskDescription: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#a6aabc',
    marginBottom: 14,
  },
  progressWrap: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: '#a6aabc',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  progressValue: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: '#85adff',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#0d1321',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  taskFooter: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerMetaText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
    color: '#a6aabc',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tagBadge: {
    backgroundColor: '#1e2538',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: '#a6aabc',
  },
  statusText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  loadMoreWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabWrap: {
    position: 'absolute',
    right: 24,
    bottom: 92,
    zIndex: 30,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(133,173,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.15)',
  },
  quickStatusButtonDone: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderColor: 'rgba(74, 222, 128, 0.15)',
  },
  quickStatusButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 10,
    color: '#85adff',
    textTransform: 'uppercase',
  },
  quickStatusButtonTextDone: {
    color: '#4ade80',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 18, 0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  modalCardLarge: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '88%',
    flexShrink: 1,
    overflow: 'hidden',
  },
  modalCardTall: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '92%',
    flexShrink: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
  },
  iconButtonSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 150,
  },
  modalSectionLabel: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    color: '#a6aabc',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  modalSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  inlineActionText: {
    color: '#85adff',
    fontFamily: Fonts.Outfit_700Bold,
  },
  chipWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0d1321',
  },
  filterChipActive: {
    backgroundColor: 'rgba(133,173,255,0.16)',
  },
  filterChipText: {
    color: '#a6aabc',
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#85adff',
  },
  modalInput: {
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    color: '#fff',
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 13,
    marginTop: 12,
  },
  selectorField: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0d1321',
    marginTop: 2,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorFieldDisabled: {
    opacity: 0.65,
  },
  selectorFieldContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectorFieldIcon: {
    width: 18,
    alignItems: 'center',
  },
  selectorFieldText: {
    flex: 1,
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
  },
  selectorFieldPlaceholder: {
    color: '#64748b',
  },
  selectorPanel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    marginTop: 4,
    maxHeight: 190,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  selectorPanelScroll: {
    maxHeight: 188,
  },
  selectorOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorOptionActive: {
    backgroundColor: 'rgba(133,173,255,0.10)',
  },
  selectorOptionText: {
    flex: 1,
    color: '#cbd5e1',
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
  },
  selectorOptionTextActive: {
    color: '#85adff',
  },
  calendarPanel: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 100,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131929',
  },
  calendarMonthLabel: {
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 15,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarWeekdayText: {
    width: '14.28%',
    textAlign: 'center',
    color: '#64748b',
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calendarCell: {
    width: '13.1%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131929',
  },
  calendarCellMuted: {
    backgroundColor: 'rgba(19,25,41,0.42)',
  },
  calendarCellActive: {
    backgroundColor: 'rgba(133,173,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.36)',
  },
  calendarCellText: {
    color: '#dbe4ff',
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 13,
  },
  calendarCellTextMuted: {
    color: '#64748b',
  },
  calendarCellTextActive: {
    color: '#85adff',
  },
  calendarClearButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#131929',
  },
  calendarClearButtonText: {
    color: '#85adff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
  },
  modalTextarea: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  readonlyInput: {
    opacity: 0.78,
  },
  primaryModalButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#85adff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryModalButtonSticky: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#85adff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryModalButtonText: {
    color: '#000000',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stickyModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#111827',
  },
  secondaryModalButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1e2538',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryModalButtonText: {
    color: '#85adff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  attachmentName: {
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_500Medium,
  },
  commentCard: {
    backgroundColor: '#0d1321',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  commentAuthor: {
    color: '#85adff',
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    marginBottom: 4,
  },
  commentBody: {
    color: '#d1d5db',
    fontFamily: Fonts.Outfit_400Regular,
    lineHeight: 20,
  },
  emptyText: {
    color: '#64748b',
    fontFamily: Fonts.Outfit_400Regular,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,113,108,0.08)',
  },
  dangerButtonText: {
    color: '#ff716c',
    fontFamily: Fonts.Outfit_700Bold,
  },
  modalSubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  discussOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  discussIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussOptionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
  },
  discussOptionSubtitle: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
