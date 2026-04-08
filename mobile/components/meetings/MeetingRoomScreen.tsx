import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import {
  ChevronLeft,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreVertical,
  PhoneOff,
  RotateCcw,
  Search,
  UserPlus,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react-native';
import { Colors, Fonts } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useMeetingChat } from '../../hooks/useMeetingChat';
import {
  endMeetingForAll,
  fetchMeetingById,
  getCurrentMobileProfile,
  inviteProfileToMeeting,
  listInvitableMeetingProfiles,
  MobileMeeting,
  MobileProfile,
} from '../../lib/meetings';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CALL_ROUTE_RECORDER_OPTIONS = {
  android: {
    extension: '.m4a',
    outputFormat: 2,
    audioEncoder: 3,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'aac',
    audioQuality: 96,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

const BLUETOOTH_INPUT_MATCHERS = ['bluetooth', 'airpods', 'buds'];
const WIRED_INPUT_MATCHERS = ['wired', 'headset', 'headphones', 'usb', 'line'];
const BUILT_IN_INPUT_MATCHERS = ['builtin', 'built-in', 'microphonebuiltin', 'telephony', 'receiver'];

type AudioRoutePreference = 'auto' | 'phone' | 'bluetooth';

type AudioInputDescriptor = {
  name: string;
  type: string;
  uid: string;
};

type Participant = {
  id: string;
  name: string;
  avatar?: string | null;
  isLocal: boolean;
};

type StreamBundle = {
  stream: MediaStream;
  url: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function matchesAudioInput(input: AudioInputDescriptor | null | undefined, matchers: string[]) {
  if (!input) return false;
  const haystack = `${input.type} ${input.name}`.toLowerCase();
  return matchers.some((matcher) => haystack.includes(matcher));
}

function isBluetoothAudioInput(input: AudioInputDescriptor | null | undefined) {
  return matchesAudioInput(input, BLUETOOTH_INPUT_MATCHERS);
}

function isWiredAudioInput(input: AudioInputDescriptor | null | undefined) {
  return matchesAudioInput(input, WIRED_INPUT_MATCHERS);
}

function isBuiltInAudioInput(input: AudioInputDescriptor | null | undefined) {
  return matchesAudioInput(input, BUILT_IN_INPUT_MATCHERS);
}

function MeetingTile({
  title,
  streamUrl,
  showVideo,
  muted,
  isLocal,
  isPresenting,
  isHandRaised,
  large = false,
}: {
  title: string;
  streamUrl?: string | null;
  showVideo: boolean;
  muted?: boolean;
  isLocal: boolean;
  isPresenting?: boolean;
  isHandRaised?: boolean;
  large?: boolean;
}) {
  return (
    <View style={[styles.tileShell, large ? styles.featuredTile : styles.thumbnailTile]}>
      {streamUrl && showVideo ? (
        <RTCView streamURL={streamUrl} style={styles.tileVideo} objectFit="cover" mirror={isLocal} />
      ) : (
        <View style={styles.tileFallback}>
          <Text style={[styles.tileFallbackText, large && styles.tileFallbackTextLarge]}>
            {(title || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.tileOverlay}>
        <Text style={styles.tileName}>
          {title}
          {isLocal ? ' (You)' : ''}
        </Text>
        <View style={styles.tileBadgeRow}>
          {isHandRaised ? (
            <View style={[styles.tileMuteBadge, styles.tileHandBadge]}>
              <Hand color="#fff" size={11} />
            </View>
          ) : null}
          {isPresenting ? (
            <View style={[styles.tileMuteBadge, styles.tilePresentingBadge]}>
              <MonitorUp color="#fff" size={11} />
            </View>
          ) : null}
          {muted ? (
            <View style={styles.tileMuteBadge}>
              <MicOff color="#fff" size={11} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ControlButton({
  onPress,
  icon,
  label,
  danger,
  active,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.controlWrap} activeOpacity={0.82}>
      <View style={[styles.controlButton, danger && styles.controlButtonDanger, active && styles.controlButtonActive]}>
        {icon}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MeetingRoomScreen() {
  const { id, audioOnly } = useLocalSearchParams<{ id?: string; audioOnly?: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [meeting, setMeeting] = useState<MobileMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(audioOnly !== 'true');
  const [isAudioOnly, setIsAudioOnly] = useState(audioOnly === 'true');
  const [isSpeakerOn, setIsSpeakerOn] = useState(audioOnly !== 'true');
  const [privateRoutePreference, setPrivateRoutePreference] = useState<AudioRoutePreference>('auto');
  const [hasBluetoothAudio, setHasBluetoothAudio] = useState(false);
  const [hasWiredAudio, setHasWiredAudio] = useState(false);
  const [currentAudioInput, setCurrentAudioInput] = useState<AudioInputDescriptor | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, StreamBundle>>({});
  const [remoteMutedStates, setRemoteMutedStates] = useState<Record<string, boolean>>({});
  const [remoteVideoStates, setRemoteVideoStates] = useState<Record<string, boolean>>({});
  const [remoteHandStates, setRemoteHandStates] = useState<Record<string, boolean>>({});
  const [connectionState, setConnectionState] = useState('Ready');
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [localBundle, setLocalBundle] = useState<StreamBundle | null>(null);
  const [screenShareBundle, setScreenShareBundle] = useState<StreamBundle | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [sharedParticipantId, setSharedParticipantId] = useState<string | null>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitees, setInvitees] = useState<MobileProfile[]>([]);
  const [invitingProfileId, setInvitingProfileId] = useState<string | null>(null);

  const channelRef = useRef<any>(null);
  const meetingStatusChannelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const routeRecorderRef = useRef<Audio.Recording | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const remoteStreamsRef = useRef<Record<string, StreamBundle>>({});
  const isMountedRef = useRef(true);
  const joinedRef = useRef(false);

  const canEndForAll = useMemo(() => {
    if (!profile || !meeting) return false;
    return profile.role === 'admin' || meeting.creator_id === profile.id;
  }, [meeting, profile]);

  const meetingTitle = useMemo(
    () => meeting?.conversation?.title || (isAudioOnly ? 'Voice call' : 'Meeting'),
    [isAudioOnly, meeting?.conversation?.title]
  );

  const { messages, isLoading: isChatLoading, isSending: isChatSending, sendMessage } = useMeetingChat(
    meeting?.id,
    profile
  );

  const filteredInvitees = useMemo(() => {
    const query = inviteSearch.trim().toLowerCase();
    if (!query) return invitees;

    return invitees.filter((item) => {
      const haystack = `${item.full_name} ${item.role}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [inviteSearch, invitees]);

  const featuredParticipant = useMemo(
    () =>
      (sharedParticipantId
        ? participants.find((item) => item.id === sharedParticipantId)
        : null) ||
      participants.find((item) => !item.isLocal) ||
      participants[0] ||
      null,
    [participants, sharedParticipantId]
  );

  const thumbnailParticipants = useMemo(() => {
    if (!featuredParticipant) return [];
    return participants.filter((item) => item.id !== featuredParticipant.id);
  }, [featuredParticipant, participants]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupRoom(true).catch((error) => console.error('[MeetingRoom] cleanupRoom failed', error));
    };
  }, []);

  useEffect(() => {
    if (!meeting?.start_time) return;
    const start = new Date(meeting.start_time).getTime();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [meeting?.start_time]);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    const speakerPreference = isAudioOnly ? isSpeakerOn : true;
    configureAudioRoute(speakerPreference).catch((error) =>
      console.error('[MeetingRoom] configureAudioRoute failed', error)
    );
  }, [isAudioOnly, isSpeakerOn]);

  useEffect(() => {
    if (!joined || !isAudioOnly) return;

    let active = true;
    let refreshInFlight = false;

    const refreshRoutes = async () => {
      if (!active || refreshInFlight) return;
      refreshInFlight = true;
      try {
        await refreshAvailableAudioRoutes();
      } catch (error) {
        console.error('[MeetingRoom] refreshAvailableAudioRoutes failed', error);
      } finally {
        refreshInFlight = false;
      }
    };

    refreshRoutes();
    const timer = setInterval(refreshRoutes, 2500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [joined, isAudioOnly, isSpeakerOn, privateRoutePreference]);

  useEffect(() => {
    if (isAudioOnly || !routeRecorderRef.current) return;

    routeRecorderRef.current.stopAndUnloadAsync().catch(() => {
      // The helper recorder is only used to manage call routes, so unload failures can be ignored here.
    }).finally(() => {
      routeRecorderRef.current = null;
    });
  }, [isAudioOnly]);

  useEffect(() => {
    if (!id) {
      Alert.alert('Meeting missing', 'This meeting link is incomplete.');
      router.replace('/(tabs)/meetings');
      return;
    }
    initializeRoom();
  }, [id]);

  useEffect(() => {
    if (!loading && isAudioOnly && !joined && !joining && meeting && profile) {
      joinMeetingRoom();
    }
  }, [joining, joined, isAudioOnly, loading, meeting, profile]);

  async function initializeRoom() {
    setLoading(true);
    try {
      const [currentProfile, currentMeeting] = await Promise.all([
        getCurrentMobileProfile(),
        fetchMeetingById(id as string),
      ]);
      if (!currentProfile) throw new Error('You need to log in before joining a meeting.');
      if (currentMeeting.status === 'ended') throw new Error('This meeting has already ended.');

      const audioMode = audioOnly === 'true' || currentMeeting.is_audio_only === true;
      setProfile(currentProfile);
      setMeeting(currentMeeting);
      setIsAudioOnly(audioMode);
      setIsVideoEnabled(!audioMode);
      setIsSpeakerOn(!audioMode);
      setPrivateRoutePreference('auto');
      setCurrentAudioInput(null);
      setHasBluetoothAudio(false);
      setHasWiredAudio(false);
      await prepareLocalMedia(!audioMode);
      setParticipants([buildLocalParticipant(currentProfile)]);
      subscribeToMeetingStatus(currentMeeting.id);
      setConnectionState(audioMode ? 'Joining audio room' : 'Preview ready');
    } catch (error: any) {
      Alert.alert('Could not open meeting', error?.message || 'Please try again.');
      router.replace('/(tabs)/meetings');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }

  function subscribeToMeetingStatus(meetingId: string) {
    const channel = supabase
      .channel(`meeting-status:${meetingId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meetings', filter: `id=eq.${meetingId}` },
        (payload) => {
          const updated = payload.new as MobileMeeting;
          setMeeting(updated);

          if (updated.status === 'ended') {
            if (joinedRef.current) {
              Alert.alert('Meeting ended', 'The host ended this meeting.');
              leaveMeeting(false, true);
            } else {
              Alert.alert('Meeting ended', 'This meeting is no longer active.');
              router.replace('/(tabs)/meetings');
            }
          }
        }
      )
      .subscribe();
    meetingStatusChannelRef.current = channel;
  }

  async function requestMediaPermissions(shouldUseVideo: boolean) {
    const microphone = await Audio.requestPermissionsAsync();
    if (microphone.status !== 'granted') {
      throw new Error('Microphone access is required for meetings.');
    }
    if (shouldUseVideo) {
      const camera = await Camera.requestCameraPermissionsAsync();
      if (camera.status !== 'granted') {
        throw new Error('Camera access is required for video meetings.');
      }
    }
  }

  async function configureAudioRoute(speakerOn: boolean) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: !speakerOn && isAudioOnly,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: !speakerOn && isAudioOnly,
      staysActiveInBackground: false,
    });
  }

  async function ensureRouteRecorderPrepared() {
    if (routeRecorderRef.current) return routeRecorderRef.current;

    const recorder = new Audio.Recording();
    await recorder.prepareToRecordAsync(CALL_ROUTE_RECORDER_OPTIONS as any);
    routeRecorderRef.current = recorder;
    return recorder;
  }

  function findBluetoothInput(inputs: AudioInputDescriptor[]) {
    return inputs.find(isBluetoothAudioInput) ?? null;
  }

  function findWiredInput(inputs: AudioInputDescriptor[]) {
    return inputs.find(isWiredAudioInput) ?? null;
  }

  function findBuiltInInput(inputs: AudioInputDescriptor[]) {
    return inputs.find(isBuiltInAudioInput) ?? null;
  }

  async function refreshAvailableAudioRoutes() {
    if (!isAudioOnly) return;

    const recorder = await ensureRouteRecorderPrepared();
    const availableInputs = ((await recorder.getAvailableInputs()) || []) as AudioInputDescriptor[];
    const bluetoothInput = findBluetoothInput(availableInputs);
    const wiredInput = findWiredInput(availableInputs);
    const builtInInput = findBuiltInInput(availableInputs);

    setHasBluetoothAudio(!!bluetoothInput);
    setHasWiredAudio(!!wiredInput);

    if (isSpeakerOn) {
      try {
        setCurrentAudioInput((await recorder.getCurrentInput()) as AudioInputDescriptor);
      } catch {
        setCurrentAudioInput(null);
      }
      return;
    }

    let targetInput: AudioInputDescriptor | null = null;
    if (privateRoutePreference === 'bluetooth' && bluetoothInput) {
      targetInput = bluetoothInput;
    } else if (privateRoutePreference === 'phone') {
      targetInput = builtInInput ?? wiredInput ?? bluetoothInput ?? null;
    } else {
      targetInput = bluetoothInput ?? wiredInput ?? builtInInput ?? null;
    }

    if (targetInput) {
      try {
        await recorder.setInput(targetInput.uid);
      } catch (error) {
        console.error('[MeetingRoom] setInput failed', error);
      }
    }

    try {
      setCurrentAudioInput((await recorder.getCurrentInput()) as AudioInputDescriptor);
    } catch {
      setCurrentAudioInput(targetInput);
    }
  }

  async function selectSpeakerRoute() {
    await configureAudioRoute(true);
    setIsSpeakerOn(true);
    setPrivateRoutePreference('auto');
  }

  async function selectPrivateAudioRoute(preference: AudioRoutePreference) {
    await configureAudioRoute(false);
    setIsSpeakerOn(false);
    setPrivateRoutePreference(preference);
    await refreshAvailableAudioRoutes();
  }

  function buildLocalParticipant(currentProfile: MobileProfile): Participant {
    return { id: currentProfile.id, name: currentProfile.full_name, avatar: currentProfile.avatar_url, isLocal: true };
  }

  function applyLocalStream(stream: MediaStream | null) {
    localStreamRef.current = stream;
    setLocalBundle(stream ? { stream, url: stream.toURL() } : null);
  }

  async function prepareLocalMedia(shouldUseVideo: boolean) {
    await requestMediaPermissions(shouldUseVideo);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      applyLocalStream(null);
    }

    const stream = await mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any,
      video: shouldUseVideo ? { width: 720, height: 1280, frameRate: 24, facingMode: isFrontCamera ? 'user' : 'environment' } : false,
    });
    applyLocalStream(stream);
    setIsVideoEnabled(stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled);
    setIsMuted(false);
  }

  async function cleanupRoom(stopLocalTracks: boolean) {
    if (meetingStatusChannelRef.current) {
      await supabase.removeChannel(meetingStatusChannelRef.current);
      meetingStatusChannelRef.current = null;
    }
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    Object.values(peerConnectionsRef.current).forEach((connection) => connection.close());
    peerConnectionsRef.current = {};
    pendingCandidatesRef.current = {};
    remoteStreamsRef.current = {};
    setRemoteStreams({});
    setRemoteMutedStates({});
    setRemoteVideoStates({});
    setRemoteHandStates({});
    setSharedParticipantId(null);
    setIsScreenSharing(false);
    setScreenShareBundle(null);

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;
    }

    if (routeRecorderRef.current) {
      try {
        await routeRecorderRef.current.stopAndUnloadAsync();
      } catch {
        // The helper recorder may never have started. We only need to release it.
      } finally {
        routeRecorderRef.current = null;
      }
    }

    setCurrentAudioInput(null);
    setHasBluetoothAudio(false);
    setHasWiredAudio(false);
    setPrivateRoutePreference('auto');

    if (stopLocalTracks && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      applyLocalStream(null);
    }
  }

  function cleanupRemoteParticipant(targetId: string) {
    const connection = peerConnectionsRef.current[targetId];
    if (connection) {
      connection.close();
      delete peerConnectionsRef.current[targetId];
    }
    delete pendingCandidatesRef.current[targetId];

    const nextStreams = { ...remoteStreamsRef.current };
    delete nextStreams[targetId];
    remoteStreamsRef.current = nextStreams;
    setRemoteStreams(nextStreams);

    setRemoteMutedStates((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setRemoteVideoStates((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setRemoteHandStates((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });

    setSharedParticipantId((prev) => (prev === targetId ? null : prev));
  }

  function sendSignal(to: string | 'all', type: string, data: any) {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { from: profile?.id, to, type, data } });
  }

  function broadcastParticipantState() {
    sendSignal('all', 'participant_state', {
      isMuted,
      isVideoEnabled,
    });
  }

  async function resetMeetingChannel() {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelTopic = `meeting:${id}`;
    const existingChannels = typeof (supabase as any).getChannels === 'function'
      ? (supabase as any).getChannels()
      : [];

    for (const existingChannel of existingChannels) {
      const topic = String(existingChannel?.topic || '');
      if (topic.endsWith(channelTopic)) {
        await supabase.removeChannel(existingChannel);
      }
    }
  }

  async function replaceOutgoingVideoTrack(nextTrack: any, nextStream?: MediaStream | null) {
    await Promise.all(
      Object.values(peerConnectionsRef.current).map(async (connection: any) => {
        const sender = connection.getSenders?.().find((item: any) => item.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(nextTrack || null);
          return;
        }

        if (nextTrack && nextStream) {
          connection.addTrack(nextTrack, nextStream);
        }
      })
    );
  }

  async function replaceOutgoingAudioTrack(nextTrack: any, nextStream?: MediaStream | null) {
    await Promise.all(
      Object.values(peerConnectionsRef.current).map(async (connection: any) => {
        const sender = connection.getSenders?.().find((item: any) => item.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(nextTrack || null);
          return;
        }

        if (nextTrack && nextStream) {
          connection.addTrack(nextTrack, nextStream);
        }
      })
    );
  }

  async function ensureVideoEnabledLocally() {
    if (isAudioOnly) return null;

    const existingTrack = localStreamRef.current?.getVideoTracks?.()[0];
    if (existingTrack) {
      existingTrack.enabled = true;
      setIsVideoEnabled(true);
      return existingTrack;
    }

    await requestMediaPermissions(true);

    const cameraStream = await mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: 720,
        height: 1280,
        frameRate: 24,
        facingMode: isFrontCamera ? 'user' : 'environment',
      },
    });

    const videoTrack = cameraStream.getVideoTracks?.()[0];
    if (!videoTrack) throw new Error('Could not create a camera track.');

    const currentAudioTracks = localStreamRef.current?.getAudioTracks?.() || [];
    const mergedStream = new MediaStream([...currentAudioTracks, videoTrack]);
    applyLocalStream(mergedStream);
    await replaceOutgoingVideoTrack(videoTrack, mergedStream);
    setIsVideoEnabled(true);
    return videoTrack;
  }

  async function switchCallToVideo() {
    if (!meeting?.id) return;

    try {
      await supabase.from('meetings').update({ is_audio_only: false }).eq('id', meeting.id);
      setMeeting((prev) => (prev ? { ...prev, is_audio_only: false } : prev));
      setIsAudioOnly(false);
      setIsSpeakerOn(true);
      setPrivateRoutePreference('auto');
      setCurrentAudioInput(null);
      setConnectionState('Video call');

      await ensureVideoEnabledLocally();

      sendSignal('all', 'meeting_type_changed', { isAudioOnly: false });
      sendSignal('all', 'participant_state', {
        isMuted,
        isVideoEnabled: true,
      });
    } catch (error: any) {
      Alert.alert('Could not switch to video', error?.message || 'Please try again.');
    }
  }

  function toggleHand() {
    const nextRaised = !isHandRaised;
    setIsHandRaised(nextRaised);
    sendSignal('all', 'hand_state', { raised: nextRaised });
  }

  async function stopScreenShare() {
    if (!screenShareStreamRef.current) return;

    try {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;
      setScreenShareBundle(null);
      setIsScreenSharing(false);
      setSharedParticipantId(null);

      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      await replaceOutgoingVideoTrack(cameraTrack, localStreamRef.current);

      sendSignal('all', 'sharing_state', { active: false });
    } catch (error) {
      console.error('[MeetingRoom] stopScreenShare failed', error);
    }
  }

  async function toggleScreenShare() {
    if (isAudioOnly) return;

    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    try {
      const displayStream = await (mediaDevices as any).getDisplayMedia();
      const displayTrack = displayStream?.getVideoTracks?.()[0];

      if (!displayTrack) {
        throw new Error('No screen track was returned.');
      }

      displayTrack.onended = () => {
        stopScreenShare().catch((error) => console.error('[MeetingRoom] stopScreenShare failed', error));
      };

      screenShareStreamRef.current = displayStream;
      setScreenShareBundle({ stream: displayStream, url: displayStream.toURL() });
      setIsScreenSharing(true);
      setSharedParticipantId(profile?.id || null);

      await replaceOutgoingVideoTrack(displayTrack, displayStream);
      sendSignal('all', 'sharing_state', { active: true });
    } catch (error: any) {
      Alert.alert('Screen share unavailable', error?.message || 'Could not start screen sharing.');
    }
  }

  async function handleSendChatMessage() {
    if (!chatInput.trim()) return;

    const sent = await sendMessage(chatInput);
    if (sent) setChatInput('');
    else Alert.alert('Message failed', 'We could not send your meeting message.');
  }

  async function openInviteModal() {
    if (!profile || !meeting) return;

    setShowOptionsModal(false);
    setInviteLoading(true);
    setInviteSearch('');

    try {
      const nextInvitees = await listInvitableMeetingProfiles(profile, meeting.conversation_id);
      setInvitees(nextInvitees);
      setShowInviteModal(true);
    } catch (error: any) {
      Alert.alert('Could not load invite list', error?.message || 'Please try again.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleAddParticipant(targetProfile: MobileProfile) {
    if (!meeting || invitingProfileId) return;

    setInvitingProfileId(targetProfile.id);

    try {
      await inviteProfileToMeeting({
        meeting,
        targetProfileId: targetProfile.id,
        isAudioOnly,
      });

      setInvitees((prev) => prev.filter((item) => item.id !== targetProfile.id));
      Alert.alert('Invitation sent', `${targetProfile.full_name} can now join this meeting.`);
    } catch (error: any) {
      Alert.alert('Invite failed', error?.message || 'We could not add this participant.');
    } finally {
      setInvitingProfileId(null);
    }
  }

  function ensurePeerConnection(targetId: string, createOffer = false) {
    const existing = peerConnectionsRef.current[targetId];
    if (existing) return existing;

    const connection = new RTCPeerConnection(ICE_SERVERS as any) as any;
    peerConnectionsRef.current[targetId] = connection;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        connection.addTrack(track, localStreamRef.current as MediaStream);
      });
    }

    connection.onicecandidate = (event) => {
      if (event.candidate) sendSignal(targetId, 'candidate', event.candidate);
    };

    connection.ontrack = (event) => {
      let bundle = remoteStreamsRef.current[targetId];

      if (!bundle) {
        const incomingStream = event.streams[0] || new MediaStream();
        bundle = { stream: incomingStream, url: incomingStream.toURL() };
      }

      if (!bundle.stream.getTracks().includes(event.track)) {
        bundle.stream.addTrack(event.track);
      }

      const nextStreams = {
        ...remoteStreamsRef.current,
        [targetId]: bundle,
      };

      remoteStreamsRef.current = nextStreams;
      setRemoteStreams(nextStreams);
    };

    connection.onconnectionstatechange = () => {
      if (
        connection.connectionState === 'failed' ||
        connection.connectionState === 'closed' ||
        connection.connectionState === 'disconnected'
      ) {
        cleanupRemoteParticipant(targetId);
      }
    };

    if (createOffer) {
      connection.createOffer().then(async (offer) => {
        await connection.setLocalDescription(offer);
        sendSignal(targetId, 'offer', offer);
      }).catch((error) => console.error('[MeetingRoom] createOffer failed', error));
    }

    return connection;
  }

  async function handleOffer(from: string, offer: any) {
    try {
      if (peerConnectionsRef.current[from] && peerConnectionsRef.current[from].signalingState !== 'stable') {
        cleanupRemoteParticipant(from);
      }
      const connection = ensurePeerConnection(from);
      await connection.setRemoteDescription(new RTCSessionDescription(offer));
      if (pendingCandidatesRef.current[from]) {
        for (const candidate of pendingCandidatesRef.current[from]) {
          await connection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        delete pendingCandidatesRef.current[from];
      }
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendSignal(from, 'answer', answer);
    } catch (error) {
      console.error('[MeetingRoom] handleOffer failed', error);
    }
  }

  async function handleAnswer(from: string, answer: any) {
    try {
      const connection = peerConnectionsRef.current[from];
      if (!connection) return;
      await connection.setRemoteDescription(new RTCSessionDescription(answer));
      if (pendingCandidatesRef.current[from]) {
        for (const candidate of pendingCandidatesRef.current[from]) {
          await connection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        delete pendingCandidatesRef.current[from];
      }
    } catch (error) {
      console.error('[MeetingRoom] handleAnswer failed', error);
    }
  }

  async function handleCandidate(from: string, candidate: any) {
    const connection = peerConnectionsRef.current[from];
    if (connection && connection.remoteDescription) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[MeetingRoom] addIceCandidate failed', error);
      }
      return;
    }
    if (!pendingCandidatesRef.current[from]) pendingCandidatesRef.current[from] = [];
    pendingCandidatesRef.current[from].push(candidate);
  }

  function updateParticipantsFromPresence(ids: string[], state: any) {
    if (!profile) return;

    const nextParticipants = ids
      .map((participantId) => {
        const entry = state[participantId]?.[0];
        if (!entry) return null;
        return {
          id: participantId,
          name: entry.name || 'Participant',
          avatar: entry.avatar || null,
          isLocal: participantId === profile.id,
        } satisfies Participant;
      })
      .filter(Boolean) as Participant[];

    const activeIds = new Set(ids);
    Object.keys(peerConnectionsRef.current).forEach((participantId) => {
      if (!activeIds.has(participantId)) cleanupRemoteParticipant(participantId);
    });

    if (!nextParticipants.some((item) => item.id === profile.id)) {
      nextParticipants.unshift(buildLocalParticipant(profile));
    }

    setParticipants(nextParticipants);

    [...ids].sort().forEach((participantId, index) => {
      if (participantId === profile.id) return;
      if (participantId < profile.id && !peerConnectionsRef.current[participantId]) {
        setTimeout(() => {
          if (!peerConnectionsRef.current[participantId]) ensurePeerConnection(participantId, true);
        }, index * 160);
      }
    });

    if (joined) {
      broadcastParticipantState();
    }
  }

  async function joinMeetingRoom() {
    if (!profile || !meeting || !id || joining || joined) return;
    setJoining(true);
    setConnectionState('Connecting...');

    try {
      if (!localStreamRef.current) await prepareLocalMedia(!isAudioOnly);
      await resetMeetingChannel();

      const channel = supabase.channel(`meeting:${id}`, {
        config: { presence: { key: profile.id } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          updateParticipantsFromPresence(Object.keys(state), state);
        })
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          const { from, to, type, data } = payload;
          if (to !== profile.id && to !== 'all') return;
          if (!from || from === profile.id) return;
          if (type === 'offer') handleOffer(from, data);
          else if (type === 'answer') handleAnswer(from, data);
          else if (type === 'candidate') handleCandidate(from, data);
          else if (type === 'participant_state') {
            setRemoteMutedStates((prev) => ({ ...prev, [from]: !!data?.isMuted }));
            setRemoteVideoStates((prev) => ({
              ...prev,
              [from]: data?.isVideoEnabled !== false,
            }));
          } else if (type === 'hand_state') {
            setRemoteHandStates((prev) => ({ ...prev, [from]: !!data?.raised }));
          } else if (type === 'sharing_state') {
            setSharedParticipantId(data?.active ? from : null);
          } else if (type === 'meeting_type_changed') {
            const nextAudioOnly = !!data?.isAudioOnly;
            setIsAudioOnly(nextAudioOnly);
            if (!nextAudioOnly) {
              setIsSpeakerOn(true);
              setConnectionState('Video available');
            }
          } else if (type === 'meeting_ended') {
            Alert.alert('Meeting ended', 'The host ended this meeting for everyone.');
            leaveMeeting(false, true);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: profile.id,
              name: profile.full_name,
              avatar: profile.avatar_url || null,
              online_at: new Date().toISOString(),
            });
            channelRef.current = channel;
            setJoined(true);
            setConnectionState('Live');
            broadcastParticipantState();
          }
        });
    } catch (error: any) {
      Alert.alert('Could not join meeting', error?.message || 'Please try again.');
      setConnectionState('Join failed');
    } finally {
      setJoining(false);
    }
  }

  function toggleMute() {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    const nextMuted = !isMuted;
    audioTrack.enabled = !nextMuted;
    setIsMuted(nextMuted);
    setTimeout(() => {
      sendSignal('all', 'participant_state', {
        isMuted: nextMuted,
        isVideoEnabled,
      });
    }, 0);
  }

  function toggleVideo() {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) {
      ensureVideoEnabledLocally()
        .then(() => {
          setTimeout(() => {
            sendSignal('all', 'participant_state', {
              isMuted,
              isVideoEnabled: true,
            });
          }, 0);
        })
        .catch((error: any) => {
          Alert.alert('Video unavailable', error?.message || 'Could not enable camera right now.');
        });
      return;
    }
    const nextEnabled = !isVideoEnabled;
    videoTrack.enabled = nextEnabled;
    setIsVideoEnabled(nextEnabled);
    setTimeout(() => {
      sendSignal('all', 'participant_state', {
        isMuted,
        isVideoEnabled: nextEnabled,
      });
    }, 0);
  }

  function switchCamera() {
    const videoTrack: any = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack || typeof videoTrack._switchCamera !== 'function') {
      Alert.alert('Switch unavailable', 'Camera switching is not available right now.');
      return;
    }
    videoTrack._switchCamera();
    setIsFrontCamera((prev) => !prev);
  }

  function confirmLeaveMeeting() {
    Alert.alert(
      'Leave meeting',
      canEndForAll ? 'You can leave for yourself or end the meeting for everyone.' : 'Do you want to leave this meeting?',
      canEndForAll
        ? [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', onPress: () => leaveMeeting(false) },
            { text: 'End for all', style: 'destructive', onPress: () => leaveMeeting(true) },
          ]
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => leaveMeeting(false) },
          ]
    );
  }

  async function leaveMeeting(endForAll: boolean, silent = false) {
    try {
      if (endForAll && canEndForAll && meeting?.id) {
        sendSignal('all', 'meeting_ended', {});
        await endMeetingForAll(meeting.id);
      }
      await cleanupRoom(true);
      setJoined(false);
      setConnectionState('Ended');
      if (!silent) {
        Alert.alert('Meeting closed', endForAll ? 'The meeting ended for everyone.' : 'You left the meeting.');
      }
    } finally {
      router.replace('/(tabs)/meetings');
    }
  }

  const featuredBundle = featuredParticipant?.isLocal
    ? isScreenSharing && screenShareBundle
      ? screenShareBundle
      : localBundle
    : featuredParticipant
      ? remoteStreams[featuredParticipant.id]
      : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingTitle}>Preparing meeting</Text>
        <Text style={styles.loadingText}>Loading your rebuilt mobile meeting room...</Text>
      </View>
    );
  }

  const featuredVideoEnabled = featuredParticipant?.isLocal
    ? isScreenSharing || isVideoEnabled
    : featuredParticipant
      ? remoteVideoStates[featuredParticipant.id] ??
        ((remoteStreams[featuredParticipant.id]?.stream.getVideoTracks().length || 0) > 0)
      : false;

  const audioRouteLabel = isSpeakerOn
    ? 'Speaker'
    : isBluetoothAudioInput(currentAudioInput)
      ? 'Bluetooth'
      : hasWiredAudio
        ? 'Headset'
        : 'Phone';
  const voiceFeaturedParticipant =
    participants.find((item) => !item.isLocal) || participants[0] || null;

  if (!meeting || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingTitle}>Meeting unavailable</Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/meetings')}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Back to meetings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!joined && isAudioOnly) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingTitle}>Joining voice call</Text>
        <Text style={styles.loadingText}>Connecting your private audio route and call session...</Text>
      </View>
    );
  }

  if (joined && isAudioOnly) {
    return (
      <SafeAreaView style={styles.voiceContainer}>
        <View style={styles.voiceTopBar}>
          <View>
            <Text style={styles.roomTitle}>{meetingTitle}</Text>
            <View style={styles.roomStatusRow}>
              <Text style={styles.roomTimer}>{formatDuration(elapsedSeconds)}</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{audioRouteLabel}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.topIconButton}>
            <MoreVertical color="#fff" size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.voiceHero}>
          <View style={styles.voiceAvatar}>
            <Text style={styles.voiceAvatarText}>
              {(voiceFeaturedParticipant?.name || profile.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.voiceName}>
            {voiceFeaturedParticipant?.name || profile.full_name}
            {voiceFeaturedParticipant?.isLocal ? ' (You)' : ''}
          </Text>
          <Text style={styles.voiceMeta}>
            {isMuted ? 'Muted' : 'Mic on'} {'\u2022'} {audioRouteLabel}
          </Text>
          <Text style={styles.voiceHint}>
            Use the three-dot menu to switch between speaker, phone, and Bluetooth during the call.
          </Text>
        </View>

        <View style={styles.voiceControlsBar}>
          <ControlButton
            onPress={toggleMute}
            icon={isMuted ? <MicOff color="#fff" size={20} /> : <Mic color="#fff" size={20} />}
            label={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
          />
          <ControlButton
            onPress={switchCallToVideo}
            icon={<Video color="#fff" size={20} />}
            label="Video"
          />
          <ControlButton
            onPress={() => setShowParticipantsModal(true)}
            icon={<Users color="#fff" size={20} />}
            label="People"
          />
          <ControlButton
            onPress={confirmLeaveMeeting}
            icon={<PhoneOff color="#fff" size={20} />}
            label={canEndForAll ? 'Leave / End' : 'Leave'}
            danger
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!joined && !isAudioOnly) {
    return (
      <SafeAreaView style={styles.lobbyContainer}>
        <View style={styles.lobbyHeader}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/meetings')} style={styles.topIconButton}>
            <ChevronLeft color="#fff" size={20} />
          </TouchableOpacity>

          <View style={styles.lobbyHeaderCopy}>
            <Text style={styles.lobbyTitle}>{meetingTitle}</Text>
            <Text style={styles.lobbySubtitle}>{connectionState}</Text>
          </View>
        </View>

        <View style={styles.previewWrap}>
          <MeetingTile
            title={profile.full_name}
            streamUrl={localBundle?.url}
            showVideo={isVideoEnabled}
            muted={isMuted}
            isLocal
            isPresenting={isScreenSharing}
            isHandRaised={isHandRaised}
            large
          />
        </View>

        <View style={styles.lobbyMetaCard}>
          <Text style={styles.lobbyMetaTitle}>Ready to join?</Text>
          <Text style={styles.lobbyMetaText}>
            Preview your camera before entering. You can keep the mic or camera off and still join.
          </Text>

          <View style={styles.lobbyControlRow}>
            <ControlButton
              onPress={toggleMute}
              icon={isMuted ? <MicOff color="#fff" size={20} /> : <Mic color="#fff" size={20} />}
              label={isMuted ? 'Unmute' : 'Mute'}
              active={isMuted}
            />
            <ControlButton
              onPress={toggleVideo}
              icon={isVideoEnabled ? <Video color="#fff" size={20} /> : <VideoOff color="#fff" size={20} />}
              label={isVideoEnabled ? 'Camera' : 'Camera off'}
              active={!isVideoEnabled}
            />
            <ControlButton
              onPress={switchCamera}
              icon={<RotateCcw color="#fff" size={20} />}
              label="Flip"
            />
          </View>
        </View>

        <View style={styles.lobbyBottomBar}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/meetings')} style={styles.secondaryAction}>
            <Text style={styles.secondaryActionText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={joinMeetingRoom}
            style={[styles.primaryAction, joining && styles.primaryActionDisabled]}
            disabled={joining}
          >
            {joining ? <ActivityIndicator color="#fff" size="small" /> : null}
            <Text style={styles.primaryActionText}>{joining ? 'Joining...' : 'Join now'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.roomContainer}>
      <View style={styles.roomTopBar}>
        <View>
          <Text style={styles.roomTitle}>{meetingTitle}</Text>
          <View style={styles.roomStatusRow}>
            <Text style={styles.roomTimer}>{formatDuration(elapsedSeconds)}</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{connectionState}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.topIconButton}>
          <MoreVertical color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.featuredWrap}>
        <MeetingTile
          title={featuredParticipant?.name || profile.full_name}
          streamUrl={featuredBundle?.url}
          showVideo={featuredVideoEnabled}
          muted={
            featuredParticipant?.isLocal
              ? isMuted
              : featuredParticipant
                ? remoteMutedStates[featuredParticipant.id]
                : false
          }
          isLocal={featuredParticipant?.isLocal ?? true}
          isPresenting={featuredParticipant?.id === sharedParticipantId}
          isHandRaised={
            featuredParticipant?.isLocal
              ? isHandRaised
              : featuredParticipant
                ? remoteHandStates[featuredParticipant.id]
                : false
          }
          large
        />
      </View>

      <View style={styles.stripHeader}>
        <Text style={styles.stripTitle}>Participants</Text>
        <TouchableOpacity onPress={() => setShowParticipantsModal(true)}>
          <Text style={styles.stripAction}>View all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailStrip}>
        {thumbnailParticipants.length > 0 ? (
          thumbnailParticipants.map((participant) => {
            const bundle = participant.isLocal ? localBundle : remoteStreams[participant.id];
            const showVideo = participant.isLocal
              ? isVideoEnabled
              : remoteVideoStates[participant.id] ??
                ((remoteStreams[participant.id]?.stream.getVideoTracks().length || 0) > 0);

            return (
              <TouchableOpacity
                key={participant.id}
                activeOpacity={0.9}
                onPress={() =>
                  setParticipants((prev) => {
                    const featured = prev.find((item) => item.id === participant.id);
                    const rest = prev.filter((item) => item.id !== participant.id);
                    return featured ? [featured, ...rest] : prev;
                  })
                }
              >
                <MeetingTile
                  title={participant.name}
                  streamUrl={bundle?.url}
                  showVideo={showVideo}
                  muted={participant.isLocal ? isMuted : remoteMutedStates[participant.id]}
                  isLocal={participant.isLocal}
                  isPresenting={participant.id === sharedParticipantId}
                  isHandRaised={participant.isLocal ? isHandRaised : remoteHandStates[participant.id]}
                />
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.waitingTile}>
            <Users color={Colors.slate500} size={18} />
            <Text style={styles.waitingTileText}>Waiting for others to join</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.controlsBar}>
        <ControlButton
          onPress={toggleMute}
          icon={isMuted ? <MicOff color="#fff" size={20} /> : <Mic color="#fff" size={20} />}
          label={isMuted ? 'Unmute' : 'Mute'}
          active={isMuted}
        />

        {!isAudioOnly ? (
          <>
            <ControlButton
              onPress={toggleVideo}
              icon={isVideoEnabled ? <Video color="#fff" size={20} /> : <VideoOff color="#fff" size={20} />}
              label={isVideoEnabled ? 'Camera' : 'Video off'}
              active={!isVideoEnabled}
            />
            <ControlButton onPress={switchCamera} icon={<RotateCcw color="#fff" size={20} />} label="Flip" />
            <ControlButton
              onPress={() => setShowChatModal(true)}
              icon={<MessageSquare color="#fff" size={20} />}
              label="Chat"
            />
            <ControlButton
              onPress={toggleHand}
              icon={<Hand color="#fff" size={20} />}
              label={isHandRaised ? 'Lower hand' : 'Raise hand'}
              active={isHandRaised}
            />
            <ControlButton
              onPress={toggleScreenShare}
              icon={<MonitorUp color="#fff" size={20} />}
              label={isScreenSharing ? 'Stop share' : 'Present'}
              active={isScreenSharing}
            />
          </>
        ) : null}

        <ControlButton
          onPress={() => setShowParticipantsModal(true)}
          icon={<Users color="#fff" size={20} />}
          label="People"
        />
        <ControlButton
          onPress={confirmLeaveMeeting}
          icon={<PhoneOff color="#fff" size={20} />}
          label={canEndForAll ? 'Leave / End' : 'Leave'}
          danger
        />
      </View>
      
      <Modal
        animationType="slide"
        transparent
        visible={showParticipantsModal}
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>People</Text>
                <Text style={styles.modalSubtitle}>{participants.length} in this meeting</Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={openInviteModal} style={styles.topIconButton}>
                  <UserPlus color="#fff" size={18} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowParticipantsModal(false)} style={styles.topIconButton}>
                  <X color="#fff" size={18} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.participantList}>
              {participants.map((participant) => {
                const participantMuted = participant.isLocal
                  ? isMuted
                  : remoteMutedStates[participant.id];
                const participantVideo = participant.isLocal
                  ? isVideoEnabled
                  : remoteVideoStates[participant.id] ??
                    ((remoteStreams[participant.id]?.stream.getVideoTracks().length || 0) > 0);
                const participantHandRaised = participant.isLocal
                  ? isHandRaised
                  : remoteHandStates[participant.id];
                const participantPresenting = participant.id === sharedParticipantId;

                return (
                  <View key={participant.id} style={styles.participantRow}>
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantAvatarText}>
                        {(participant.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.participantMeta}>
                      <Text style={styles.participantName}>
                        {participant.name}
                        {participant.isLocal ? ' (You)' : ''}
                      </Text>
                      <Text style={styles.participantStatus}>
                        {participantMuted ? 'Mic off' : 'Mic on'} {'\u2022'} {participantVideo ? 'Camera on' : 'Camera off'}
                        {participantHandRaised ? ' \u2022 Hand raised' : ''}
                        {participantPresenting ? ' \u2022 Presenting' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={showChatModal}
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.chatSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>In-meeting chat</Text>
                <Text style={styles.modalSubtitle}>
                  Messages shared here stay attached to this meeting.
                </Text>
              </View>

              <TouchableOpacity onPress={() => setShowChatModal(false)} style={styles.topIconButton}>
                <X color="#fff" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.chatList}>
              {isChatLoading ? (
                <Text style={styles.chatEmptyText}>Loading messages...</Text>
              ) : messages.length === 0 ? (
                <Text style={styles.chatEmptyText}>No messages yet. Start the discussion here.</Text>
              ) : (
                messages.map((message) => {
                  const isOwn = message.sender_id === profile.id;

                  return (
                    <View
                      key={message.id}
                      style={[styles.chatBubble, isOwn ? styles.chatBubbleOwn : styles.chatBubbleRemote]}
                    >
                      <Text style={styles.chatSenderText}>
                        {isOwn ? 'You' : message.sender?.full_name || 'Participant'}
                      </Text>
                      <Text style={styles.chatMessageText}>{message.content}</Text>
                      <Text style={styles.chatTimeText}>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {message.status === 'sending' ? ' • sending' : ''}
                        {message.status === 'error' ? ' • failed' : ''}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.chatComposer}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Message everyone in the meeting"
                placeholderTextColor={Colors.slate500}
                style={styles.chatInput}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendChatMessage}
                style={[styles.chatSendButton, isChatSending && styles.primaryActionDisabled]}
                disabled={isChatSending}
              >
                <Text style={styles.chatSendButtonText}>{isChatSending ? '...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={showInviteModal}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add people</Text>
                <Text style={styles.modalSubtitle}>
                  Invite teammates or clients who are allowed in this meeting.
                </Text>
              </View>

              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.topIconButton}>
                <X color="#fff" size={18} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Search color={Colors.slate500} size={16} />
              <TextInput
                value={inviteSearch}
                onChangeText={setInviteSearch}
                placeholder="Search people"
                placeholderTextColor={Colors.slate500}
                style={styles.searchInput}
              />
            </View>

            <ScrollView contentContainerStyle={styles.inviteList}>
              {inviteLoading ? (
                <Text style={styles.chatEmptyText}>Loading people...</Text>
              ) : filteredInvitees.length === 0 ? (
                <Text style={styles.chatEmptyText}>No one else is available to invite right now.</Text>
              ) : (
                filteredInvitees.map((invitee) => (
                  <View key={invitee.id} style={styles.inviteRow}>
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantAvatarText}>
                        {(invitee.full_name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.participantMeta}>
                      <Text style={styles.participantName}>{invitee.full_name}</Text>
                      <Text style={styles.participantStatus}>{invitee.role}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleAddParticipant(invitee)}
                      style={[
                        styles.inviteButton,
                        invitingProfileId === invitee.id && styles.primaryActionDisabled,
                      ]}
                      disabled={!!invitingProfileId}
                    >
                      <Text style={styles.inviteButtonText}>
                        {invitingProfileId === invitee.id ? 'Adding...' : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={showOptionsModal}
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.optionsSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Meeting options</Text>
                <Text style={styles.modalSubtitle}>Host controls and session actions</Text>
              </View>

              <TouchableOpacity onPress={() => setShowOptionsModal(false)} style={styles.topIconButton}>
                <X color="#fff" size={18} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setShowOptionsModal(false);
                setShowParticipantsModal(true);
              }}
            >
              <Users color="#fff" size={18} />
              <Text style={styles.optionText}>View participants</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={openInviteModal}
            >
              <UserPlus color="#fff" size={18} />
              <Text style={styles.optionText}>Add people</Text>
            </TouchableOpacity>

            {isAudioOnly ? (
              <>
                <TouchableOpacity
                  style={[styles.optionRow, isSpeakerOn && styles.optionRowActive]}
                  onPress={() => {
                    setShowOptionsModal(false);
                    selectSpeakerRoute().catch((error: any) => {
                      Alert.alert('Audio route failed', error?.message || 'Could not switch to speaker.');
                    });
                  }}
                >
                  <Volume2 color="#fff" size={18} />
                  <Text style={styles.optionText}>Use speaker</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionRow,
                    !isSpeakerOn && !isBluetoothAudioInput(currentAudioInput) && styles.optionRowActive,
                  ]}
                  onPress={() => {
                    setShowOptionsModal(false);
                    selectPrivateAudioRoute('phone').catch((error: any) => {
                      Alert.alert('Audio route failed', error?.message || 'Could not switch to the phone route.');
                    });
                  }}
                >
                  <Mic color="#fff" size={18} />
                  <Text style={styles.optionText}>Use phone</Text>
                </TouchableOpacity>

                {hasBluetoothAudio ? (
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      !isSpeakerOn && isBluetoothAudioInput(currentAudioInput) && styles.optionRowActive,
                    ]}
                    onPress={() => {
                      setShowOptionsModal(false);
                      selectPrivateAudioRoute('bluetooth').catch((error: any) => {
                        Alert.alert('Bluetooth unavailable', error?.message || 'Could not switch to Bluetooth.');
                      });
                    }}
                  >
                    <Volume2 color="#fff" size={18} />
                    <Text style={styles.optionText}>Use Bluetooth</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    setShowOptionsModal(false);
                    switchCallToVideo();
                  }}
                >
                  <Video color="#fff" size={18} />
                  <Text style={styles.optionText}>Switch to video</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setShowOptionsModal(false);
                leaveMeeting(false);
              }}
            >
              <PhoneOff color="#fff" size={18} />
              <Text style={styles.optionText}>Leave meeting</Text>
            </TouchableOpacity>

            {canEndForAll ? (
              <TouchableOpacity
                style={[styles.optionRow, styles.optionRowDanger]}
                onPress={() => {
                  setShowOptionsModal(false);
                  leaveMeeting(true);
                }}
              >
                <X color="#fff" size={18} />
                <Text style={styles.optionText}>End for everyone</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingTitle: {
    marginTop: 18,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 24,
    color: '#fff',
  },
  loadingText: {
    marginTop: 8,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    color: Colors.slate500,
    textAlign: 'center',
    lineHeight: 18,
  },
  lobbyContainer: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  lobbyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  lobbyHeaderCopy: {
    marginLeft: 14,
    flex: 1,
  },
  lobbyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 24,
    color: '#fff',
  },
  lobbySubtitle: {
    marginTop: 4,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  previewWrap: {
    flex: 1,
    marginBottom: 18,
  },
  lobbyMetaCard: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  lobbyMetaTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
  },
  lobbyMetaText: {
    marginTop: 6,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    lineHeight: 17,
    color: Colors.slate500,
  },
  lobbyControlRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lobbyBottomBar: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionDisabled: {
    opacity: 0.7,
  },
  primaryActionText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 14,
    color: '#fff',
  },
  secondaryAction: {
    width: 120,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#fff',
  },
  roomContainer: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  voiceContainer: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  roomTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  voiceTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 32,
  },
  roomTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
  },
  roomStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  roomTimer: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: '#10b981',
  },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredWrap: {
    flex: 1,
  },
  voiceHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  voiceAvatar: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.32)',
  },
  voiceAvatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 72,
    color: '#60a5fa',
  },
  voiceName: {
    marginTop: 22,
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
    textAlign: 'center',
  },
  voiceMeta: {
    marginTop: 8,
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.accent,
    textAlign: 'center',
  },
  voiceHint: {
    marginTop: 12,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    lineHeight: 17,
    color: Colors.slate500,
    textAlign: 'center',
  },
  voiceControlsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
  },
  tileShell: {
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featuredTile: {
    flex: 1,
    borderRadius: 30,
  },
  thumbnailTile: {
    width: 124,
    height: 166,
    borderRadius: 24,
  },
  tileVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  tileFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  tileFallbackText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 36,
    color: '#60a5fa',
  },
  tileFallbackTextLarge: {
    fontSize: 78,
  },
  tileOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileName: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.42)',
    color: '#fff',
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 12,
  },
  tileMuteBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.82)',
  },
  tileHandBadge: {
    backgroundColor: 'rgba(59,130,246,0.86)',
  },
  tilePresentingBadge: {
    backgroundColor: 'rgba(16,185,129,0.88)',
  },
  stripHeader: {
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stripTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
  },
  stripAction: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.accent,
  },
  thumbnailStrip: {
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  waitingTile: {
    width: 180,
    height: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  waitingTileText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  controlWrap: {
    alignItems: 'center',
    width: 74,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.88)',
    borderColor: 'rgba(239,68,68,0.88)',
  },
  controlButtonDanger: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  controlLabel: {
    marginTop: 8,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '72%',
    backgroundColor: '#08111f',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  chatSheet: {
    maxHeight: '78%',
    minHeight: '62%',
    backgroundColor: '#08111f',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  optionsSheet: {
    backgroundColor: '#08111f',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
  },
  modalSubtitle: {
    marginTop: 4,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 13,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
  },
  participantList: {
    gap: 12,
    paddingBottom: 20,
  },
  inviteList: {
    gap: 12,
    paddingBottom: 20,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.18)',
    marginRight: 12,
  },
  participantAvatarText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#60a5fa',
  },
  participantMeta: {
    flex: 1,
  },
  participantName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 15,
    color: '#fff',
  },
  participantStatus: {
    marginTop: 4,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  inviteButton: {
    minWidth: 74,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
  },
  inviteButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    color: '#fff',
  },
  chatList: {
    gap: 10,
    paddingBottom: 16,
  },
  chatEmptyText: {
    paddingVertical: 24,
    textAlign: 'center',
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  chatBubble: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  chatBubbleOwn: {
    alignSelf: 'flex-end',
    minWidth: '55%',
    maxWidth: '88%',
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderColor: 'rgba(59,130,246,0.34)',
  },
  chatBubbleRemote: {
    alignSelf: 'flex-start',
    minWidth: '55%',
    maxWidth: '88%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chatSenderText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: Colors.accent,
    marginBottom: 6,
  },
  chatMessageText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 15,
    lineHeight: 21,
    color: '#fff',
  },
  chatTimeText: {
    marginTop: 8,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
  },
  chatComposer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
  },
  chatSendButton: {
    width: 72,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  chatSendButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#fff',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  optionRowActive: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderColor: 'rgba(96,165,250,0.34)',
  },
  optionRowDanger: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  optionText: {
    fontFamily: Fonts.Outfit_600SemiBold,
    fontSize: 15,
    color: '#fff',
  },
});
