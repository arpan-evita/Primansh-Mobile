import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type DimensionValue,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { useEffect } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  List,
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
import { Colors, Fonts } from '../../lib/theme';
import LiveTasksScreen from '../../components/tasks/LiveTasksScreen';
import { normalizeRole } from '../../lib/meetings';
import { useMobileTasks } from '../../hooks/useMobileTasks';
import {
  type CreateTaskInput,
  type MobileTask,
  type TaskFilters,
  type TaskStatus,
  formatTaskDueLabel,
  getTaskAccent,
  getTaskPriorityTone,
  getTaskProgress,
  mapTaskStatusToColumn,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from '../../lib/tasks';

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
  comments?: number;
  attachments?: number;
  tag?: string;
  progress?: number;
  statusNote?: string;
  statusTone?: 'active' | 'urgent' | 'approved';
  team: string[];
  completed?: boolean;
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

const TEAM_AVATARS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAL0TD5RutnOL-2rElPZQg_Jg9xog9reY_-HidoHXk7RJQ1eMRynGv5cNsQKD48HZHT61Jh4N06KT0XfnNZPVOHpG2EXpI5wHr-xh_j--i6c9-1yljs9xcgSkSW2katmMVwmrqWCD4F454V5Z50O3nPANtcxO6rhvlLBqLFdT3NF3n0mpK2NNQ0JqCEXwOsT57-kGji7XUJOD6uPL4RfsTlpJhzVpvHxTPWJzttTCoja74O1RUBjBgerIQPqcqcVCu8VmbCvfZUEE03',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBRuz03boovEWH_eiFbUNozZgULgddM-MXq71bL4v31sDGzxyOmyx5U4_mwgqRA2Oso2lJ88tFjrMO78aA8NO1k7a7YZCRByf2hIonWwOMrxoIo0k6q64LiezzRD9D4fTJa0LaX4gi9Y3UTK6Exr0a-IuZnksx6pkYp3cwvUJ_fXYjavcC5KcqPGqzaeSDhgrgDgu_ZssjWwvlUICWov8cPaXULjcphekmle5iQfNBQGivsE1hlgia4B9HgqJRoyHB6w0FO46Tsz0lw',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBvBDk0hkqyiOUgvvYBA__0JFER7iVxTaglj5ToeXRutL0eE8E_9eTfLbNc10m-GvdlOQKPTa6PKLzppBRFlXq1H54TNrxOzq3mV6_BODRYzvLm2E3tUsSCuucPTVRvVmFjQfM-rgmD2KW68TXaEl_gdO058FbqncQP1y2vvi_Lum_oFwdIvd_mNhC_AfRXivYc6zQtIAVUJg0njFcAA_62T6PQcYVD-QsTdFWkVVNYj-08W1SFPl4SFlz99E43mbgIQgG6SUA-9Zqu',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuATRaQzv0swM_ASpNeGDQx98U4h78hfXstnS6nHPAykjYtBC4qcCz23WD8a4qelnXdqm9U-GAUoewP7OVb2HEt8L4K9vQblz9kPdiausAr5WtcDolXUo0QRha1EIxsnwfCf-kI5tuv9CMmjseE9JtHQLYJyfviEBPC6Fz-uTRCzl63Yu7nGMlV4n4KvVI7h3nWeCsfkyNJ5ZcYd73xODtiAFTWoQ7hlTE0hOQ2fbPkbhsaqPmP9gZkPnevDfOUWZivRAkKKMyfCf6Cz',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDcRFcULmtbN5aHXZaxwDBuNNIThy7Gryd3c928SQAP8HPXgyfEuvHR0r4-NjL16mLidlmhWSZoJxAMvOaeYWHfP9wuqxFOsMQhOAaDj-scduuagnCktbmiSH51lDWWmRZxToQG_SLouJJYprze81aWiJp0viAVufWbGVasx95sk0h5dS54fKc3xPYTXOpFv8zuyB24nTA5Yd_rk-t55_t6hPTljsqPgVw6Etp--XGyFkYQb-UiKk-QVpjbULgqocNtX7gvI7Irr31S',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAGZ12tfjn9m5AaiyIu0w1ahdXDDAcZLA0nhokm8uI2wRYhrtfGRkKY3bjXJgC6TJI4wemhtscBcTMMKKHT9N9FvKFx3yhLUn3rYBRJS1V_4mn201L-Xb_IH7iSjSAMdFZ0DiqzgRqlLGPyDiwwfBTWvp-PqkfI86VWcEDcM2RfqluHPHw4R06VzwtHLyeBBI_74F51ZMhmmgMZx0320yVHjf0iHMkooHuFPnx7Ry2e-NZ4JsYYtED-DO3o7hCGMxI3C-b_TC_64ElT',
];

