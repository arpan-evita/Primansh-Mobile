
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeModules,
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
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useRouter, useNavigation } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  Bot,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleAlert,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  MoreVertical,
  Pause,
  Phone,
  Play,
  Plus,
  Rocket,
  Search,
  Send,
  Smile,
  Users,
  Video,
  X,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../lib/theme';
import { startInstantMeeting } from '../../lib/meetings';
import {
  type MobileChatMessage,
  type MobileChatProfile,
  useMobileMessages,
} from '../../hooks/useMobileMessages';

type ChatFilter = 'all' | 'unread' | 'personal' | 'work';

type PendingAudio = {
  uri: string;
  durationSeconds: number;
  name: string;
  mimeType: string;
  size?: number | null;
};

type WebPickerRequest = {
  mode: 'image' | 'file';
  accept: string;
};

const SIDEBAR_PROFILE = {
  name: 'Alex Sterling',
  role: 'Principal Partner',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCQdHmkfU0FX-WsUr25PxJ9GhjETf8_e30L4S-ojPH7pQ3toLhnSWthdaAW8n-ByEupQfW5X7up0oOlnTyjI1pwD1h0iy9uUCdUt5bNMxnO7WigcWJ9P7sbirqkG37tOfQ9eruqVm1lOQ09u0Vwizt2gne02VWgXLctYS__Bf5VO8MyMBsaRkltTM_KUJ2lwqv0rhbSGdqMZkYqXlfgoJADE2f0dk8rhx-Iu94do5vt2Wp4bf9T1nxahgI_Z8xDWQVc-reVZMazZrbC',
};

const SIDEBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { key: 'clients', label: 'Clients', icon: Users, href: '/clients' },
  { key: 'tasks', label: 'Tasks', icon: Rocket, href: '/tasks' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, active: true, href: '/messages' },
  { key: 'meetings', label: 'Meetings', icon: CalendarDays, href: '/meetings' },
  { key: 'docs', label: 'Docs', icon: FolderOpen, href: '/docs' },
];

const FILTERS: { key: ChatFilter; label: string }[] = [
  { key: 'all', label: 'All Chats' },
  { key: 'unread', label: 'Unread' },
  { key: 'personal', label: 'Personal' },
  { key: 'work', label: 'Work' },
];

function formatClock(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatListTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const diff = now.getTime() - date.getTime();
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(totalSeconds?: number | null) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatLastSeen(value?: string | null) {
  if (!value) return 'Offline';
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return 'Online now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function getOtherParticipants(
  participants: { profile_id: string; profile: MobileChatProfile }[],
  currentProfileId?: string | null
) {
  return participants.filter((participant) => participant.profile_id !== currentProfileId);
}

function getConversationTitle(
  participants: { profile_id: string; profile: MobileChatProfile }[],
  currentProfileId?: string | null,
  title?: string | null
) {
  if (title?.trim()) return title;
  const others = getOtherParticipants(participants, currentProfileId);
  if (others.length === 0) return 'New conversation';
  if (others.length === 1) return others[0].profile.full_name;
  return others.map((item) => item.profile.full_name).join(', ');
}

function getConversationPreview(message?: MobileChatMessage | null) {
  if (!message) return 'No messages yet';
  if (message.message_type === 'audio') {
    return `Voice message (${formatDuration(Number(message.content || 0))})`;
  }
  if (message.message_type === 'image') return message.file_name || 'Photo';
  if (message.message_type === 'file') return message.file_name || 'File attachment';
  if (message.message_type === 'meeting') return message.content || 'Meeting invitation';
  return message.content || 'Message';
}

function getConversationInitials(name: string) {
  const chunks = name.split(' ').filter(Boolean);
  return chunks.slice(0, 2).map((chunk) => chunk[0]?.toUpperCase()).join('') || 'U';
}

function hasImagePickerNativeModule() {
  return !!(NativeModules as any)?.ExponentImagePicker;
}

function hasDocumentPickerNativeModule() {
  return !!(NativeModules as any)?.ExpoDocumentPicker;
}

function conversationMatchesFilter(
  filter: ChatFilter,
  conversation: {
    unread_count: number;
    participants: { profile_id: string; profile: MobileChatProfile }[];
  },
  currentProfileId?: string | null
) {
  const others = getOtherParticipants(conversation.participants, currentProfileId);
  const hasClient = others.some((item) => (item.profile.role || '').toLowerCase().includes('client'));

  if (filter === 'unread') return conversation.unread_count > 0;
  if (filter === 'personal') return !hasClient;
  if (filter === 'work') return hasClient;
  return true;
}

function AudioBubble({ message, isOwn }: { message: MobileChatMessage; isOwn: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(
    Math.max(0, Number(message.content || 0)) * 1000
  );

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const togglePlayback = async () => {
    if (!message.file_url) return;

    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: message.file_url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying);
          setPositionMillis(status.positionMillis || 0);
          if (status.durationMillis) setDurationMillis(status.durationMillis);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionMillis(0);
          }
        }
      );
      soundRef.current = sound;
      return;
    }

    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const progress = durationMillis > 0 ? Math.min(1, positionMillis / durationMillis) : 0;
  const bars = [6, 10, 14, 8, 18, 12, 9, 16, 7, 13, 11, 17, 8, 15, 9, 12];

  return (
    <View style={[styles.audioCard, isOwn ? styles.audioCardOwn : styles.audioCardOther]}>
      <TouchableOpacity activeOpacity={0.88} style={styles.audioPlayButton} onPress={togglePlayback}>
        {isPlaying ? <Pause color="#fff" size={14} fill="#fff" /> : <Play color="#fff" size={14} fill="#fff" />}
      </TouchableOpacity>

      <View style={styles.audioWaveWrap}>
        <View style={styles.audioBarsRow}>
          {bars.map((height, index) => {
            const filled = index / bars.length <= progress;
            return (
              <View
                key={`${message.id}-bar-${index}`}
                style={[
                  styles.audioBar,
                  { height },
                  filled ? styles.audioBarFilled : styles.audioBarMuted,
                ]}
              />
            );
          })}
        </View>
        <View style={styles.audioMetaRow}>
          <Text style={styles.audioTimeText}>{formatDuration(Math.floor(positionMillis / 1000))}</Text>
          <Text style={styles.audioTimeText}>{formatDuration(Math.floor(durationMillis / 1000))}</Text>
        </View>
      </View>
    </View>
  );
}
function FileBubble({ message }: { message: MobileChatMessage }) {
  const openFile = async () => {
    if (message.file_url) {
      await Linking.openURL(message.file_url);
    }
  };

  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.fileCard} onPress={openFile}>
      <View style={styles.fileIconWrap}>
        <FileText color="#85adff" size={18} />
      </View>
      <View style={styles.fileTextWrap}>
        <Text style={styles.fileTitle} numberOfLines={1}>
          {message.file_name || 'Attachment'}
        </Text>
        <Text style={styles.fileSubtitle}>
          {message.file_size ? `${(message.file_size / 1024 / 1024).toFixed(1)} MB` : 'Tap to open'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MeetingBubble({ message, onJoin }: { message: MobileChatMessage; onJoin: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.meetingCard} onPress={onJoin}>
      <View style={styles.meetingIconWrap}>
        <Video color="#85adff" size={18} />
      </View>
      <View style={styles.meetingTextWrap}>
        <Text style={styles.meetingTitle}>{message.content || 'Meeting invitation'}</Text>
        <Text style={styles.meetingSubtitle}>Tap to join the room</Text>
      </View>
    </TouchableOpacity>
  );
}

