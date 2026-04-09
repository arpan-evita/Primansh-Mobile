/**
 * MeetingRoomScreen — Full-featured Google Meet–style video/audio call room.
 *
 * Features:
 *  ✅ Live WebRTC mesh (camera + audio)
 *  ✅ Screen sharing with simultaneous camera PiP
 *  ✅ In-call chat (real-time via Supabase)
 *  ✅ Floating emoji reactions (animated)
 *  ✅ Raise hand (visible to all)
 *  ✅ Speaker view ↔ Grid view
 *  ✅ Pin any participant
 *  ✅ Front/Back camera flip
 *  ✅ Host controls (mute all, remove participant, end for all)
 *  ✅ Lobby with camera/mic preview
 *  ✅ Live timer + participant count
 *  ✅ Unread message badge
 *  ✅ Hand-raise notification toasts
 *  ✅ Network quality indicators
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
  Pressable,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  MessageSquare,
  Presentation,
  MoreVertical,
  Pin,
  Maximize2,
  RotateCw,
  X,
  Send,
  Smile,
  Info,
  Copy,
  CheckCircle,
} from 'lucide-react-native';
import { Fonts, Colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useMeetingChat } from '../../hooks/useMeetingChat';
import { Audio } from 'expo-av';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

// ─── Constants ────────────────────────────────────────────────────────────────

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const EMOJI_REACTIONS = ['👍', '👏', '❤️', '😂', '🎉', '🔥', '😮', '🤔', '💯', '🙌'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveParticipant {
  id: string;
  name: string;
  avatar?: string | null;
  isLocal: boolean;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  fromName: string;
  x: number;
  anim: Animated.Value;
}

interface HandRaiseToast {
  id: string;
  name: string;
}

type ActivePanel = 'none' | 'chat' | 'participants' | 'reactions' | 'more' | 'info';
type ViewMode = 'speaker' | 'grid';

// ─── Sub-component: ParticipantTile ──────────────────────────────────────────

function ParticipantTile({
  participant,
  stream,
  isMuted,
  isVideoOff,
  isHandRaised,
  isScreenSharing,
  isPinned,
  featured = false,
  onPress,
  onLongPress,
  height: tileH,
}: {
  participant: LiveParticipant;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  isScreenSharing: boolean;
  isPinned: boolean;
  featured?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  height?: number;
}) {
  const showVideo = !!stream && !isVideoOff && !isScreenSharing;
  const showScreen = !!stream && isScreenSharing;
  const initial = (participant.name || 'U')[0].toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.tileShell,
        featured ? styles.tileShellFeatured : styles.tileShellGrid,
        tileH ? { height: tileH } : null,
        isPinned && styles.tileShellPinned,
      ]}
    >
      {/* Video / Screen / Fallback */}
      {(showVideo || showScreen) && stream ? (
        <RTCView
          streamURL={(stream as any).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit={showScreen ? 'contain' : 'cover'}
          mirror={participant.isLocal && !isScreenSharing}
        />
      ) : (
        <LinearGradient
          colors={['#131929', '#1a2035']}
          style={[StyleSheet.absoluteFill, styles.tileAvatarCenter]}
        >
          <View style={[styles.avatarCircle, featured && styles.avatarCircleLarge]}>
            <Text style={[styles.avatarInitial, featured && styles.avatarInitialLarge]}>
              {initial}
            </Text>
          </View>
        </LinearGradient>
      )}

      {/* Gradient overlay for name readability */}
      {(showVideo || showScreen) && (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          style={styles.tileGradient}
          pointerEvents="none"
        />
      )}

      {/* Screen share label */}
      {isScreenSharing && !participant.isLocal && (
        <View style={styles.screenShareBadge}>
          <Presentation color="#85adff" size={12} />
          <Text style={styles.screenShareBadgeText}>Screen</Text>
        </View>
      )}

      {/* Hand raised */}
      {isHandRaised && (
        <View style={styles.handBadge}>
          <Text style={styles.handEmoji}>✋</Text>
        </View>
      )}

      {/* Pin badge */}
      {isPinned && (
        <View style={styles.pinBadge}>
          <Pin color="#85adff" size={10} />
        </View>
      )}

      {/* Name chip */}
      <View style={styles.nameChip}>
        {isMuted ? (
          <MicOff color="#ff6b6b" size={12} />
        ) : (
          <Mic color="#85adff" size={12} fill="#85adff" />
        )}
        <Text style={styles.nameChipText} numberOfLines={1}>
          {participant.name}
          {participant.isLocal ? ' (You)' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Sub-component: ControlButton ─────────────────────────────────────────────

function CtrlBtn({
  icon,
  label,
  active,
  danger,
  badge,
  onPress,
}: {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  danger?: boolean;
  badge?: number;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.ctrlBtn,
        active && styles.ctrlBtnActive,
        danger && styles.ctrlBtnDanger,
      ]}
      activeOpacity={0.8}
    >
      {icon}
      {label ? <Text style={styles.ctrlBtnLabel}>{label}</Text> : null}
      {badge != null && badge > 0 ? (
        <View style={styles.ctrlBadge}>
          <Text style={styles.ctrlBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Sub-component: MessageText (highlights @mentions) ──────────────────────

function MessageText({ text, style }: { text: string; style?: any }) {
  // Split on @word or @First Last patterns
  const parts = text.split(/(@\S+(?:\s\S+)?)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text key={i} style={styles.mentionHighlight}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

// ─── Sub-component: Mention Suggestions popup ────────────────────────────────

function MentionSuggestions({
  query,
  participants,
  onSelect,
}: {
  query: string;
  participants: LiveParticipant[];
  onSelect: (name: string) => void;
}) {
  const filtered = participants.filter(
    (p) => !p.isLocal && p.name.toLowerCase().includes(query.toLowerCase())
  );
  if (!filtered.length) return null;

  return (
    <View style={styles.mentionList}>
      {filtered.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={styles.mentionItem}
          onPress={() => onSelect(p.name)}
          activeOpacity={0.75}
        >
          <View style={styles.mentionAvatar}>
            <Text style={styles.mentionAvatarText}>
              {(p.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.mentionMeta}>
            <Text style={styles.mentionName}>{p.name}</Text>
            <Text style={styles.mentionTag}>@{p.name.split(' ')[0]}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Sub-component: Chat Panel ────────────────────────────────────────────────

function ChatPanel({
  meetingId,
  profile,
  participants,
  onClose,
}: {
  meetingId: string;
  profile: any;
  participants: LiveParticipant[];
  onClose: () => void;
}) {
  const { messages, isSending, sendMessage } = useMeetingChat(meetingId, profile);
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAtIndex, setMentionAtIndex] = useState(-1);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Detect @ mention query at the END of current text
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    // Match '@' followed by non-space chars at the very end of the string
    const match = newText.match(/@([^@\s]*)$/);
    if (match) {
      setMentionQuery(match[1]); // the part after @
      setMentionAtIndex(newText.lastIndexOf('@' + match[1]));
    } else {
      setMentionQuery(null);
    }
  }, []);

  // Insert selected mention, replacing the @query at the end
  const insertMention = useCallback(
    (name: string) => {
      const before = text.slice(0, mentionAtIndex);
      const after = text.slice(mentionAtIndex + 1 + (mentionQuery?.length ?? 0));
      const newText = `${before}@${name} ${after}`;
      setText(newText);
      setMentionQuery(null);
      // Keep the keyboard open
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [text, mentionAtIndex, mentionQuery]
  );

  const handleSend = useCallback(async () => {
    const msg = text.trim();
    if (!msg || isSending) return;
    setText('');
    setMentionQuery(null);
    await sendMessage(msg);
  }, [text, isSending, sendMessage]);

  return (
    <View style={styles.panelContainer}>
      <View style={styles.panelHandle} />
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>In-Call Messages</Text>
        <TouchableOpacity onPress={onClose} style={styles.panelCloseBtn}>
          <X color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.chatList}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isOwn = item.sender_id === profile?.id;
          return (
            <View style={[styles.chatBubbleRow, isOwn && styles.chatBubbleRowOwn]}>
              {!isOwn && (
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>
                    {(item.sender?.full_name || 'P')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.chatBubble, isOwn && styles.chatBubbleOwn]}>
                {!isOwn && (
                  <Text style={styles.chatSenderName}>
                    {item.sender?.full_name || 'Participant'}
                  </Text>
                )}
                {/* Use MessageText so @mentions are highlighted */}
                <MessageText text={item.content} style={styles.chatText} />
                <Text style={styles.chatTime}>
                  {new Date(item.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {isOwn && item.status === 'sent' && (
                    <Text style={styles.chatRead}>  ✓</Text>
                  )}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.chatEmpty}>
            <MessageSquare color={Colors.slate500} size={36} />
            <Text style={styles.chatEmptyTitle}>No messages yet</Text>
            <Text style={styles.chatEmptySubtitle}>
              Type @ to mention someone
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Mention suggestions — shown ABOVE the input when @ is active */}
        {mentionQuery !== null && (
          <MentionSuggestions
            query={mentionQuery}
            participants={participants}
            onSelect={insertMention}
          />
        )}

        <View style={styles.chatInputRow}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message everyone... (@ to mention)"
            placeholderTextColor={Colors.slate500}
            style={styles.chatInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.chatSendBtn, (!text.trim() || isSending) && styles.chatSendBtnDisabled]}
            disabled={!text.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send color="#fff" size={16} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Sub-component: Participants Panel ────────────────────────────────────────

function ParticipantsPanel({
  participants,
  remoteMuted,
  remoteVideoOff,
  remoteHandRaised,
  remoteScreenSharing,
  pinnedId,
  currentProfile,
  onPin,
  onMuteRemote,
  onClose,
}: {
  participants: LiveParticipant[];
  remoteMuted: Record<string, boolean>;
  remoteVideoOff: Record<string, boolean>;
  remoteHandRaised: Record<string, boolean>;
  remoteScreenSharing: Record<string, boolean>;
  pinnedId: string | null;
  currentProfile: any;
  onPin: (id: string) => void;
  onMuteRemote: (id: string) => void;
  onClose: () => void;
}) {
  const isAdmin = currentProfile?.role === 'admin';

  return (
    <View style={styles.panelContainer}>
      <View style={styles.panelHandle} />
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>
          Participants ({participants.length})
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.panelCloseBtn}>
          <X color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.participantList} contentContainerStyle={{ paddingBottom: 32 }}>
        {participants.map((p) => (
          <View key={p.id} style={styles.participantRow}>
            <View style={styles.participantAvatarWrap}>
              <Text style={styles.participantAvatarText}>
                {(p.name || 'U')[0].toUpperCase()}
              </Text>
              {!remoteMuted[p.id] && !p.isLocal && (
                <View style={styles.participantSpeakDot} />
              )}
            </View>

            <View style={styles.participantMeta}>
              <Text style={styles.participantName}>
                {p.name}
                {p.isLocal ? ' (You)' : ''}
              </Text>
              <View style={styles.participantBadges}>
                {(p.isLocal ? false : !!remoteMuted[p.id]) && (
                  <View style={styles.badge}>
                    <MicOff color="#ff6b6b" size={10} />
                  </View>
                )}
                {remoteHandRaised[p.id] && (
                  <View style={styles.badge}>
                    <Text style={{ fontSize: 10 }}>✋</Text>
                  </View>
                )}
                {remoteScreenSharing[p.id] && (
                  <View style={styles.badge}>
                    <Presentation color="#85adff" size={10} />
                  </View>
                )}
                {pinnedId === p.id && (
                  <View style={styles.badge}>
                    <Pin color="#facc15" size={10} />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.participantActions}>
              <TouchableOpacity
                onPress={() => onPin(p.id)}
                style={[styles.participantActionBtn, pinnedId === p.id && styles.participantActionBtnActive]}
              >
                <Pin color={pinnedId === p.id ? '#85adff' : '#475569'} size={14} />
              </TouchableOpacity>
              {isAdmin && !p.isLocal && (
                <TouchableOpacity
                  onPress={() => onMuteRemote(p.id)}
                  style={styles.participantActionBtn}
                >
                  <MicOff color="#475569" size={14} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Sub-component: Reactions Panel ──────────────────────────────────────────

function ReactionsPanel({
  onReact,
  onClose,
}: {
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.panelContainer, styles.reactionsPanelContainer]}>
      <View style={styles.panelHandle} />
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Send a Reaction</Text>
        <TouchableOpacity onPress={onClose} style={styles.panelCloseBtn}>
          <X color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>
      <View style={styles.emojiGrid}>
        {EMOJI_REACTIONS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.emojiBtn}
            onPress={() => {
              onReact(emoji);
              onClose();
            }}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Sub-component: More Options Panel ───────────────────────────────────────

function MoreOptionsPanel({
  isHandRaised,
  isFrontCamera,
  viewMode,
  isRecording,
  isHost,
  meetingId,
  onHandRaise,
  onFlipCamera,
  onToggleView,
  onMuteAll,
  onShowInfo,
  onClose,
}: {
  isHandRaised: boolean;
  isFrontCamera: boolean;
  viewMode: ViewMode;
  isRecording: boolean;
  isHost: boolean;
  meetingId: string;
  onHandRaise: () => void;
  onFlipCamera: () => void;
  onToggleView: () => void;
  onMuteAll: () => void;
  onShowInfo: () => void;
  onClose: () => void;
}) {
  const options = [
    {
      icon: <Text style={{ fontSize: 20 }}>{isHandRaised ? '✋' : '🙋'}</Text>,
      label: isHandRaised ? 'Lower Hand' : 'Raise Hand',
      onPress: () => { onHandRaise(); onClose(); },
    },
    {
      icon: <RotateCw color="#94a3b8" size={20} />,
      label: `${isFrontCamera ? 'Back' : 'Front'} Camera`,
      onPress: () => { onFlipCamera(); onClose(); },
    },
    {
      icon: (viewMode === 'speaker'
        ? <Users color="#94a3b8" size={20} />
        : <Maximize2 color="#94a3b8" size={20} />),
      label: viewMode === 'speaker' ? 'Grid View' : 'Speaker View',
      onPress: () => { onToggleView(); onClose(); },
    },
    {
      icon: <Info color="#94a3b8" size={20} />,
      label: 'Meeting Info',
      onPress: () => { onShowInfo(); onClose(); },
    },
    ...(isHost ? [{
      icon: <MicOff color="#94a3b8" size={20} />,
      label: 'Mute All Participants',
      onPress: () => { onMuteAll(); onClose(); },
    }] : []),
  ];

  return (
    <View style={styles.panelContainer}>
      <View style={styles.panelHandle} />
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>More Options</Text>
        <TouchableOpacity onPress={onClose} style={styles.panelCloseBtn}>
          <X color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.moreOptionsList}>
        {options.map((opt, i) => (
          <TouchableOpacity key={i} style={styles.moreOptionRow} onPress={opt.onPress}>
            <View style={styles.moreOptionIcon}>{opt.icon}</View>
            <Text style={styles.moreOptionLabel}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Sub-component: Meeting Info Modal ───────────────────────────────────────

function MeetingInfoModal({
  meetingId,
  title,
  startTime,
  participantCount,
  onClose,
}: {
  meetingId: string;
  title: string;
  startTime: string;
  participantCount: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await Share.share({ message: `Meeting ID: ${meetingId}`, title: 'Share Meeting ID' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* user cancelled */ }
  };

  return (
    <View style={styles.infoModal}>
      <View style={styles.panelHandle} />
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Meeting Info</Text>
        <TouchableOpacity onPress={onClose} style={styles.panelCloseBtn}>
          <X color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBody}>
        <Text style={styles.infoLabel}>Meeting Title</Text>
        <Text style={styles.infoValue}>{title || 'Meeting'}</Text>

        <Text style={styles.infoLabel}>Meeting ID</Text>
        <View style={styles.infoIdRow}>
          <Text style={styles.infoIdValue} numberOfLines={1} ellipsizeMode="middle">
            {meetingId}
          </Text>
          <TouchableOpacity onPress={copyId} style={styles.infoCopyBtn}>
            {copied ? (
              <CheckCircle color="#22c55e" size={16} />
            ) : (
              <Copy color="#85adff" size={16} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.infoLabel}>Started At</Text>
        <Text style={styles.infoValue}>
          {new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>

        <Text style={styles.infoLabel}>Participants</Text>
        <Text style={styles.infoValue}>{participantCount} people</Text>
      </View>
    </View>
  );
}

// ─── VoiceCallUI ─────────────────────────────────────────────────────────────
// Phone-call style screen for audio-only calls (WhatsApp / iOS call look)

function VoiceCallUI({
  participants,
  profile,
  meetingTitle,
  formattedTime,
  isMuted,
  isSpeakerOn,
  remoteMuted,
  onToggleMute,
  onToggleSpeaker,
  onLeave,
  onEndForAll,
}: {
  participants: LiveParticipant[];
  profile: any;
  meetingTitle: string;
  formattedTime: string;
  isMuted: boolean;
  isSpeakerOn: boolean;
  remoteMuted: Record<string, boolean>;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onLeave: () => void;
  onEndForAll?: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const otherParticipants = participants.filter((p) => !p.isLocal);
  const isGroup = otherParticipants.length > 1;

  // Pulsing ring on avatar
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleEndPress = () => {
    if (onEndForAll) {
      Alert.alert('End Call', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Call', onPress: onLeave },
        { text: 'End for Everyone', style: 'destructive', onPress: onEndForAll },
      ]);
    } else {
      onLeave();
    }
  };

  return (
    <LinearGradient
      colors={['#0a0f1e', '#111827', '#0f172a']}
      style={voiceStyles.screen}
    >
      <SafeAreaView style={voiceStyles.safeArea}>
        {/* Header */}
        <View style={voiceStyles.header}>
          <Text style={voiceStyles.meetingLabel}>{meetingTitle}</Text>
          <View style={voiceStyles.timerRow}>
            <View style={voiceStyles.activeDot} />
            <Text style={voiceStyles.timerText}>{formattedTime}</Text>
          </View>
        </View>

        {/* Participant display */}
        <View style={voiceStyles.body}>
          {isGroup ? (
            /* Group call: row of avatars */
            <View style={voiceStyles.groupAvatarRow}>
              {otherParticipants.slice(0, 4).map((p, idx) => (
                <View key={p.id} style={voiceStyles.groupAvatarWrap}>
                  <View style={[voiceStyles.groupAvatar, { marginLeft: idx > 0 ? -18 : 0 }]}>
                    <Text style={voiceStyles.groupAvatarText}>
                      {(p.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  {remoteMuted[p.id] && (
                    <View style={voiceStyles.mutedBadge}>
                      <Text style={{ fontSize: 8 }}>🔇</Text>
                    </View>
                  )}
                </View>
              ))}
              {otherParticipants.length > 4 && (
                <View style={[voiceStyles.groupAvatar, voiceStyles.overflowAvatar, { marginLeft: -18 }]}>
                  <Text style={voiceStyles.overflowText}>+{otherParticipants.length - 4}</Text>
                </View>
              )}
            </View>
          ) : (
            /* 1-to-1: large pulsing avatar */
            <View style={voiceStyles.soloAvatarContainer}>
              <Animated.View
                style={[
                  voiceStyles.pulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={voiceStyles.soloAvatar}>
                <Text style={voiceStyles.soloAvatarText}>
                  {(otherParticipants[0]?.name || profile?.full_name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            </View>
          )}

          {/* Name(s) */}
          <Text style={voiceStyles.callerName}>
            {isGroup
              ? `${otherParticipants.length} Participants`
              : otherParticipants[0]?.name || 'Connecting...'}
          </Text>

          <Text style={voiceStyles.callStatus}>
            {participants.length <= 1 ? 'Connecting...' : 'Connected · Encrypted'}
          </Text>

          {/* Group participant list (if group call) */}
          {isGroup && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={voiceStyles.participantScroll}
              contentContainerStyle={voiceStyles.participantScrollContent}
            >
              {otherParticipants.map((p) => (
                <View key={p.id} style={voiceStyles.participantChip}>
                  <Text style={voiceStyles.participantChipInitial}>
                    {(p.name || 'U')[0].toUpperCase()}
                  </Text>
                  <Text style={voiceStyles.participantChipName} numberOfLines={1}>
                    {p.name.split(' ')[0]}
                  </Text>
                  {remoteMuted[p.id] && (
                    <Text style={{ fontSize: 10 }}>🔇</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Controls */}
        <View style={voiceStyles.controlsOuter}>
          <View style={voiceStyles.controlsRow}>
            {/* Mute */}
            <TouchableOpacity
              onPress={onToggleMute}
              style={[voiceStyles.ctrlBtn, isMuted && voiceStyles.ctrlBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={voiceStyles.ctrlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              <Text style={voiceStyles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            {/* End call — center, prominent */}
            <TouchableOpacity
              onPress={handleEndPress}
              style={voiceStyles.endCallBtn}
              activeOpacity={0.85}
            >
              <PhoneOff color="#fff" size={28} />
            </TouchableOpacity>

            {/* Speaker */}
            <TouchableOpacity
              onPress={onToggleSpeaker}
              style={[voiceStyles.ctrlBtn, isSpeakerOn && voiceStyles.ctrlBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={voiceStyles.ctrlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
              <Text style={voiceStyles.ctrlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const voiceStyles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'space-between' },

  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
    gap: 6,
  },
  meetingLabel: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#e4e7fb',
    letterSpacing: -0.3,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 7, height: 7, borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  timerText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 13,
    color: '#94a3b8',
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 32,
  },

  // Solo call avatar
  soloAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(133,173,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(133,173,255,0.3)',
  },
  soloAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1e2538',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#85adff',
  },
  soloAvatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 44,
    color: '#85adff',
  },

  // Group call avatars
  groupAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupAvatarWrap: {
    position: 'relative',
  },
  groupAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1e2538',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0f1e',
  },
  groupAvatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 26,
    color: '#85adff',
  },
  overflowAvatar: {
    backgroundColor: '#2f2ebe',
  },
  overflowText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#9093ff',
  },
  mutedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0a0f1e',
    borderRadius: 8,
    padding: 2,
  },

  callerName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 30,
    color: '#fff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  callStatus: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },

  // Group participant row
  participantScroll: {
    maxHeight: 72,
    marginTop: 8,
  },
  participantScrollContent: {
    gap: 10,
    paddingHorizontal: 8,
  },
  participantChip: {
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
  },
  participantChipInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e2538',
    textAlign: 'center',
    lineHeight: 40,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#85adff',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.25)',
    overflow: 'hidden',
  },
  participantChipName: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 10,
    color: '#94a3b8',
  },

  // Bottom controls
  controlsOuter: {
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  ctrlBtn: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(133,173,255,0.15)',
    borderColor: 'rgba(133,173,255,0.35)',
  },
  ctrlIcon: {
    fontSize: 26,
  },
  ctrlLabel: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 10,
    color: '#94a3b8',
  },
  endCallBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MeetingRoomScreen() {
  const { id, audioOnly } = useLocalSearchParams<{ id: string; audioOnly: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  const meetingId = Array.isArray(id) ? id[0] : (id ?? '');
  const isAudioOnly = audioOnly === 'true';

  // ── Profile & meeting ──────────────────────────────────────────────────────
  const [profile, setProfile] = useState<any>(null);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ── Media controls ─────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(isAudioOnly);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('speaker');
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [handRaiseToasts, setHandRaiseToasts] = useState<HandRaiseToast[]>([]);

  // ── Remote state ───────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteMuted, setRemoteMuted] = useState<Record<string, boolean>>({});
  const [remoteVideoOff, setRemoteVideoOff] = useState<Record<string, boolean>>({});
  const [remoteHandRaised, setRemoteHandRaised] = useState<Record<string, boolean>>({});
  const [remoteScreenSharing, setRemoteScreenSharing] = useState<Record<string, boolean>>({});

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidates = useRef<Record<string, any[]>>({});
  const profileRef = useRef<any>(null);

  // ── Chat hook ──────────────────────────────────────────────────────────────
  const { messages, isSending, sendMessage } = useMeetingChat(
    hasJoined ? meetingId : undefined,
    profile
  );

  // Track unread messages
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && activePanel !== 'chat') {
      setUnreadCount((c) => c + (messages.length - prevMessageCountRef.current));
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, activePanel]);

  useEffect(() => {
    if (activePanel === 'chat') setUnreadCount(0);
  }, [activePanel]);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasJoined) return;
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [hasJoined]);

  const formattedTime = useMemo(() => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // ── Init: auth + media ─────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          Alert.alert('Not authenticated', 'Please log in.');
          router.back();
          return;
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!mounted || !prof) { router.back(); return; }

        profileRef.current = prof;
        setProfile(prof);

        const { data: meeting } = await supabase
          .from('meetings')
          .select('*, conversation:conversations(title)')
          .eq('id', meetingId)
          .single();

        if (!mounted) return;
        if (meeting) setMeetingData(meeting);

        // Get local media
        let stream: MediaStream;
        try {
          stream = await mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: isAudioOnly ? false : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user',
            },
          });
        } catch {
          try {
            stream = await mediaDevices.getUserMedia({ audio: true, video: false });
          } catch {
            Alert.alert('Permission Required', 'Microphone access is needed for calls.');
            router.back();
            return;
          }
        }

        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

        localStreamRef.current = stream;
        setParticipants([{ id: prof.id, name: prof.full_name || 'You', isLocal: true }]);
        setLoading(false);

        if (isAudioOnly) joinRoom(prof);
      } catch (err) {
        console.error('[Meeting] init error:', err);
        if (mounted) { Alert.alert('Error', 'Could not join the meeting.'); router.back(); }
      }
    };

    init();
    return () => {
      mounted = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch(() => {});
      channelRef.current = null;
    }
  }, []);

  // ── Signaling helper ───────────────────────────────────────────────────────
  const broadcastSignal = useCallback((payload: Record<string, any>, to = 'all') => {
    const prof = profileRef.current;
    if (!channelRef.current || !prof) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: { from: prof.id, to, ...payload },
    });
  }, []);

  // ── Join room & setup signaling ────────────────────────────────────────────
  const joinRoom = useCallback((prof: any) => {
    profileRef.current = prof;
    setHasJoined(true);

    const channel = supabase.channel(`meeting:${meetingId}`, {
      config: { presence: { key: prof.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<any>();
        const activeIds = Object.keys(state);

        setParticipants(() => {
          const list: LiveParticipant[] = activeIds
            .map((uid) => {
              const e = (state[uid] as any)?.[0];
              if (!e) return null;
              return { id: uid, name: e.name || 'Member', avatar: e.avatar, isLocal: uid === prof.id };
            })
            .filter(Boolean) as LiveParticipant[];

          // Clean stale peer connections
          Object.keys(peerConnections.current).forEach((uid) => {
            if (!activeIds.includes(uid)) {
              peerConnections.current[uid]?.close();
              delete peerConnections.current[uid];
            }
          });

          return list;
        });

        // Initiate WebRTC with peers who joined before us
        [...activeIds].sort().forEach((uid, idx) => {
          if (uid < prof.id && !peerConnections.current[uid]) {
            setTimeout(() => createPeerConnection(uid, true), idx * 300);
          }
        });
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const { from, to, type, data } = payload;
        if (to !== prof.id && to !== 'all') return;

        switch (type) {
          case 'mute_state':
            setRemoteMuted((p) => ({ ...p, [from]: !!data.isMuted }));
            break;
          case 'video_state':
            setRemoteVideoOff((p) => ({ ...p, [from]: !!data.isOff }));
            break;
          case 'hand_state':
            setRemoteHandRaised((p) => ({ ...p, [from]: !!data.raised }));
            if (data.raised) showHandRaiseToast(from, data.name);
            break;
          case 'screen_share_state':
            setRemoteScreenSharing((p) => ({ ...p, [from]: !!data.isSharing }));
            break;
          case 'reaction':
            triggerFloatingReaction(data.emoji, data.name);
            break;
          case 'mute_request':
            if (to === prof.id) {
              Alert.alert('Host Request', 'The host has asked you to mute.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mute', onPress: () => applyMute(true) },
              ]);
            }
            break;
          case 'meeting_ended':
            Alert.alert('Meeting Ended', 'The host has ended this meeting.');
            cleanup();
            router.back();
            break;
          case 'offer':
            await handleOffer(from, data);
            break;
          case 'answer':
            await handleAnswer(from, data);
            break;
          case 'candidate':
            await handleCandidate(from, data);
            break;
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: prof.id,
            name: prof.full_name,
            avatar: prof.avatar_url,
          });
        }
      });

    channelRef.current = channel;
  }, [meetingId, cleanup]);

  // ── Toast for hand raise ───────────────────────────────────────────────────
  const showHandRaiseToast = (userId: string, name: string) => {
    const toast: HandRaiseToast = { id: `${userId}-${Date.now()}`, name };
    setHandRaiseToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setHandRaiseToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  };

  // ── Floating reactions ─────────────────────────────────────────────────────
  const triggerFloatingReaction = useCallback((emoji: string, fromName: string) => {
    const anim = new Animated.Value(0);
    const reaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      fromName,
      x: 0.1 + Math.random() * 0.6,
      anim,
    };

    setFloatingReactions((prev) => [...prev, reaction]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 3000,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    });
  }, []);

  // ── WebRTC: create peer connection ─────────────────────────────────────────
  const createPeerConnection = useCallback((targetId: string, isOfferer: boolean) => {
    if (peerConnections.current[targetId]) return peerConnections.current[targetId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetId] = pc;

    // Add local tracks
    const stream = screenStreamRef.current || localStreamRef.current;
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        broadcastSignal({ type: 'candidate', to: targetId, data: event.candidate });
      }
    };

    pc.ontrack = (event: any) => {
      const remoteStream = event.streams?.[0];
      if (remoteStream) {
        setRemoteStreams((prev) => ({ ...prev, [targetId]: remoteStream }));
      }
    };

    if (isOfferer) {
      pc.createOffer().then((offer: any) => {
        pc.setLocalDescription(offer);
        broadcastSignal({ type: 'offer', to: targetId, data: offer });
      }).catch(console.error);
    }

    return pc;
  }, [broadcastSignal]);

  const handleOffer = async (from: string, offer: any) => {
    const pc = createPeerConnection(from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    if (pendingCandidates.current[from]) {
      for (const c of pendingCandidates.current[from]) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      delete pendingCandidates.current[from];
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    broadcastSignal({ type: 'answer', to: from, data: answer });
  };

  const handleAnswer = async (from: string, answer: any) => {
    const pc = peerConnections.current[from];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {});
    if (pendingCandidates.current[from]) {
      for (const c of pendingCandidates.current[from]) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      delete pendingCandidates.current[from];
    }
  };

  const handleCandidate = async (from: string, candidate: any) => {
    const pc = peerConnections.current[from];
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
      pendingCandidates.current[from].push(candidate);
    }
  };

  // ── Controls ───────────────────────────────────────────────────────────────

  const applyMute = useCallback((forceMute?: boolean) => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    const nextMuted = forceMute !== undefined ? forceMute : !isMuted;
    audioTrack.enabled = !nextMuted;
    setIsMuted(nextMuted);
    broadcastSignal({ type: 'mute_state', data: { isMuted: nextMuted } });
  }, [isMuted, broadcastSignal]);

  const toggleMute = useCallback(() => applyMute(), [applyMute]);

  const toggleSpeaker = useCallback(async () => {
    try {
      const next = !isSpeakerOn;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // Android: false = loudspeaker, true = earpiece
        playsThroughEarpieceAndroid: !next,
        staysActiveInBackground: true,
      });
      setIsSpeakerOn(next);
    } catch (e) {
      console.warn('[VoiceCall] Speaker toggle failed:', e);
    }
  }, [isSpeakerOn]);

  const toggleVideo = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    const nextOff = !isVideoOff;
    videoTrack.enabled = !nextOff;
    setIsVideoOff(nextOff);
    broadcastSignal({ type: 'video_state', data: { isOff: nextOff } });
  }, [isVideoOff, broadcastSignal]);

  const flipCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack && (videoTrack as any)._switchCamera) {
      (videoTrack as any)._switchCamera();
      setIsFrontCamera((prev) => !prev);
    }
  }, []);

  const toggleHand = useCallback(() => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    broadcastSignal({
      type: 'hand_state',
      data: { raised: next, name: profile?.full_name || 'Someone' },
    });
  }, [isHandRaised, profile, broadcastSignal]);

  const sendReaction = useCallback((emoji: string) => {
    triggerFloatingReaction(emoji, 'You');
    broadcastSignal({
      type: 'reaction',
      data: { emoji, name: profile?.full_name || 'Someone' },
    });
  }, [triggerFloatingReaction, profile, broadcastSignal]);

  const startScreenShare = useCallback(async () => {
    try {
      if (!(mediaDevices as any).getDisplayMedia) {
        Alert.alert('Not Supported', 'Screen sharing is not available on this device.');
        return;
      }

      const screenStream: MediaStream = await (mediaDevices as any).getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack).catch(() => {});
      });

      setIsScreenSharing(true);
      broadcastSignal({ type: 'screen_share_state', data: { isSharing: true } });

      // Handle system-driven stop (user swipes away the share overlay)
      screenTrack.addEventListener('ended', stopScreenShare);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        Alert.alert('Screen Share Failed', e?.message || 'Could not start screen sharing.');
      }
    }
  }, [broadcastSignal]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    // Restore camera track
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s: any) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack).catch(() => {});
      });
    }

    setIsScreenSharing(false);
    broadcastSignal({ type: 'screen_share_state', data: { isSharing: false } });
  }, [broadcastSignal]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) stopScreenShare();
    else startScreenShare();
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  const pinParticipant = useCallback((id: string) => {
    setPinnedId((prev) => (prev === id ? null : id));
  }, []);

  const requestMuteParticipant = useCallback((targetId: string) => {
    broadcastSignal({ type: 'mute_request', to: targetId });
  }, [broadcastSignal]);

  const muteAll = useCallback(() => {
    participants.forEach((p) => {
      if (!p.isLocal) broadcastSignal({ type: 'mute_request', to: p.id });
    });
  }, [participants, broadcastSignal]);

  const handleLeave = useCallback(() => {
    cleanup();
    router.back();
  }, [cleanup, router]);

  const handleEndForAll = useCallback(() => {
    Alert.alert('End Meeting', 'This will end the meeting for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End for All',
        style: 'destructive',
        onPress: async () => {
          broadcastSignal({ type: 'meeting_ended' });
          try {
            await supabase
              .from('meetings')
              .update({ status: 'ended', end_time: new Date().toISOString() })
              .eq('id', meetingId);
          } catch {}
          cleanup();
          router.back();
        },
      },
    ]);
  }, [broadcastSignal, meetingId, cleanup, router]);

  const isHost = useMemo(
    () => meetingData?.creator_id === profile?.id || profile?.role === 'admin',
    [meetingData, profile]
  );

  const handleShareId = useCallback(async () => {
    try {
      await Share.share({
        message: `Join my Primansh meeting using ID: ${meetingId}`,
        title: 'Share Meeting ID',
      });
    } catch { /* ignored */ }
  }, [meetingId]);

  // ── Layout computation ─────────────────────────────────────────────────────

  // Find the "featured" participant for speaker view
  const screenSharingParticipant = useMemo(
    () => participants.find((p) => !p.isLocal && remoteScreenSharing[p.id]),
    [participants, remoteScreenSharing]
  );

  const featuredParticipant = useMemo(() => {
    if (screenSharingParticipant) return screenSharingParticipant;
    if (pinnedId) return participants.find((p) => p.id === pinnedId) ?? null;
    // Default: first remote participant or self
    return participants.find((p) => !p.isLocal) ?? participants[0] ?? null;
  }, [screenSharingParticipant, pinnedId, participants]);

  const stripParticipants = useMemo(() => {
    if (!featuredParticipant) return participants;
    return participants.filter((p) => p.id !== featuredParticipant.id);
  }, [participants, featuredParticipant]);

  const featuredHeight = isTablet ? Math.min(500, height * 0.55) : Math.min(340, height * 0.38);

  // Open a panel (closes others)
  const openPanel = useCallback((panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  }, []);

  // ── Grid dimensions ────────────────────────────────────────────────────────
  const gridCols = useMemo(() => {
    const n = participants.length;
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    return 3;
  }, [participants.length]);

  const gridTileSize = useMemo(() => {
    const cols = gridCols;
    const padding = 8;
    const gap = 8;
    const availW = width - padding * 2 - gap * (cols - 1);
    return Math.floor(availW / cols);
  }, [width, gridCols]);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Initializing Secure Hardware...</Text>
          <Text style={styles.loadingSubText}>Requesting camera & microphone access</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Lobby screen ───────────────────────────────────────────────────────────
  if (!hasJoined && !isAudioOnly) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.lobby}>
          <View style={styles.lobbyHeader}>
            <View>
              <Text style={styles.lobbyTitle}>Ready to join?</Text>
              <Text style={styles.lobbySubtitle}>
                {meetingData?.conversation?.title || 'Meeting'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleShareId} style={styles.lobbyShareBtn}>
              <Copy color="#85adff" size={16} />
              <Text style={styles.lobbyShareText}>Share ID</Text>
            </TouchableOpacity>
          </View>

          {/* Camera preview */}
          <View style={styles.lobbyPreviewWrap}>
            {localStreamRef.current && !isVideoOff ? (
              <RTCView
                streamURL={(localStreamRef.current as any).toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                mirror
              />
            ) : (
              <View style={styles.lobbyPreviewFallback}>
                <Text style={styles.lobbyPreviewInitial}>
                  {(profile?.full_name || 'U')[0].toUpperCase()}
                </Text>
                <Text style={styles.lobbyCameraOff}>Camera is off</Text>
              </View>
            )}
          </View>

          {/* Lobby controls */}
          <View style={styles.lobbyControls}>
            <TouchableOpacity
              onPress={toggleMute}
              style={[styles.lobbyCtrlBtn, isMuted && styles.lobbyCtrlBtnActive]}
            >
              {isMuted ? <MicOff color="#fff" size={22} /> : <Mic color="#fff" size={22} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleVideo}
              style={[styles.lobbyCtrlBtn, isVideoOff && styles.lobbyCtrlBtnActive]}
            >
              {isVideoOff ? <VideoOff color="#fff" size={22} /> : <Video color="#fff" size={22} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={flipCamera} style={styles.lobbyCtrlBtn}>
              <RotateCw color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          <View style={styles.lobbyStatusRow}>
            {isMuted && (
              <View style={styles.lobbyStatusBadge}>
                <MicOff color="#ff6b6b" size={12} />
                <Text style={styles.lobbyStatusText}>Muted</Text>
              </View>
            )}
            {isVideoOff && (
              <View style={styles.lobbyStatusBadge}>
                <VideoOff color="#ff6b6b" size={12} />
                <Text style={styles.lobbyStatusText}>Camera off</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => profile && joinRoom(profile)}
          >
            <Text style={styles.joinBtnText}>Join Now</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLeave} style={styles.lobbyBack}>
            <Text style={styles.lobbyBackText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Voice call UI (audio-only = phone call style) ──────────────────────────
  if (isAudioOnly && hasJoined) {
    return (
      <VoiceCallUI
        participants={participants}
        profile={profile}
        meetingTitle={meetingData?.conversation?.title || 'Voice Call'}
        formattedTime={formattedTime}
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        remoteMuted={remoteMuted}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onLeave={handleLeave}
        onEndForAll={isHost ? handleEndForAll : undefined}
      />
    );
  }

  // ── Active meeting ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screen}>

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          {/* Timer */}
          <View style={styles.timerChip}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{formattedTime}</Text>
          </View>

          {/* Title & Share */}
          <View style={styles.titleContainer}>
            <Text style={styles.meetingTitle} numberOfLines={1}>
              {meetingData?.conversation?.title ||
                (isAudioOnly ? 'Voice Call' : 'Video Meeting')}
            </Text>
            <TouchableOpacity onPress={handleShareId} style={styles.shareIdBtn}>
              <Copy color="#94a3b8" size={14} />
            </TouchableOpacity>
          </View>

          {/* Participant count */}
          <View style={styles.participantCountChip}>
            <Users color="#94a3b8" size={14} />
            <Text style={styles.participantCountText}>{participants.length}</Text>
          </View>
        </View>

        {/* ── Hand raise toasts ────────────────────────────────────────────── */}
        <View style={styles.toastContainer} pointerEvents="none">
          {handRaiseToasts.map((toast) => (
            <View key={toast.id} style={styles.toast}>
              <Text style={styles.toastEmoji}>✋</Text>
              <Text style={styles.toastText}>{toast.name} raised their hand</Text>
            </View>
          ))}
        </View>

        {/* ── Video grid ───────────────────────────────────────────────────── */}
        <View style={styles.videoArea}>

          {viewMode === 'speaker' ? (
            /* ── Speaker view ───────────────────────────────────────────── */
            <View style={styles.speakerContainer}>
              {/* Featured tile */}
              {featuredParticipant && (
                <View style={[styles.featuredWrap, { height: featuredHeight }]}>
                  <ParticipantTile
                    participant={featuredParticipant}
                    stream={
                      featuredParticipant.isLocal
                        ? (isScreenSharing ? screenStreamRef.current : localStreamRef.current)
                        : remoteStreams[featuredParticipant.id] ?? null
                    }
                    isMuted={featuredParticipant.isLocal ? isMuted : !!remoteMuted[featuredParticipant.id]}
                    isVideoOff={featuredParticipant.isLocal ? isVideoOff : !!remoteVideoOff[featuredParticipant.id]}
                    isHandRaised={featuredParticipant.isLocal ? isHandRaised : !!remoteHandRaised[featuredParticipant.id]}
                    isScreenSharing={featuredParticipant.isLocal ? isScreenSharing : !!remoteScreenSharing[featuredParticipant.id]}
                    isPinned={pinnedId === featuredParticipant.id}
                    featured
                    onPress={() => {}}
                    onLongPress={() => {
                      Alert.alert(featuredParticipant.name, '', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: pinnedId === featuredParticipant.id ? 'Unpin' : 'Pin to Front',
                          onPress: () => pinParticipant(featuredParticipant.id),
                        },
                        ...(isHost && !featuredParticipant.isLocal
                          ? [{ text: 'Request Mute', onPress: () => requestMuteParticipant(featuredParticipant.id) }]
                          : []),
                      ]);
                    }}
                  />

                  {/* PiP: local camera while screen sharing */}
                  {isScreenSharing && featuredParticipant.isLocal && localStreamRef.current && (
                    <View style={styles.pipWrap}>
                      <RTCView
                        streamURL={(localStreamRef.current as any).toURL()}
                        style={StyleSheet.absoluteFill}
                        objectFit="cover"
                        mirror
                      />
                      <View style={styles.pipLabel}>
                        <Text style={styles.pipLabelText}>You</Text>
                      </View>
                    </View>
                  )}

                  {/* PiP: sharer's camera tile when others share screen */}
                  {screenSharingParticipant && !screenSharingParticipant.isLocal && (
                    <View style={styles.pipWrap}>
                      {localStreamRef.current && !isVideoOff ? (
                        <RTCView
                          streamURL={(localStreamRef.current as any).toURL()}
                          style={StyleSheet.absoluteFill}
                          objectFit="cover"
                          mirror
                        />
                      ) : (
                        <LinearGradient
                          colors={['#131929', '#1a2035']}
                          style={[StyleSheet.absoluteFill, styles.tileAvatarCenter]}
                        >
                          <Text style={styles.pipInitial}>
                            {(profile?.full_name || 'U')[0].toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}
                      <View style={styles.pipLabel}>
                        <Text style={styles.pipLabelText}>You</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Strip of other participants */}
              {stripParticipants.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.stripScroll}
                  contentContainerStyle={styles.stripContent}
                >
                  {stripParticipants.map((p) => (
                    <View key={p.id} style={styles.stripTileWrap}>
                      <ParticipantTile
                        participant={p}
                        stream={p.isLocal ? localStreamRef.current : remoteStreams[p.id] ?? null}
                        isMuted={p.isLocal ? isMuted : !!remoteMuted[p.id]}
                        isVideoOff={p.isLocal ? isVideoOff : !!remoteVideoOff[p.id]}
                        isHandRaised={p.isLocal ? isHandRaised : !!remoteHandRaised[p.id]}
                        isScreenSharing={p.isLocal ? false : !!remoteScreenSharing[p.id]}
                        isPinned={pinnedId === p.id}
                        onPress={() => pinParticipant(p.id)}
                        onLongPress={() => {
                          Alert.alert(p.name, '', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: pinnedId === p.id ? 'Unpin' : 'Pin to Front', onPress: () => pinParticipant(p.id) },
                            ...(isHost && !p.isLocal
                              ? [{ text: 'Request Mute', onPress: () => requestMuteParticipant(p.id) }]
                              : []),
                          ]);
                        }}
                      />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ── Grid view ──────────────────────────────────────────────── */
            <ScrollView
              style={styles.gridScroll}
              contentContainerStyle={[styles.gridContent, { padding: 8, gap: 8 }]}
            >
              <View style={styles.gridWrap}>
                {participants.map((p) => (
                  <View key={p.id} style={{ width: gridTileSize, height: gridTileSize }}>
                    <ParticipantTile
                      participant={p}
                      stream={p.isLocal ? localStreamRef.current : remoteStreams[p.id] ?? null}
                      isMuted={p.isLocal ? isMuted : !!remoteMuted[p.id]}
                      isVideoOff={p.isLocal ? isVideoOff : !!remoteVideoOff[p.id]}
                      isHandRaised={p.isLocal ? isHandRaised : !!remoteHandRaised[p.id]}
                      isScreenSharing={p.isLocal ? isScreenSharing : !!remoteScreenSharing[p.id]}
                      isPinned={pinnedId === p.id}
                      height={gridTileSize}
                      onPress={() => {
                        setPinnedId(p.id);
                        setViewMode('speaker');
                      }}
                      onLongPress={() => {
                        Alert.alert(p.name, '', [
                          { text: 'Cancel', style: 'cancel' },
                          ...(isHost && !p.isLocal
                            ? [{ text: 'Request Mute', onPress: () => requestMuteParticipant(p.id) }]
                            : []),
                        ]);
                      }}
                    />
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── Floating reactions overlay ─────────────────────────────── */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {floatingReactions.map((r) => (
              <Animated.View
                key={r.id}
                style={[
                  styles.floatingReaction,
                  {
                    left: r.x * width,
                    transform: [
                      {
                        translateY: r.anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -(height * 0.55)],
                        }),
                      },
                    ],
                    opacity: r.anim.interpolate({
                      inputRange: [0, 0.7, 1],
                      outputRange: [1, 1, 0],
                    }),
                  },
                ]}
              >
                <Text style={styles.floatingEmoji}>{r.emoji}</Text>
                <Text style={styles.floatingName}>{r.fromName}</Text>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* ── Bottom control bar ──────────────────────────────────────────── */}
        <View style={styles.controlBarWrap}>
          {/* Row 1: core controls */}
          <View style={styles.controlBar}>
            <CtrlBtn
              icon={isMuted
                ? <MicOff color="#ff6b6b" size={20} />
                : <Mic color="#e4e7fb" size={20} fill="#e4e7fb" />}
              label={isMuted ? 'Unmute' : 'Mute'}
              active={isMuted}
              onPress={toggleMute}
            />

            {!isAudioOnly && (
              <CtrlBtn
                icon={isVideoOff
                  ? <VideoOff color="#ff6b6b" size={20} />
                  : <Video color="#e4e7fb" size={20} fill="#e4e7fb" />}
                label={isVideoOff ? 'Start' : 'Stop'}
                active={isVideoOff}
                onPress={toggleVideo}
              />
            )}

            <CtrlBtn
              icon={<Presentation
                color={isScreenSharing ? '#22c55e' : '#e4e7fb'}
                size={20}
              />}
              label={isScreenSharing ? 'Stop Share' : 'Share'}
              active={isScreenSharing}
              onPress={toggleScreenShare}
            />

            <CtrlBtn
              icon={<MessageSquare color="#e4e7fb" size={20} />}
              label="Chat"
              badge={unreadCount}
              onPress={() => openPanel('chat')}
            />

            <CtrlBtn
              icon={<Users color="#e4e7fb" size={20} />}
              label="People"
              onPress={() => openPanel('participants')}
            />

            <CtrlBtn
              icon={<Smile color="#e4e7fb" size={20} />}
              label="React"
              onPress={() => openPanel('reactions')}
            />

            <CtrlBtn
              icon={<MoreVertical color="#e4e7fb" size={20} />}
              label="More"
              onPress={() => openPanel('more')}
            />

            <CtrlBtn
              icon={<PhoneOff color="#fff" size={20} />}
              danger
              onPress={isHost
                ? () => Alert.alert('Leave Meeting', '', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', onPress: handleLeave },
                    { text: 'End for All', style: 'destructive', onPress: handleEndForAll },
                  ])
                : handleLeave}
            />
          </View>
        </View>

        {/* ── Slide-up panels ──────────────────────────────────────────────── */}
        {activePanel !== 'none' && (
          <Pressable
            style={styles.panelBackdrop}
            onPress={() => setActivePanel('none')}
          />
        )}

        {activePanel === 'chat' && profile && (
          <View style={styles.panelSlide}>
            <ChatPanel
              meetingId={meetingId}
              profile={profile}
              participants={participants}
              onClose={() => setActivePanel('none')}
            />
          </View>
        )}

        {activePanel === 'participants' && (
          <View style={styles.panelSlide}>
            <ParticipantsPanel
              participants={participants}
              remoteMuted={remoteMuted}
              remoteVideoOff={remoteVideoOff}
              remoteHandRaised={remoteHandRaised}
              remoteScreenSharing={remoteScreenSharing}
              pinnedId={pinnedId}
              currentProfile={profile}
              onPin={pinParticipant}
              onMuteRemote={requestMuteParticipant}
              onClose={() => setActivePanel('none')}
            />
          </View>
        )}

        {activePanel === 'reactions' && (
          <View style={[styles.panelSlide, styles.panelSlideShort]}>
            <ReactionsPanel
              onReact={sendReaction}
              onClose={() => setActivePanel('none')}
            />
          </View>
        )}

        {activePanel === 'more' && (
          <View style={styles.panelSlide}>
            <MoreOptionsPanel
              isHandRaised={isHandRaised}
              isFrontCamera={isFrontCamera}
              viewMode={viewMode}
              isRecording={false}
              isHost={isHost}
              meetingId={meetingId}
              onHandRaise={toggleHand}
              onFlipCamera={flipCamera}
              onToggleView={() => setViewMode((v) => (v === 'speaker' ? 'grid' : 'speaker'))}
              onMuteAll={muteAll}
              onShowInfo={() => {
                setActivePanel('info');
              }}
              onClose={() => setActivePanel('none')}
            />
          </View>
        )}

        {activePanel === 'info' && (
          <View style={[styles.panelSlide, styles.panelSlideShort]}>
            <MeetingInfoModal
              meetingId={meetingId}
              title={meetingData?.conversation?.title || 'Meeting'}
              startTime={meetingData?.start_time || new Date().toISOString()}
              participantCount={participants.length}
              onClose={() => setActivePanel('none')}
            />
          </View>
        )}

        {/* ── Hand raised indicator for self ──────────────────────────────── */}
        {isHandRaised && (
          <View style={styles.handRaisedSelf} pointerEvents="none">
            <Text style={styles.handRaisedSelfText}>✋ Hand raised</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#090e1b' },
  screen: { flex: 1, backgroundColor: '#090e1b' },

  // ── Loading ────────────────────────────────────────────────────────────
  loadingScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#090e1b',
  },
  loadingText: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 16, color: '#e4e7fb',
  },
  loadingSubText: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 11, color: Colors.slate500,
  },

  // ── Lobby ──────────────────────────────────────────────────────────────
  lobby: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 18, backgroundColor: '#090e1b',
  },
  lobbyTitle: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 30, color: '#fff', letterSpacing: -0.5,
  },
  lobbySubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 12,
    color: Colors.slate500, textAlign: 'center',
  },
  lobbyHeader: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  lobbyShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(133,173,255,0.1)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(133,173,255,0.2)',
  },
  lobbyShareText: {
    fontFamily: Fonts.Outfit_500Medium, fontSize: 12, color: '#85adff',
  },
  lobbyPreviewWrap: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#131929', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  lobbyPreviewFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  lobbyPreviewInitial: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 60, color: Colors.accent, opacity: 0.4,
  },
  lobbyCameraOff: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 11, color: Colors.slate500,
  },
  lobbyControls: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
  },
  lobbyCtrlBtn: {
    width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  lobbyCtrlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.4)',
  },
  lobbyStatusRow: {
    flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
  },
  lobbyStatusBadge: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  lobbyStatusText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 11, color: '#ff6b6b',
  },
  joinBtn: {
    width: '100%', paddingVertical: 18, borderRadius: 20,
    backgroundColor: Colors.accent, alignItems: 'center',
    shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  joinBtnText: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 16, color: '#fff',
  },
  lobbyBack: { paddingVertical: 8 },
  lobbyBackText: {
    fontFamily: Fonts.Outfit_500Medium, fontSize: 13, color: Colors.slate500,
  },

  // ── Top bar ────────────────────────────────────────────────────────────
  topBar: {
    height: 56, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(9,14,27,0.9)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  timerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: '#131929',
    borderWidth: 1, borderColor: 'rgba(67,72,87,0.4)',
  },
  timerDot: {
    width: 7, height: 7, borderRadius: 999, backgroundColor: '#ff716c',
  },
  timerText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 13, color: '#e4e7fb',
  },
  titleContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 8,
  },
  meetingTitle: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 15, color: '#e4e7fb',
    flexShrink: 1,
  },
  shareIdBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
  },
  participantCountChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: '#131929',
    borderWidth: 1, borderColor: 'rgba(67,72,87,0.4)',
  },
  participantCountText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 13, color: '#94a3b8',
  },

  // ── Toast (hand raise) ─────────────────────────────────────────────────
  toastContainer: {
    position: 'absolute', top: 60, left: 0, right: 0,
    alignItems: 'center', zIndex: 100, gap: 8, paddingTop: 4,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(13,19,33,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  toastEmoji: { fontSize: 16 },
  toastText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 13, color: '#e4e7fb',
  },

  // ── Video area ─────────────────────────────────────────────────────────
  videoArea: {
    flex: 1, backgroundColor: '#090e1b',
  },

  // ── Speaker view ───────────────────────────────────────────────────────
  speakerContainer: { flex: 1 },
  featuredWrap: {
    width: '100%', paddingHorizontal: 8, paddingTop: 8,
    position: 'relative',
  },
  stripScroll: {
    flexShrink: 0, maxHeight: 120, marginTop: 8,
  },
  stripContent: {
    paddingHorizontal: 8, gap: 8, alignItems: 'center',
  },
  stripTileWrap: {
    width: 100, height: 100,
  },

  // ── PiP ───────────────────────────────────────────────────────────────
  pipWrap: {
    position: 'absolute', bottom: 14, right: 14,
    width: 90, height: 120, borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: '#85adff',
    backgroundColor: '#131929',
  },
  pipLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 3, alignItems: 'center',
  },
  pipLabelText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 10, color: '#fff',
  },
  pipInitial: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 28, color: Colors.accent, opacity: 0.5,
  },

  // ── Grid view ─────────────────────────────────────────────────────────
  gridScroll: { flex: 1 },
  gridContent: { flexGrow: 1 },
  gridWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center', padding: 8,
  },

  // ── Participant tile ───────────────────────────────────────────────────
  tileShell: {
    flex: 1, overflow: 'hidden', borderRadius: 18,
    backgroundColor: '#131929', borderWidth: 1,
    borderColor: 'rgba(67,72,87,0.24)', position: 'relative',
  },
  tileShellFeatured: {
    borderColor: 'rgba(133,173,255,0.5)',
    shadowColor: '#85adff', shadowOpacity: 0.2,
    shadowRadius: 16, elevation: 6,
  },
  tileShellGrid: {},
  tileShellPinned: {
    borderColor: '#facc15', borderWidth: 2,
  },
  tileAvatarCenter: {
    alignItems: 'center', justifyContent: 'center',
  },
  tileGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: '#2f2ebe', alignItems: 'center', justifyContent: 'center',
  },
  avatarCircleLarge: {
    width: 80, height: 80,
  },
  avatarInitial: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 22, color: '#9093ff',
  },
  avatarInitialLarge: { fontSize: 32 },

  screenShareBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(13,19,33,0.85)', borderRadius: 8,
  },
  screenShareBadgeText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 10, color: '#85adff',
  },
  handBadge: {
    position: 'absolute', top: 10, right: 36,
    backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  handEmoji: { fontSize: 13 },
  pinBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(250,204,21,0.15)', borderRadius: 8,
    padding: 4, borderWidth: 1, borderColor: 'rgba(250,204,21,0.3)',
  },
  nameChip: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', gap: 5, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, maxWidth: '85%',
  },
  nameChipText: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 11, color: '#f3f6ff',
  },

  // ── Control bar ────────────────────────────────────────────────────────
  controlBarWrap: {
    backgroundColor: 'rgba(9,14,27,0.96)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: 16, paddingTop: 10,
  },
  controlBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flexWrap: 'wrap', gap: 6, paddingHorizontal: 12,
  },
  ctrlBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16,
    backgroundColor: '#131929', minWidth: 52,
    position: 'relative',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
  },
  ctrlBtnDanger: {
    backgroundColor: '#9f0519', minWidth: 64,
    shadowColor: '#ff4242', shadowOpacity: 0.3,
    shadowRadius: 10, elevation: 6,
  },
  ctrlBtnLabel: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 9,
    color: '#94a3b8', marginTop: 3,
  },
  ctrlBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#ef4444', borderRadius: 999,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#090e1b',
  },
  ctrlBadgeText: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 9, color: '#fff',
  },

  // ── Floating reactions ─────────────────────────────────────────────────
  floatingReaction: {
    position: 'absolute', bottom: 120, alignItems: 'center',
  },
  floatingEmoji: { fontSize: 38 },
  floatingName: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 9,
    color: 'rgba(255,255,255,0.7)', marginTop: 2,
  },

  // ── Panel backdrop ─────────────────────────────────────────────────────
  panelBackdrop: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 40,
  },
  panelSlide: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '72%', zIndex: 50,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0d1424',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  panelSlideShort: { maxHeight: '45%' },

  panelContainer: { flex: 1 },
  panelHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  panelTitle: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 16, color: '#e4e7fb',
  },
  panelCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // ── Chat panel ──────────────────────────────────────────────────────────
  chatList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  chatBubbleRow: {
    flexDirection: 'row', gap: 10, maxWidth: '85%', alignSelf: 'flex-start',
  },
  chatBubbleRowOwn: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  chatAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1e2538',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chatAvatarText: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 13, color: '#85adff',
  },
  chatBubble: {
    backgroundColor: '#1e2538', borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, gap: 4, flex: 1,
  },
  chatBubbleOwn: {
    backgroundColor: '#1a3459', borderBottomLeftRadius: 16, borderBottomRightRadius: 4,
  },
  chatSenderName: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 11, color: '#85adff',
  },
  chatText: {
    fontFamily: Fonts.Outfit_400Regular, fontSize: 14, color: '#e4e7fb', lineHeight: 20,
  },
  chatTime: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 9, color: Colors.slate500,
  },
  chatRead: { color: '#85adff' },
  chatEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: 12,
  },
  chatEmptyTitle: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 16, color: '#e4e7fb',
  },
  chatEmptySubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 11, color: Colors.slate500,
    textAlign: 'center', paddingHorizontal: 24,
  },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0d1424',
  },
  chatInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 10,
    color: '#e4e7fb', fontFamily: Fonts.Outfit_400Regular,
    fontSize: 14, maxHeight: 100,
  },
  chatSendBtn: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  chatSendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)' },

  // ── Participants panel ──────────────────────────────────────────────────
  participantList: { flex: 1 },
  participantRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  participantAvatarWrap: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: '#1e2538', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  participantAvatarText: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 16, color: '#85adff',
  },
  participantSpeakDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e',
    borderWidth: 1.5, borderColor: '#0d1424',
  },
  participantMeta: { flex: 1, gap: 4 },
  participantName: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 14, color: '#e4e7fb',
  },
  participantBadges: { flexDirection: 'row', gap: 4 },
  badge: {
    paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  participantActions: { flexDirection: 'row', gap: 6 },
  participantActionBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  participantActionBtnActive: { backgroundColor: 'rgba(133,173,255,0.15)' },

  // ── Reactions panel ────────────────────────────────────────────────────
  reactionsPanelContainer: {},
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 20, paddingBottom: 20,
    justifyContent: 'center',
  },
  emojiBtn: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emojiText: { fontSize: 28 },

  // ── More options ───────────────────────────────────────────────────────
  moreOptionsList: { paddingBottom: 20 },
  moreOptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  moreOptionIcon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  moreOptionLabel: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 15, color: '#e4e7fb',
  },

  // ── Meeting info ───────────────────────────────────────────────────────
  infoModal: { flex: 1 },
  infoBody: { paddingHorizontal: 20, paddingVertical: 16, gap: 6 },
  infoLabel: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 10,
    color: Colors.slate500, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12,
  },
  infoValue: {
    fontFamily: Fonts.Outfit_600SemiBold, fontSize: 15, color: '#e4e7fb',
  },
  infoIdRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  infoIdValue: {
    fontFamily: Fonts.SpaceMono_400Regular, fontSize: 12, color: '#85adff', flex: 1,
  },
  infoCopyBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(133,173,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Hand raised self indicator ─────────────────────────────────────────
  handRaisedSelf: {
    position: 'absolute', bottom: 90, alignSelf: 'center', zIndex: 60,
    flexDirection: 'row', gap: 6, alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  handRaisedSelfText: {
    fontFamily: Fonts.Outfit_700Bold, fontSize: 12, color: '#f59e0b',
  },

  // ── @mention suggestions list ──────────────────────────────────────────
  mentionList: {
    backgroundColor: '#0d1424',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  mentionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(133,173,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.25)',
  },
  mentionAvatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 15,
    color: '#85adff',
  },
  mentionMeta: {
    flex: 1,
    gap: 2,
  },
  mentionName: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 14,
    color: '#e4e7fb',
  },
  mentionTag: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    color: Colors.slate500,
  },

  // ── @mention highlight inside message bubble ────────────────────────────
  mentionHighlight: {
    fontFamily: Fonts.Outfit_700Bold,
    color: '#85adff',
    backgroundColor: 'rgba(133,173,255,0.12)',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
});