const BOARD: ColumnData[] = [
  {
    key: 'backlog',
    title: 'Backlog',
    count: 8,
    dot: '#64748b',
    badgeBackground: '#1e2538',
    badgeText: '#a6aabc',
    cards: [
      {
        id: 'onboarding-redesign',
        title: 'Client Onboarding Flow Redesign',
        description: 'Finalize the wireframes for the new enterprise onboarding dashboard and user flow.',
        priorityLabel: 'High Priority',
        priorityTone: 'high',
        accent: '#d7383b',
        dueLabel: 'Oct 12',
        comments: 4,
        attachments: 12,
        team: [TEAM_AVATARS[0], TEAM_AVATARS[1]],
      },
      {
        id: 'asset-audit',
        title: 'Internal Asset Audit',
        description: 'Archive old project files from the 2023 Q3 marketing campaign.',
        priorityLabel: 'Low Priority',
        priorityTone: 'low',
        accent: '#475569',
        dueLabel: 'Oct 24',
        tag: '#INTERNAL',
        team: [TEAM_AVATARS[2]],
      },
    ],
  },
  {
    key: 'inProgress',
    title: 'In Progress',
    count: 3,
    dot: '#85adff',
    badgeBackground: 'rgba(133, 173, 255, 0.20)',
    badgeText: '#85adff',
    cards: [
      {
        id: 'stripe-api',
        title: 'API Integration for Stripe',
        description: 'Connecting the new billing engine to the customer portal via Stripe API hooks.',
        priorityLabel: 'Medium Priority',
        priorityTone: 'medium',
        accent: '#9093ff',
        progress: 65,
        statusNote: 'Active',
        statusTone: 'active',
        comments: 24,
        team: [TEAM_AVATARS[3]],
      },
      {
        id: 'checkout-bug',
        title: 'Bug: Checkout Redirection',
        description: 'Mobile users are seeing a blank screen after selecting payment method.',
        priorityLabel: 'High Priority',
        priorityTone: 'high',
        accent: '#d7383b',
        statusNote: 'Urgent',
        statusTone: 'urgent',
        comments: 8,
        team: [TEAM_AVATARS[4]],
      },
    ],
  },
  {
    key: 'completed',
    title: 'Completed',
    count: 12,
    dot: '#22c55e',
    badgeBackground: 'rgba(34, 197, 94, 0.10)',
    badgeText: '#22c55e',
    cards: [
      {
        id: 'brand-styleguide',
        title: 'Brand Styleguide v1.4',
        description: 'Exporting all SVG assets and primary color tokens for dev team.',
        priorityLabel: 'Done',
        priorityTone: 'done',
        accent: 'rgba(34, 197, 94, 0.5)',
        statusNote: 'Approved',
        statusTone: 'approved',
        team: [TEAM_AVATARS[5]],
        completed: true,
      },
      {
        id: 'landing-copy',
        title: 'Landing Page Copywriting',
        priorityLabel: 'Done',
        priorityTone: 'done',
        accent: 'rgba(34, 197, 94, 0.5)',
        statusNote: 'Approved',
        statusTone: 'approved',
        team: [],
        completed: true,
      },
    ],
  },
];

const SIDEBAR_PROFILE = {
  name: 'Alex Sterling',
  role: 'Principal Partner',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAMhYcTqEspopWwFSvKmClGa76WiOdnYE6pD-qzOACCyfKWRMj3-JAqVY_jnB1u4cwgXVjtAB80ucZBuzLXnCHM4pe8rQm13vvpjHmmiGe9VqVw7teN7GesQh9PG148zUxP19joe7Q9wS-l-q-UCvLniNHuQgR68JfUTBZG4lgvZ1SEzESyd_3BFH4aUd3a4damYEN163aiqyqELohRn9u4c9XasexRFQ06Hkpa4xwhE5t3CiVMvfY1hJCyX3t4cZzTZF8USA5gwLT8',
};

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'tasks', label: 'Tasks', icon: CheckCircle2, active: true },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'assets', label: 'Assets', icon: FolderOpen },
];