function MessageStatus({ message }: { message: MobileChatMessage }) {
  if (message.status === 'error') {
    return <CircleAlert color="#ff716c" size={12} />;
  }

  if (message.status === 'read') {
    return <CheckCheck color="#85adff" size={12} />;
  }

  if (message.status === 'delivered') {
    return <CheckCheck color="#cbd5f5" size={12} />;
  }

  return <Check color="#cbd5f5" size={12} />;
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  avatar,
  onPreviewImage,
  onJoinMeeting,
}: {
  message: MobileChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  avatar?: string | null;
  onPreviewImage: (uri: string) => void;
  onJoinMeeting: (meetingId: string) => void;
}) {
  return (
    <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
      {!isOwn && showAvatar ? (
        avatar ? (
          <Image source={{ uri: avatar }} style={styles.messageAvatar} />
        ) : (
          <View style={[styles.messageAvatar, styles.messageAvatarFallback]} />
        )
      ) : !isOwn ? (
        <View style={styles.messageAvatarSpacer} />
      ) : null}

      <View style={[styles.messageStack, isOwn ? styles.messageStackOwn : styles.messageStackOther]}>
        {message.message_type === 'image' && message.file_url ? (
          <TouchableOpacity
            activeOpacity={0.94}
            style={styles.imageCard}
            onPress={() => onPreviewImage(message.file_url || message.local_uri || '')}
          >
            <Image source={{ uri: message.file_url || message.local_uri || undefined }} style={styles.imageBubble} />
            {message.file_name ? <Text style={styles.imageCaption}>{message.file_name}</Text> : null}
          </TouchableOpacity>
        ) : null}

        {message.message_type === 'audio' ? <AudioBubble message={message} isOwn={isOwn} /> : null}
        {message.message_type === 'file' ? <FileBubble message={message} /> : null}
        {message.message_type === 'meeting' && message.meeting_id ? (
          <MeetingBubble message={message} onJoin={() => onJoinMeeting(message.meeting_id as string)} />
        ) : null}

        {message.message_type === 'text' || (!['image', 'audio', 'file', 'meeting'].includes(message.message_type) && message.content) ? (
          <LinearGradient
            colors={isOwn ? ['#85adff', '#9093ff'] : ['#191f31', '#191f31']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther]}
          >
            <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
              {message.content}
            </Text>
          </LinearGradient>
        ) : null}

        <View style={[styles.messageMeta, isOwn ? styles.messageMetaOwn : styles.messageMetaOther]}>
          <Text style={styles.messageTime}>{formatClock(message.created_at)}</Text>
          {isOwn ? <MessageStatus message={message} /> : null}
        </View>
      </View>
    </View>
  );
}

function ConversationRow({
  conversation,
  currentProfileId,
  isActive,
  isOnline,
  onPress,
}: {
  conversation: any;
  currentProfileId?: string | null;
  isActive: boolean;
  isOnline: boolean;
  onPress: () => void;
}) {
  const title = getConversationTitle(conversation.participants, currentProfileId, conversation.title);
  const preview = getConversationPreview(conversation.last_message);
  const others = getOtherParticipants(conversation.participants, currentProfileId);
  const avatar = others[0]?.profile.avatar_url;
  const initials = getConversationInitials(title);
  const messageType = conversation.last_message?.message_type;

  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.conversationRow, isActive && styles.conversationRowActive]} onPress={onPress}>
      <View style={styles.conversationAvatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.conversationAvatar} />
        ) : (
          <LinearGradient colors={['#9093ff', '#699cff']} style={styles.initialsAvatar}>
            <Text style={styles.initialsText}>{initials}</Text>
          </LinearGradient>
        )}
        {isOnline ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.conversationBody}>
        <View style={styles.conversationTop}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.conversationTime, isActive && styles.conversationTimeActive]}>
            {formatListTime(conversation.last_message?.created_at || conversation.updated_at)}
          </Text>
        </View>

        <View style={styles.conversationBottom}>
          <View style={styles.conversationPreviewWrap}>
            {messageType === 'audio' ? <Mic color="#a6aabc" size={12} /> : null}
            {messageType === 'meeting' ? <Video color="#85adff" size={12} /> : null}
            {messageType === 'file' ? <FileText color="#a6aabc" size={12} /> : null}
            {messageType === 'text' && conversation.last_message?.status === 'read' ? (
              <CheckCheck color="#85adff" size={12} />
            ) : null}
            <Text style={styles.conversationPreview} numberOfLines={1}>
              {preview}
            </Text>
          </View>

          {conversation.unread_count > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{conversation.unread_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DesktopSidebar() {
  const router = useRouter();

  return (
    <View style={styles.desktopSidebar}>
      <Text style={styles.desktopBrand}>Agency OS</Text>
      <View style={styles.desktopNav}>
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.85}
              style={[styles.desktopNavItem, item.active && styles.desktopNavItemActive]}
              onPress={() => router.push(item.href as any)}
            >
              <Icon color={item.active ? '#85adff' : '#94a3b8'} size={18} />
              <Text style={[styles.desktopNavText, item.active && styles.desktopNavTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.desktopProfileCard}>
        <Image source={{ uri: SIDEBAR_PROFILE.image }} style={styles.desktopProfileAvatar} />
        <View style={styles.desktopProfileTextWrap}>
          <Text style={styles.desktopProfileName}>{SIDEBAR_PROFILE.name}</Text>
          <Text style={styles.desktopProfileRole}>{SIDEBAR_PROFILE.role}</Text>
        </View>
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const navigation = useNavigation();
  const isDesktop = width >= 900;
  const showInlineThread = isDesktop;

  const {
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
    refreshMessages,
    createConversationWithProfile,
    sendTextMessage,
    uploadAndSendAsset,
    broadcastTyping,
  } = useMobileMessages();

  const [filter, setFilter] = useState<ChatFilter>('all');
  const [conversationSearch, setConversationSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isRecipientModalVisible, setRecipientModalVisible] = useState(false);
  const [isAttachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [webPickerRequest, setWebPickerRequest] = useState<WebPickerRequest | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingMillis, setRecordingMillis] = useState(0);
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isStartingCall, setIsStartingCall] = useState<'video' | 'audio' | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webPickerHtml = useMemo(() => {
    if (!webPickerRequest) return '';

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        background: #090e1b;
        color: #e4e7fb;
        font-family: sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        width: min(88vw, 360px);
        background: #131929;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: 24px;
        box-sizing: border-box;
        text-align: center;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 22px;
      }
      p {
        margin: 0 0 18px;
        color: #a6aabc;
        line-height: 1.5;
        font-size: 14px;
      }
      button {
        width: 100%;
        border: 0;
        border-radius: 16px;
        padding: 14px 16px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }
      .primary {
        background: linear-gradient(135deg, #85adff, #9093ff);
        color: #000;
        margin-bottom: 10px;
      }
      .secondary {
        background: rgba(255,255,255,0.05);
        color: #e4e7fb;
      }
      input { display: none; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${webPickerRequest.mode === 'image' ? 'Share photo' : 'Share file'}</h1>
      <p>${webPickerRequest.mode === 'image' ? 'Choose a photo from your device to send in chat.' : 'Choose a file from your device to send in chat.'}</p>
      <input id="picker" type="file" accept="${webPickerRequest.accept}" />
      <button class="primary" onclick="pickFile()">Choose</button>
      <button class="secondary" onclick="closePicker()">Close</button>
    </div>
    <script>
      const picker = document.getElementById('picker');
      const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      function closePicker() { post({ type: 'cancel' }); }
      function pickFile() { picker.click(); }
      picker.addEventListener('change', () => {
        const file = picker.files && picker.files[0];
        if (!file) {
          post({ type: 'cancel' });
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          post({
            type: 'selected',
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size || null,
            base64Data: String(reader.result || ''),
          });
        };
        reader.onerror = () => post({ type: 'error', message: 'Unable to read the selected file.' });
        reader.readAsDataURL(file);
      });
      setTimeout(pickFile, 250);
    </script>
  </body>
</html>`;
  }, [webPickerRequest]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, typingUsers]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [recording]);


  const filteredConversations = useMemo(() => {
    const term = conversationSearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const title = getConversationTitle(conversation.participants, profile?.id, conversation.title);
      const preview = getConversationPreview(conversation.last_message);
      const matchesSearch =
        !term ||
        title.toLowerCase().includes(term) ||
        preview.toLowerCase().includes(term);
      const matchesFilter = conversationMatchesFilter(filter, conversation, profile?.id);
      return matchesSearch && matchesFilter;
    });
  }, [conversationSearch, conversations, filter, profile?.id]);

  const filteredRecipients = useMemo(() => {
    const term = recipientSearch.trim().toLowerCase();
    return allowedRecipients.filter((recipient) => {
      if (!term) return true;
      const haystack = `${recipient.full_name} ${recipient.role}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [allowedRecipients, recipientSearch]);

  const otherParticipants = useMemo(
    () => getOtherParticipants(activeConversation?.participants || [], profile?.id),
    [activeConversation?.participants, profile?.id]
  );

  const activeTitle = useMemo(
    () =>
      activeConversation
        ? getConversationTitle(activeConversation.participants, profile?.id, activeConversation.title)
        : 'Messages',
    [activeConversation, profile?.id]
  );

  const activeAvatar = otherParticipants[0]?.profile.avatar_url || null;
  const activeIsOnline = otherParticipants.some((participant) => onlineUserIds.includes(participant.profile.id));
  const activeStatus = activeConversation
    ? otherParticipants.length === 1
      ? activeIsOnline
        ? 'Online now'
        : formatLastSeen(otherParticipants[0]?.profile.last_seen_at)
      : `${otherParticipants.length + 1} participants`
    : 'Select a conversation';

  const showMobileThreadOnly = !showInlineThread && !!activeConversationId;
  const conversationPaneHeight = Math.min(320, height * 0.36);
  const mobileComposerBottom = isDesktop ? 16 : tabBarHeight + Math.max(insets.bottom, 8) + 18;
  const threadBottomPadding = isDesktop ? 136 : mobileComposerBottom + 124;

  // Handle Android hardware back button & edge swipe gesture
  const showMobileThreadOnlyRef = useRef(false);
  showMobileThreadOnlyRef.current = showMobileThreadOnly;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showMobileThreadOnlyRef.current) {
        setActiveConversationId(null);
        return true; // consumed — prevents app from closing
      }
      return false; // let OS handle (minimise/exit app)
    });
    return () => subscription.remove();
  }, []); // registered once; ref always has latest value

  // Hide tab bar when chatting on mobile
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: { display: showMobileThreadOnly ? 'none' : 'flex' },
    });
  }, [navigation, showMobileThreadOnly]);

  const handleConversationPress = (conversationId: string) => {
    setActiveConversationId(conversationId);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.trim()) {
      broadcastTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTyping(false);
      }, 1500);
    } else {
      broadcastTyping(false);
    }
  };

  const handleSend = async () => {
    if (recording) {
      await stopRecording();
      return;
    }

    if (pendingAudio) {
      const success = await uploadAndSendAsset(
        {
          uri: pendingAudio.uri,
          name: pendingAudio.name,
          mimeType: pendingAudio.mimeType,
          size: pendingAudio.size || null,
          durationSeconds: pendingAudio.durationSeconds,
        },
        'audio'
      );

      if (success) {
        setPendingAudio(null);
      }
      return;
    }

    if (!draft.trim()) return;

    const success = await sendTextMessage(draft);
    if (success) {
      setDraft('');
    }
  };

  const startRecording = async () => {
    try {
      setRecordingError(null);
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setRecordingError('Microphone permission is required for voice notes.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      nextRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingMillis(status.durationMillis || 0);
        }
      });
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setPendingAudio(null);
      setRecordingMillis(0);
    } catch (error) {
      console.error('[MobileMessages] startRecording failed', error);
      setRecordingError('Could not start voice recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) return;

      const durationSeconds = Math.max(1, Math.round((status.durationMillis || 0) / 1000));
      setPendingAudio({
        uri,
        durationSeconds,
        name: `voice-note-${Date.now()}.m4a`,
        mimeType: 'audio/mp4',
        size: null,
      });
      setRecordingMillis(0);
    } catch (error) {
      console.error('[MobileMessages] stopRecording failed', error);
      setRecordingError('Could not finish voice recording.');
    }
  };

  const cancelRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
      }
    } catch {
      // Best effort cleanup.
    } finally {
      setRecording(null);
      setRecordingMillis(0);
      setPendingAudio(null);
    }
  };

  const handleMicPress = async () => {
    if (recording) {
      await cancelRecording();
      return;
    }

    if (pendingAudio) {
      setPendingAudio(null);
      return;
    }

    await startRecording();
  };

  const handlePickPhoto = async () => {
    setAttachmentSheetVisible(false);
    if (!hasImagePickerNativeModule()) {
      setWebPickerRequest({ mode: 'image', accept: 'image/*' });
      return;
    }

    let ImagePicker: typeof import('expo-image-picker');
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert(
        'Image picker unavailable',
        'This development build needs to be rebuilt before photo uploads can be used.'
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.78,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    await uploadAndSendAsset(
      {
        uri: asset.uri,
        name: asset.fileName || `image-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize || null,
      },
      'image'
    );
  };

  const handlePickDocument = async () => {
    setAttachmentSheetVisible(false);
    if (!hasDocumentPickerNativeModule()) {
      setWebPickerRequest({ mode: 'file', accept: '*/*' });
      return;
    }

    let DocumentPicker: typeof import('expo-document-picker');
    try {
      DocumentPicker = require('expo-document-picker');
    } catch {
      Alert.alert(
        'File picker unavailable',
        'This development build needs to be rebuilt before document sharing can be used.'
      );
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    await uploadAndSendAsset(
      {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size || null,
      },
      asset.mimeType?.startsWith('image/') ? 'image' : 'file'
    );
  };

  const handleWebPickerMessage = async (raw: string) => {
    try {
      const payload = JSON.parse(raw);

      if (payload?.type === 'cancel') {
        setWebPickerRequest(null);
        return;
      }

      if (payload?.type === 'error') {
        setWebPickerRequest(null);
        Alert.alert('Picker error', payload?.message || 'Unable to read the selected file.');
        return;
      }

      if (payload?.type !== 'selected') return;

      const mode = webPickerRequest?.mode || 'file';
      setWebPickerRequest(null);

      const mimeType = payload?.mimeType || 'application/octet-stream';
      const messageType = mode === 'image' || mimeType.startsWith('image/') ? 'image' : 'file';

      await uploadAndSendAsset(
        {
          uri: '',
          name: payload?.name || `${mode}-${Date.now()}`,
          mimeType,
          size: typeof payload?.size === 'number' ? payload.size : null,
          base64Data: payload?.base64Data || null,
        },
        messageType
      );
    } catch {
      setWebPickerRequest(null);
      Alert.alert('Picker error', 'Unable to process the selected file.');
    }
  };

  const handleNewConversation = async (recipientId: string) => {
    try {
      const conversationId = await createConversationWithProfile(recipientId);
      if (conversationId) {
        setRecipientModalVisible(false);
        setRecipientSearch('');
      }
    } catch (error) {
      console.error('[MobileMessages] handleNewConversation failed', error);
    }
  };

  const handleJoinMeeting = (meetingId: string) => {
    router.push(`/portal/meetings/room?id=${meetingId}&audioOnly=false`);
  };

  const handleStartCallFromChat = async (isAudioOnly: boolean) => {
    if (!profile || !activeConversation || isStartingCall) return;

    const participantIds = otherParticipants.map((p) => p.profile.id);
    if (participantIds.length === 0) {
      Alert.alert('No participants', 'Could not find participants for this conversation.');
      return;
    }

    setIsStartingCall(isAudioOnly ? 'audio' : 'video');
    try {
      const meeting = await startInstantMeeting({
        currentProfile: profile,
        participantIds,
        title: isAudioOnly ? `Call with ${activeTitle}` : `Meeting with ${activeTitle}`,
        isAudioOnly,
      });
      router.push(`/portal/meetings/room?id=${meeting.id}&audioOnly=${isAudioOnly}`);
    } catch (error: any) {
      Alert.alert(
        isAudioOnly ? 'Could not start call' : 'Could not start meeting',
        error?.message || 'Please try again.'
      );
    } finally {
      setIsStartingCall(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {/* Hide outer header when showing a thread on mobile — thread has its own header */}
        {!showMobileThreadOnly ? (
          <View style={styles.headerShell}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity activeOpacity={0.85} style={styles.headerIconButton} onPress={() => setSidebarVisible(true)}>
                  <Menu color="#94a3b8" size={20} />
                </TouchableOpacity>
                <Text style={styles.headerBrand}>Agency OS</Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity activeOpacity={0.85} style={styles.headerIconButton} onPress={() => setRecipientModalVisible(true)}>
                  <Plus color="#85adff" size={20} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={styles.headerIconButton}>
                  <Bot color="#85adff" size={20} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
          {isDesktop ? <DesktopSidebar /> : null}

          <View style={styles.mainPane}>
            {(!showMobileThreadOnly || showInlineThread) ? (
              <View style={[styles.conversationPane, isDesktop ? { width: 360, height: '100%' } : { flex: 1 }]}> 
                <View style={styles.listHeader}>
                  <View style={styles.searchWrap}>
                    <Search color="rgba(166,170,188,0.55)" size={18} />
                    <TextInput
                      value={conversationSearch}
                      onChangeText={setConversationSearch}
                      placeholder="Search conversations..."
                      placeholderTextColor="rgba(166,170,188,0.45)"
                      style={styles.searchInput}
                    />
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map((item) => {
                      const isActive = item.key === filter;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          activeOpacity={0.88}
                          style={[styles.filterPill, isActive && styles.filterPillActive]}
                          onPress={() => setFilter(item.key)}
                        >
                          <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{item.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.conversationList}
                  refreshControl={
                    <RefreshControl
                      tintColor={Colors.accent}
                      refreshing={isRefreshingConversations && !isBootstrapping}
                      onRefresh={() => refreshConversations()}
                    />
                  }
                >
                  {isBootstrapping ? (
                    <View style={styles.emptyState}>
                      <ActivityIndicator color="#85adff" />
                      <Text style={styles.emptyTitle}>Loading conversations…</Text>
                    </View>
                  ) : filteredConversations.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>No conversations yet</Text>
                      <Text style={styles.emptySubtitle}>Start a real chat with your team or client contacts.</Text>
                    </View>
                  ) : (
                    filteredConversations.map((conversation) => {
                      const others = getOtherParticipants(conversation.participants, profile?.id);
                      const isOnline = others.some((item) => onlineUserIds.includes(item.profile.id));
                      return (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          currentProfileId={profile?.id}
                          isActive={conversation.id === activeConversationId}
                          isOnline={isOnline}
                          onPress={() => handleConversationPress(conversation.id)}
                        />
                      );
                    })
                  )}
                </ScrollView>
              </View>
            ) : null}
            {(showInlineThread || showMobileThreadOnly) ? (
              <View style={styles.threadPane}>
                <View style={styles.threadHeader}>
                  <View style={styles.threadHeaderLeft}>
                    {showMobileThreadOnly ? (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.threadBackButton}
                        onPress={() => setActiveConversationId(null)}
                      >
                        <ChevronLeft color="#e4e7fb" size={22} />
                      </TouchableOpacity>
                    ) : null}
                    {activeAvatar ? (
                      <Image source={{ uri: activeAvatar }} style={styles.activeAvatar} />
                    ) : (
                      <LinearGradient colors={['#9093ff', '#699cff']} style={styles.activeAvatarFallback}>
                        <Text style={styles.activeAvatarText}>{getConversationInitials(activeTitle)}</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.threadHeaderTextWrap}>
                      <Text style={styles.threadHeaderTitle} numberOfLines={1} ellipsizeMode="tail">{activeTitle}</Text>
                      <Text style={styles.threadHeaderStatus} numberOfLines={1}>{activeStatus}</Text>
                    </View>
                  </View>

                  <View style={styles.threadHeaderActions}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.threadActionButton, isStartingCall === 'video' && styles.threadActionButtonActive]}
                      onPress={() => handleStartCallFromChat(false)}
                      disabled={!!isStartingCall}
                    >
                      {isStartingCall === 'video'
                        ? <ActivityIndicator size="small" color="#85adff" />
                        : <Video color={isStartingCall ? '#64748b' : '#85adff'} size={18} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      style={[styles.threadActionButton, isStartingCall === 'audio' && styles.threadActionButtonActive]}
                      onPress={() => handleStartCallFromChat(true)}
                      disabled={!!isStartingCall}
                    >
                      {isStartingCall === 'audio'
                        ? <ActivityIndicator size="small" color="#85adff" />
                        : <Phone color={isStartingCall ? '#64748b' : '#22c55e'} size={18} />}
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.88} style={styles.threadActionButton}>
                      <MoreVertical color="#94a3b8" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  ref={(node) => {
                    scrollRef.current = node;
                  }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[
                    styles.threadScrollContent,
                    { paddingBottom: threadBottomPadding },
                  ]}
                  refreshControl={
                    <RefreshControl
                      tintColor={Colors.accent}
                      refreshing={isRefreshingMessages}
                      onRefresh={() =>
                        activeConversationId
                          ? refreshMessages(activeConversationId).then(() => undefined)
                          : Promise.resolve()
                      }
                    />
                  }
                >
                  {!activeConversation ? (
                    <View style={styles.threadEmptyState}>
                      <MessageSquare color="#64748b" size={28} />
                      <Text style={styles.emptyTitle}>Select a conversation</Text>
                      <Text style={styles.emptySubtitle}>Open an existing chat or start a new one to begin messaging.</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.todayChipWrap}>
                        <View style={styles.todayChip}>
                          <Text style={styles.todayChipText}>Live conversation</Text>
                        </View>
                      </View>

                      {messages.map((message, index) => {
                        const isOwn = message.sender_id === profile?.id;
                        const previousMessage = messages[index - 1];
                        const showAvatar = !previousMessage || previousMessage.sender_id !== message.sender_id;
                        const senderAvatar = message.sender?.avatar_url || otherParticipants[0]?.profile.avatar_url || null;

                        return (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={isOwn}
                            showAvatar={showAvatar}
                            avatar={senderAvatar}
                            onPreviewImage={setPreviewImageUri}
                            onJoinMeeting={handleJoinMeeting}
                          />
                        );
                      })}

                      {typingUsers.length > 0 ? (
                        <View style={styles.typingWrap}>
                          <Text style={styles.typingText}>{typingUsers[0]} is typing…</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </ScrollView>

                {recording || pendingAudio || uploadingLabel || recordingError ? (
                  <View style={[styles.composerStatusCard, { bottom: mobileComposerBottom + 74 }]}>
                    {recording ? (
                      <>
                        <View style={styles.recordingDot} />
                        <Text style={styles.composerStatusText}>Recording voice note • {formatDuration(Math.floor(recordingMillis / 1000))}</Text>
                      </>
                    ) : null}

                    {!recording && pendingAudio ? (
                      <>
                        <Mic color="#85adff" size={14} />
                        <Text style={styles.composerStatusText}>Voice note ready • {formatDuration(pendingAudio.durationSeconds)}</Text>
                      </>
                    ) : null}

                    {!recording && !pendingAudio && uploadingLabel ? (
                      <>
                        <ActivityIndicator size="small" color="#85adff" />
                        <Text style={styles.composerStatusText}>Uploading {uploadingLabel}…</Text>
                      </>
                    ) : null}

                    {!recording && !pendingAudio && !uploadingLabel && recordingError ? (
                      <>
                        <CircleAlert color="#ff716c" size={14} />
                        <Text style={styles.composerStatusText}>{recordingError}</Text>
                      </>
                    ) : null}
                  </View>
                ) : null}

                <View style={[styles.composerShell, { bottom: mobileComposerBottom }]}>
                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={styles.composerIconButton}
                    onPress={() => setAttachmentSheetVisible(true)}
                    disabled={!activeConversation || !!recording}
                  >
                    <Plus color="#a6aabc" size={20} />
                  </TouchableOpacity>

                  <View style={styles.composerInputWrap}>
                    <TextInput
                      value={draft}
                      onChangeText={handleDraftChange}
                      placeholder={
                        activeConversation
                          ? pendingAudio
                            ? 'Voice note ready to send'
                            : recording
                              ? 'Recording in progress…'
                              : 'Type a message...'
                          : 'Select a conversation first'
                      }
                      placeholderTextColor="rgba(166,170,188,0.5)"
                      style={styles.composerInput}
                      editable={!!activeConversation && !recording && !pendingAudio && !uploadingLabel}
                      multiline
                    />
                  </View>

                  <TouchableOpacity activeOpacity={0.88} style={styles.composerSmallButton}>
                    <Smile color="#a6aabc" size={18} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    style={[styles.composerSmallButton, (recording || pendingAudio) && styles.composerSmallButtonActive]}
                    onPress={handleMicPress}
                    disabled={!activeConversation || !!uploadingLabel}
                  >
                    <Mic color={recording || pendingAudio ? '#85adff' : '#a6aabc'} size={18} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.92}
                    style={styles.sendButton}
                    onPress={handleSend}
                    disabled={!activeConversation || isSending || (!draft.trim() && !recording && !pendingAudio)}
                  >
                    {recording ? <X color="#000" size={18} /> : <Send color="#000" size={18} />}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <Modal visible={isRecipientModalVisible} transparent animationType="fade" onRequestClose={() => setRecipientModalVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRecipientModalVisible(false)}>
            <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Start New Chat</Text>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setRecipientModalVisible(false)}>
                  <X color="#94a3b8" size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearchWrap}>
                <Search color="rgba(166,170,188,0.55)" size={18} />
                <TextInput
                  value={recipientSearch}
                  onChangeText={setRecipientSearch}
                  placeholder="Search team or clients..."
                  placeholderTextColor="rgba(166,170,188,0.5)"
                  style={styles.modalSearchInput}
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.recipientList}>
                {filteredRecipients.map((recipient) => (
                  <TouchableOpacity
                    key={recipient.id}
                    activeOpacity={0.88}
                    style={styles.recipientRow}
                    onPress={() => handleNewConversation(recipient.id)}
                  >
                    {recipient.avatar_url ? (
                      <Image source={{ uri: recipient.avatar_url }} style={styles.recipientAvatar} />
                    ) : (
                      <LinearGradient colors={['#9093ff', '#699cff']} style={styles.recipientAvatarFallback}>
                        <Text style={styles.recipientAvatarText}>{getConversationInitials(recipient.full_name)}</Text>
                      </LinearGradient>
                    )}
                    <View style={styles.recipientTextWrap}>
                      <Text style={styles.recipientName}>{recipient.full_name}</Text>
                      <Text style={styles.recipientRole}>{recipient.role}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={isSidebarVisible} transparent animationType="fade" onRequestClose={() => setSidebarVisible(false)}>
          <Pressable style={styles.sidebarBackdrop} onPress={() => setSidebarVisible(false)}>
            <Pressable style={styles.sidebarSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Agency OS</Text>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setSidebarVisible(false)}>
                  <X color="#94a3b8" size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.sidebarNav}>
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={0.88}
                      style={[styles.sidebarNavItem, item.active && styles.sidebarNavItemActive]}
                      onPress={() => {
                        setSidebarVisible(false);
                        router.push(item.href as any);
                      }}
                    >
                      <Icon color={item.active ? '#85adff' : '#94a3b8'} size={18} />
                      <Text style={[styles.sidebarNavText, item.active && styles.sidebarNavTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={isAttachmentSheetVisible} transparent animationType="fade" onRequestClose={() => setAttachmentSheetVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAttachmentSheetVisible(false)}>
            <Pressable style={styles.attachmentSheet} onPress={(event) => event.stopPropagation()}>
              <TouchableOpacity activeOpacity={0.9} style={styles.attachmentRow} onPress={handlePickPhoto}>
                <View style={styles.attachmentIconWrap}>
                  <ImageIcon color="#85adff" size={18} />
                </View>
                <View>
                  <Text style={styles.attachmentTitle}>Photo</Text>
                  <Text style={styles.attachmentSubtitle}>Send an image from your library</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} style={styles.attachmentRow} onPress={handlePickDocument}>
                <View style={styles.attachmentIconWrap}>
                  <FileText color="#85adff" size={18} />
                </View>
                <View>
                  <Text style={styles.attachmentTitle}>File</Text>
                  <Text style={styles.attachmentSubtitle}>Share PDFs, docs, sheets, and more</Text>
                </View>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={!!previewImageUri} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
          <Pressable style={styles.imagePreviewBackdrop} onPress={() => setPreviewImageUri(null)}>
            <TouchableOpacity activeOpacity={0.9} style={styles.imagePreviewClose} onPress={() => setPreviewImageUri(null)}>
              <X color="#fff" size={20} />
            </TouchableOpacity>
            {previewImageUri ? <Image source={{ uri: previewImageUri }} style={styles.imagePreview} resizeMode="contain" /> : null}
          </Pressable>
        </Modal>

        <Modal visible={!!webPickerRequest} transparent animationType="fade" onRequestClose={() => setWebPickerRequest(null)}>
          <View style={styles.webPickerBackdrop}>
            <View style={styles.webPickerCard}>
              {webPickerRequest ? (
                <WebView
                  source={{ html: webPickerHtml }}
                  originWhitelist={['*']}
                  onMessage={(event) => handleWebPickerMessage(event.nativeEvent.data)}
                  style={styles.webPickerWebView}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  keyboardWrap: {
    flex: 1,
  },
  headerShell: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9,14,27,0.9)',
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  headerBrand: {
    color: '#85adff',
    fontSize: 22,
    fontFamily: Fonts.Outfit_700Bold,
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  layout: {
    flex: 1,
  },
  layoutDesktop: {
    flexDirection: 'row',
  },
  desktopSidebar: {
    width: 272,
    backgroundColor: '#090e1b',
    paddingTop: 28,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  desktopBrand: {
    color: '#fff',
    fontSize: 28,
    fontFamily: Fonts.Outfit_700Bold,
    marginBottom: 24,
  },
  desktopNav: {
    gap: 6,
  },
  desktopNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
  },
  desktopNavItemActive: {
    backgroundColor: 'rgba(133,173,255,0.1)',
    borderLeftWidth: 2,
    borderLeftColor: '#85adff',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  desktopNavText: {
    color: '#94a3b8',
    fontSize: 15,
    fontFamily: Fonts.Outfit_500Medium,
  },
  desktopNavTextActive: {
    color: '#85adff',
  },
  desktopProfileCard: {
    marginTop: 'auto',
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#0d1321',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  desktopProfileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  desktopProfileTextWrap: {
    flex: 1,
  },
  desktopProfileName: {
    color: '#e4e7fb',
    fontSize: 14,
    fontFamily: Fonts.Outfit_700Bold,
  },
  desktopProfileRole: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: Fonts.Outfit_500Medium,
  },
  mainPane: {
    flex: 1,
    flexDirection: 'column',
  },
  conversationPane: {
    backgroundColor: 'rgba(13,19,33,0.72)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchWrap: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#131929',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#e4e7fb',
    fontSize: 14,
    fontFamily: Fonts.Outfit_500Medium,
    paddingVertical: 12,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#191f31',
  },
  filterPillActive: {
    backgroundColor: '#85adff',
  },
  filterText: {
    color: '#a6aabc',
    fontSize: 12,
    fontFamily: Fonts.Outfit_700Bold,
  },
  filterTextActive: {
    color: '#000',
  },
  conversationList: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  conversationRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    marginBottom: 8,
  },
  conversationRowActive: {
    backgroundColor: '#191f31',
    borderLeftWidth: 4,
    borderLeftColor: '#85adff',
  },
  conversationAvatarWrap: {
    position: 'relative',
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  initialsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#000',
    fontSize: 16,
    fontFamily: Fonts.Outfit_700Bold,
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#191f31',
    backgroundColor: '#22c55e',
  },
  conversationBody: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  conversationName: {
    flex: 1,
    color: '#e4e7fb',
    fontSize: 15,
    fontFamily: Fonts.Outfit_700Bold,
  },
  conversationTime: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: Fonts.Outfit_600SemiBold,
    textTransform: 'uppercase',
  },
  conversationTimeActive: {
    color: '#85adff',
  },
  conversationBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  conversationPreviewWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversationPreview: {
    flex: 1,
    color: '#a6aabc',
    fontSize: 12,
    fontFamily: Fonts.Outfit_500Medium,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#85adff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#000',
    fontSize: 11,
    fontFamily: Fonts.Outfit_700Bold,
  },
  threadPane: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  threadHeader: {
    minHeight: 80,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(19,25,41,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  threadHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  threadBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131929',
  },
  threadBackText: {
    color: '#e4e7fb',
    fontSize: 12,
    fontFamily: Fonts.Outfit_700Bold,
  },
  activeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  activeAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAvatarText: {
    color: '#000',
    fontSize: 16,
    fontFamily: Fonts.Outfit_700Bold,
  },
  threadHeaderTextWrap: {
    flex: 1,
  },
  threadHeaderTitle: {
    color: '#e4e7fb',
    fontSize: 16,
    fontFamily: Fonts.Outfit_700Bold,
  },
  threadHeaderStatus: {
    color: '#85adff',
    fontSize: 11,
    fontFamily: Fonts.Outfit_700Bold,
    marginTop: 2,
  },
  threadHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threadActionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131929',
  },
  threadActionButtonActive: {
    backgroundColor: 'rgba(133,173,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.3)',
  },
  threadScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 136,
  },
  threadEmptyState: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  todayChipWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  todayChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#191f31',
  },
  todayChipText: {
    color: '#a6aabc',
    fontSize: 10,
    fontFamily: Fonts.Outfit_700Bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    marginRight: 10,
  },
  messageAvatarFallback: {
    backgroundColor: '#334155',
  },
  messageAvatarSpacer: {
    width: 40,
  },
  messageStack: {
    maxWidth: '80%',
  },
  messageStackOther: {
    alignItems: 'flex-start',
  },
  messageStackOwn: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
  },
  messageBubbleOwn: {
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.Outfit_500Medium,
  },
  messageTextOwn: {
    color: '#000',
  },
  messageTextOther: {
    color: '#e4e7fb',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  messageMetaOwn: {
    justifyContent: 'flex-end',
  },
  messageMetaOther: {
    justifyContent: 'flex-start',
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: Fonts.Outfit_500Medium,
  },
  imageCard: {
    padding: 6,
    borderRadius: 22,
    backgroundColor: '#191f31',
  },
  imageBubble: {
    width: 240,
    height: 180,
    borderRadius: 16,
  },
  imageCaption: {
    color: '#e4e7fb',
    fontSize: 12,
    fontFamily: Fonts.Outfit_500Medium,
    marginTop: 10,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  audioCard: {
    minWidth: 220,
    maxWidth: 280,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioCardOwn: {
    backgroundColor: 'rgba(133,173,255,0.18)',
  },
  audioCardOther: {
    backgroundColor: '#191f31',
  },
  audioPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#85adff',
  },
  audioWaveWrap: {
    flex: 1,
  },
  audioBarsRow: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  audioBar: {
    width: 4,
    borderRadius: 999,
  },
  audioBarFilled: {
    backgroundColor: '#85adff',
  },
  audioBarMuted: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  audioMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  audioTimeText: {
    color: '#a6aabc',
    fontSize: 10,
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  fileCard: {
    minWidth: 220,
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#191f31',
  },
  fileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(133,173,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileTextWrap: {
    flex: 1,
  },
  fileTitle: {
    color: '#e4e7fb',
    fontSize: 14,
    fontFamily: Fonts.Outfit_700Bold,
  },
  fileSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: Fonts.Outfit_500Medium,
    marginTop: 3,
  },
  meetingCard: {
    minWidth: 220,
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(133,173,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.16)',
  },
  meetingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#131929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingTextWrap: {
    flex: 1,
  },
  meetingTitle: {
    color: '#e4e7fb',
    fontSize: 14,
    fontFamily: Fonts.Outfit_700Bold,
  },
  meetingSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: Fonts.Outfit_500Medium,
    marginTop: 3,
  },
  typingWrap: {
    marginLeft: 40,
    marginTop: 4,
  },
  typingText: {
    color: '#a6aabc',
    fontSize: 11,
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  composerStatusCard: {
    position: 'absolute',
    left: 18,
    right: 18,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerStatusText: {
    color: '#e4e7fb',
    fontSize: 12,
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#ff716c',
  },
  composerShell: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
    minHeight: 66,
    borderRadius: 24,
    backgroundColor: 'rgba(30,37,56,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    justifyContent: 'center',
  },
  composerInput: {
    color: '#e4e7fb',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.Outfit_500Medium,
    paddingVertical: 10,
    paddingHorizontal: 6,
    maxHeight: 92,
  },
  composerSmallButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSmallButtonActive: {
    backgroundColor: 'rgba(133,173,255,0.1)',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#85adff',
    shadowColor: '#85adff',
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
  },
  sidebarSheet: {
    width: 286,
    height: '100%',
    backgroundColor: '#090e1b',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sidebarTitle: {
    color: '#e4e7fb',
    fontSize: 24,
    fontFamily: Fonts.Outfit_700Bold,
  },
  sidebarNav: {
    gap: 8,
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
  },
  sidebarNavItemActive: {
    backgroundColor: 'rgba(133,173,255,0.1)',
  },
  sidebarNavText: {
    color: '#94a3b8',
    fontSize: 15,
    fontFamily: Fonts.Outfit_500Medium,
  },
  sidebarNavTextActive: {
    color: '#85adff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '78%',
    borderRadius: 26,
    backgroundColor: '#090e1b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#e4e7fb',
    fontSize: 18,
    fontFamily: Fonts.Outfit_700Bold,
  },
  modalSearchWrap: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: '#131929',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  modalSearchInput: {
    flex: 1,
    color: '#e4e7fb',
    fontSize: 14,
    fontFamily: Fonts.Outfit_500Medium,
    paddingVertical: 12,
  },
  recipientList: {
    paddingBottom: 8,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  recipientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  recipientAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarText: {
    color: '#000',
    fontSize: 14,
    fontFamily: Fonts.Outfit_700Bold,
  },
  recipientTextWrap: {
    flex: 1,
  },
  recipientName: {
    color: '#e4e7fb',
    fontSize: 15,
    fontFamily: Fonts.Outfit_700Bold,
  },
  recipientRole: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Fonts.Outfit_500Medium,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  attachmentSheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 26,
    backgroundColor: '#090e1b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: 10,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  attachmentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(133,173,255,0.1)',
  },
  attachmentTitle: {
    color: '#e4e7fb',
    fontSize: 15,
    fontFamily: Fonts.Outfit_700Bold,
  },
  attachmentSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Fonts.Outfit_500Medium,
    marginTop: 2,
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  imagePreview: {
    width: '100%',
    height: '78%',
  },
  webPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  webPickerCard: {
    width: '100%',
    maxWidth: 420,
    height: 360,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#090e1b',
  },
  webPickerWebView: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#e4e7fb',
    fontSize: 16,
    fontFamily: Fonts.Outfit_700Bold,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.Outfit_500Medium,
    textAlign: 'center',
  },
});