export default function TasksScreen() {
  return <LiveTasksScreen />;
}

function DesktopSidebar() {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarProfile}>
        <Image source={{ uri: SIDEBAR_PROFILE.image }} style={styles.sidebarAvatar} />
        <View>
          <Text style={styles.sidebarName}>{SIDEBAR_PROFILE.name}</Text>
          <Text style={styles.sidebarRole}>{SIDEBAR_PROFILE.role}</Text>
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

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Premium Plan</Text>
        <View style={styles.planTrack}>
          <View style={styles.planFill} />
        </View>
        <Text style={styles.planMeta}>8.5GB of 10GB used</Text>
      </View>
    </View>
  );
}

function TaskCardView({ card }: { card: TaskCard }) {
  const priorityTheme = getPriorityTheme(card.priorityTone);
  const statusTheme = getStatusTheme(card.statusTone);

  return (
    <View style={[styles.taskCard, { borderLeftColor: card.accent }, card.completed && styles.taskCardDone]}>
      {card.progress ? <LinearGradient colors={['#85adff', '#9093ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.progressStripe} /> : null}

      <View style={styles.taskCardTop}>
        <View style={[styles.priorityBadge, { backgroundColor: priorityTheme.background }]}> 
          <Text style={[styles.priorityBadgeText, { color: priorityTheme.text }]}>{card.priorityLabel}</Text>
        </View>

        <View style={styles.avatarCluster}>
          {card.team.slice(0, 2).map((avatar, index) => (
            <Image
              key={`${card.id}-${index}`}
              source={{ uri: avatar }}
              style={[styles.teamAvatar, index > 0 && styles.teamAvatarOverlap]}
            />
          ))}
        </View>
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
          {typeof card.comments === 'number' ? (
            <View style={styles.footerMetaRow}>
              <MessageSquare color="#a6aabc" size={13} />
              <Text style={styles.footerMetaText}>{card.comments}</Text>
            </View>
          ) : null}

          {typeof card.attachments === 'number' ? (
            <View style={styles.footerMetaRow}>
              <Paperclip color="#a6aabc" size={13} />
              <Text style={styles.footerMetaText}>{card.attachments}</Text>
            </View>
          ) : null}

          {card.tag ? (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{card.tag}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function getPriorityTheme(tone: TaskCard['priorityTone']) {
  if (tone === 'high') {
    return { background: 'rgba(159, 5, 25, 0.20)', text: '#ff716c' };
  }
  if (tone === 'medium') {
    return { background: 'rgba(144, 147, 255, 0.20)', text: '#cdcdff' };
  }
  if (tone === 'done') {
    return { background: 'rgba(34, 197, 94, 0.20)', text: '#4ade80' };
  }
  return { background: '#191f31', text: '#a6aabc' };
}

function getStatusTheme(tone?: TaskCard['statusTone']) {
  if (tone === 'active') return { color: '#85adff', icon: 'active' as const };
  if (tone === 'urgent') return { color: '#ff716c', icon: 'urgent' as const };
  if (tone === 'approved') return { color: '#4ade80', icon: 'approved' as const };
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
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
    borderWidth: 2,
    borderColor: 'rgba(133,173,255,0.20)',
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
    flex: 1,
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
  planCard: {
    marginTop: 18,
    backgroundColor: '#131929',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(67,72,87,0.10)',
  },
  planTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: '#85adff',
    marginBottom: 8,
  },
  planTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#0d1321',
    overflow: 'hidden',
    marginBottom: 8,
  },
  planFill: {
    width: '85%',
    height: '100%',
    backgroundColor: '#85adff',
  },
  planMeta: {
    fontFamily: Fonts.Outfit_400Regular,
    fontSize: 12,
    color: '#a6aabc',
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
    maxWidth: 560,
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
  fabWrap: {
    position: 'absolute',
    right: 24,
    bottom: 92,
    zIndex: 30,
    shadowColor: '#85adff',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
