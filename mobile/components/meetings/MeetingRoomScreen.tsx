import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
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
  Menu,
  MoreVertical,
  Presentation,
  Hand,
  UserPlus,
} from 'lucide-react-native';
import { Fonts, Colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

// ─── ICE Config ─────────────────────────────────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ─── Participant Tile (uses RTCView for live streams, fallback for no-video) ─
function ParticipantTile({
  name,
  avatarFirst,
  stream,
  isLocal,
  isMuted,
  isVideoOff,
  featured = false,
  tileHeight,
}: {
  name: string;
  avatarFirst: string;
  stream: MediaStream | null;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  featured?: boolean;
  tileHeight?: number;
}) {
  const showVideo = !!stream && !isVideoOff;

  return (
    <View
      style={[
        styles.tileShell,
        featured ? styles.featuredTile : styles.participantTile,
        tileHeight ? { height: tileHeight } : null,
      ]}
    >
      {showVideo && stream ? (
        <RTCView
          streamURL={(stream as any).toURL()}
          style={styles.tileRtcView}
          objectFit="cover"
          mirror={isLocal}
        />
      ) : (
        <LinearGradient colors={['#131929', '#1e2538']} style={[styles.tileRtcView, styles.initialTileSurface]}>
          <View style={styles.initialBadge}>
            <Text style={styles.initialBadgeText}>{avatarFirst}</Text>
          </View>
        </LinearGradient>
      )}

      {/* Gradient overlay */}
      {showVideo && (
        <LinearGradient
          colors={['rgba(9,14,27,0.02)', 'rgba(9,14,27,0.18)', 'rgba(9,14,27,0.72)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      {/* Name chip */}
      <View style={[styles.tileNameChip, featured ? styles.featuredNameChip : styles.smallNameChip]}>
        {isMuted ? (
          <MicOff color="#a6aabc" size={featured ? 14 : 12} />
        ) : (
          <Mic color="#85adff" size={featured ? 14 : 12} fill="#85adff" />
        )}
        <Text
          style={[styles.tileName, featured ? styles.featuredTileName : styles.smallTileName]}
          numberOfLines={1}
        >
          {name}
          {isLocal ? ' (You)' : ''}
        </Text>
      </View>

      {isLocal && (
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>You</Text>
        </View>
      )}
    </View>
  );
}

// ─── Control Button ──────────────────────────────────────────────────────────
function ControlButton({
  icon,
  active,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  if (danger) {
    return (
      <TouchableOpacity activeOpacity={0.9} style={styles.endCallButton} onPress={onPress}>
        {icon}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.controlButton, active && styles.controlButtonActive]}
      onPress={onPress}
    >
      {icon}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MeetingRoomScreen() {
  const { id, audioOnly } = useLocalSearchParams<{ id: string; audioOnly: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1100;

  // ─── Auth & Profile ────────────────────────────────────────────────────
  const [profile, setProfile] = useState<any>(null);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ─── Media States ──────────────────────────────────────────────────────
  const isAudioOnly = audioOnly === 'true';
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(isAudioOnly);
  const [isHandRaised, setIsHandRaised] = useState(false);

  // ─── WebRTC State ──────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<any[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteMutedStates, setRemoteMutedStates] = useState<Record<string, boolean>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidates = useRef<Record<string, any[]>>({});

  // ─── Timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = useMemo(() => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // ─── Init: Auth + Meeting Fetch + Media ───────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initRoom = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          Alert.alert('Not authenticated', 'Please log in to join meetings.');
          router.back();
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profileData) {
          Alert.alert('Error', 'Could not load your profile.');
          router.back();
          return;
        }

        if (!isMounted) return;
        setProfile(profileData);

        // Fetch meeting
        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .select('*, conversation:conversations(title)')
          .eq('id', id)
          .single();

        if (meetingError || !meeting) {
          Alert.alert('Meeting not found', 'This meeting may have ended or you do not have access.');
          router.back();
          return;
        }

        if (!isMounted) return;
        setMeetingData(meeting);

        // Get local media
        let stream: MediaStream;
        try {
          stream = await mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: isAudioOnly
              ? false
              : { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: 30 },
          });
        } catch (mediaErr) {
          console.warn('[MobileMeeting] Full media failed, falling back to audio only:', mediaErr);
          try {
            stream = await mediaDevices.getUserMedia({ audio: true, video: false });
          } catch (audioErr) {
            Alert.alert('Permission Required', 'Microphone access is required to join meetings.');
            router.back();
            return;
          }
        }

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;

        setParticipants([
          {
            id: profileData.id,
            name: profileData.full_name || 'You',
            avatar: profileData.avatar_url,
            isLocal: true,
          },
        ]);

        setLoading(false);

        // Auto-join for voice calls
        if (isAudioOnly) {
          joinRoom(profileData);
        }
      } catch (err) {
        console.error('[MobileMeeting] initRoom error:', err);
        Alert.alert('Error', 'Could not join the meeting room.');
        router.back();
      }
    };

    initRoom();

    return () => {
      isMounted = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch(() => {});
    }
  };

  // ─── Join Room ────────────────────────────────────────────────────────
  const joinRoom = (profileData: any) => {
    setHasJoined(true);
    setupSignaling(profileData);
  };

  const handleJoinNow = () => {
    if (profile) joinRoom(profile);
  };

  // ─── Signaling ────────────────────────────────────────────────────────
  const setupSignaling = (currentProfile: any) => {
    const channel = supabase.channel(`meeting:${id}`, {
      config: { presence: { key: currentProfile.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);

        setParticipants(() => {
          const updated = activeIds
            .map(uid => {
              const entry = (state[uid] as any)?.[0];
              if (!entry) return null;
              return {
                id: uid,
                name: entry.name || 'Participant',
                avatar: entry.avatar,
                isLocal: uid === currentProfile.id,
              };
            })
            .filter(Boolean);

          // Clean up stale connections
          Object.keys(peerConnections.current).forEach(uid => {
            if (!activeIds.includes(uid)) {
              peerConnections.current[uid].close();
              delete peerConnections.current[uid];
            }
          });

          return updated;
        });

        // Initiate WebRTC to anyone who joined before us (sorted order)
        const sorted = [...activeIds].sort();
        sorted.forEach((uid, index) => {
          if (uid < currentProfile.id && !peerConnections.current[uid]) {
            setTimeout(() => {
              if (!peerConnections.current[uid]) {
                createPeerConnection(uid, true, currentProfile);
              }
            }, index * 200);
          }
        });
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const { from, type, data } = payload;
        if (payload.to !== currentProfile.id && payload.to !== 'all') return;

        if (type === 'mute_state') {
          setRemoteMutedStates(prev => ({ ...prev, [from]: !!data.isMuted }));
        } else if (type === 'offer') {
          await handleOffer(from, data, currentProfile);
        } else if (type === 'answer') {
          await handleAnswer(from, data);
        } else if (type === 'candidate') {
          await handleCandidate(from, data);
        } else if (type === 'meeting_ended') {
          Alert.alert('Meeting Ended', 'The host has ended this meeting.');
          cleanup();
          router.back();
        }
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentProfile.id,
            name: currentProfile.full_name,
            avatar: currentProfile.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;
  };

  // ─── WebRTC ───────────────────────────────────────────────────────────
  const createPeerConnection = (targetId: string, isOfferer: boolean, currentProfile: any) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event: any) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            from: currentProfile.id,
            to: targetId,
            type: 'candidate',
            data: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event: any) => {
      const stream = event.streams?.[0];
      if (stream) {
        setRemoteStreams(prev => ({ ...prev, [targetId]: stream }));
      }
    };

    if (isOfferer) {
      pc.createOffer().then((offer: any) => {
        pc.setLocalDescription(offer);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            from: currentProfile.id,
            to: targetId,
            type: 'offer',
            data: offer,
          },
        });
      });
    }

    return pc;
  };

  const handleOffer = async (from: string, offer: any, currentProfile: any) => {
    const pc = createPeerConnection(from, false, currentProfile);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    if (pendingCandidates.current[from]) {
      for (const c of pendingCandidates.current[from]) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      delete pendingCandidates.current[from];
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        from: currentProfile.id,
        to: from,
        type: 'answer',
        data: answer,
      },
    });
  };

  const handleAnswer = async (from: string, answer: any) => {
    const pc = peerConnections.current[from];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    if (pendingCandidates.current[from]) {
      for (const c of pendingCandidates.current[from]) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      delete pendingCandidates.current[from];
    }
  };

  const handleCandidate = async (from: string, candidate: any) => {
    const pc = peerConnections.current[from];
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
      pendingCandidates.current[from].push(candidate);
    }
  };

  // ─── Controls ─────────────────────────────────────────────────────────
  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted; // toggle
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          from: profile?.id,
          to: 'all',
          type: 'mute_state',
          data: { isMuted: nextMuted },
        },
      });
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isVideoOff; // toggle
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleLeave = async () => {
    cleanup();
    router.back();
  };

  const handleEndForAll = async () => {
    Alert.alert('End for All', 'This will end the meeting for everyone. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Meeting',
        style: 'destructive',
        onPress: async () => {
          try {
            channelRef.current?.send({
              type: 'broadcast',
              event: 'signal',
              payload: { from: profile?.id, to: 'all', type: 'meeting_ended', data: {} },
            });
            await supabase
              .from('meetings')
              .update({ status: 'ended', end_time: new Date().toISOString() })
              .eq('id', id);
          } catch (e) {
            console.warn('[MobileMeeting] endForAll error:', e);
          } finally {
            cleanup();
            router.back();
          }
        },
      },
    ]);
  };

  // ─── Derived Layout ───────────────────────────────────────────────────
  const featuredHeight = isDesktop
    ? Math.max(420, height - 232)
    : isTablet
    ? Math.min(430, height * 0.46)
    : Math.min(330, height * 0.34);

  const smallerTileHeight = isDesktop ? undefined : isTablet ? 182 : 164;

  const mobileTileWidth = useMemo(() => {
    if (width < 390) return '100%';
    return isTablet ? '48.8%' : '48.3%';
  }, [isTablet, width]);

  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipants = participants.filter(p => !p.isLocal);
  const featuredParticipant = remoteParticipants[0] || localParticipant;
  const sideParticipants = remoteParticipants.length > 0
    ? [localParticipant, ...remoteParticipants.slice(1)].filter(Boolean)
    : [];

  const canEndForAll = meetingData?.creator_id === profile?.id || profile?.role === 'admin';

  // ─── Loading Screen ───────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Initializing Secure Hardware...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Lobby (video-only pre-join screen) ───────────────────────────────
  if (!hasJoined && !isAudioOnly) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.lobbyContainer}>
          <Text style={styles.lobbyTitle}>Ready to join?</Text>
          <Text style={styles.lobbySubtitle}>
            {meetingData?.conversation?.title || 'Meeting'}
          </Text>

          {localStreamRef.current && !isVideoOff ? (
            <View style={styles.lobbyVideoWrap}>
              <RTCView
                streamURL={(localStreamRef.current as any).toURL()}
                style={styles.lobbyVideo}
                objectFit="cover"
                mirror
              />
            </View>
          ) : (
            <View style={[styles.lobbyVideoWrap, styles.lobbyVideoPlaceholder]}>
              <Text style={styles.lobbyInitials}>{profile?.full_name?.[0] || 'U'}</Text>
            </View>
          )}

          <View style={styles.lobbyControls}>
            <TouchableOpacity
              onPress={toggleMute}
              style={[styles.lobbyCtrlBtn, isMuted && styles.lobbyCtrlBtnDanger]}
            >
              {isMuted ? <MicOff color="#fff" size={22} /> : <Mic color="#fff" size={22} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleVideo}
              style={[styles.lobbyCtrlBtn, isVideoOff && styles.lobbyCtrlBtnDanger]}
            >
              {isVideoOff ? <VideoOff color="#fff" size={22} /> : <Video color="#fff" size={22} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.joinNowButton} onPress={handleJoinNow}>
            <Text style={styles.joinNowButtonText}>Join Now</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLeave} style={styles.lobbyBack}>
            <Text style={styles.lobbyBackText}>Back to Messages</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Live Meeting UI ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>

        {/* ─── Top Bar ─────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <TouchableOpacity activeOpacity={0.85} style={styles.topIconButton}>
              <Menu color="#85adff" size={20} />
            </TouchableOpacity>
            <Text style={styles.brandText} numberOfLines={1}>
              {meetingData?.conversation?.title || (isAudioOnly ? 'Voice Call' : 'Video Meeting')}
            </Text>
          </View>

          <View style={styles.topMetaRow}>
            <View style={styles.timerChip}>
              <View style={styles.timerDot} />
              <Text style={styles.timerText}>{formattedTime}</Text>
            </View>

            <View style={styles.participantMetaRow}>
              <Users color="#94a3b8" size={16} />
              <Text style={styles.participantMetaText}>
                {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Body: Video Grid ─────────────────────────────────────── */}
        <View style={styles.body}>
          <View
            style={[
              styles.mainCanvas,
              isDesktop && styles.mainCanvasDesktop,
            ]}
          >
            {isDesktop ? (
              <View style={styles.desktopMeetingLayout}>
                {featuredParticipant && (
                  <View style={[styles.desktopFeaturedWrap, { height: featuredHeight }]}>
                    <ParticipantTile
                      name={featuredParticipant.name}
                      avatarFirst={(featuredParticipant.name || 'U')[0].toUpperCase()}
                      stream={
                        featuredParticipant.isLocal
                          ? localStreamRef.current
                          : remoteStreams[featuredParticipant.id] || null
                      }
                      isLocal={featuredParticipant.isLocal}
                      isMuted={
                        featuredParticipant.isLocal
                          ? isMuted
                          : !!remoteMutedStates[featuredParticipant.id]
                      }
                      isVideoOff={featuredParticipant.isLocal ? isVideoOff : false}
                      featured
                    />
                  </View>
                )}
                <View style={[styles.desktopParticipantsColumn, { height: featuredHeight }]}>
                  {sideParticipants.map(p => (
                    <View key={p.id} style={styles.desktopParticipantItem}>
                      <ParticipantTile
                        name={p.name}
                        avatarFirst={(p.name || 'U')[0].toUpperCase()}
                        stream={p.isLocal ? localStreamRef.current : remoteStreams[p.id] || null}
                        isLocal={p.isLocal}
                        isMuted={p.isLocal ? isMuted : !!remoteMutedStates[p.id]}
                        isVideoOff={p.isLocal ? isVideoOff : false}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.mobileMeetingContent}
              >
                {featuredParticipant && (
                  <View style={[styles.mobileFeaturedWrap, { height: featuredHeight }]}>
                    <ParticipantTile
                      name={featuredParticipant.name}
                      avatarFirst={(featuredParticipant.name || 'U')[0].toUpperCase()}
                      stream={
                        featuredParticipant.isLocal
                          ? localStreamRef.current
                          : remoteStreams[featuredParticipant.id] || null
                      }
                      isLocal={featuredParticipant.isLocal}
                      isMuted={
                        featuredParticipant.isLocal
                          ? isMuted
                          : !!remoteMutedStates[featuredParticipant.id]
                      }
                      isVideoOff={featuredParticipant.isLocal ? isVideoOff : false}
                      featured
                    />
                  </View>
                )}

                <View style={styles.mobileParticipantsGrid}>
                  {sideParticipants.map(p => (
                    <View key={p.id} style={{ width: mobileTileWidth, height: smallerTileHeight }}>
                      <ParticipantTile
                        name={p.name}
                        avatarFirst={(p.name || 'U')[0].toUpperCase()}
                        stream={p.isLocal ? localStreamRef.current : remoteStreams[p.id] || null}
                        isLocal={p.isLocal}
                        isMuted={p.isLocal ? isMuted : !!remoteMutedStates[p.id]}
                        isVideoOff={p.isLocal ? isVideoOff : false}
                        tileHeight={smallerTileHeight}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>

        {/* ─── Bottom Controls ──────────────────────────────────────── */}
        <View style={[styles.bottomControlsWrap, isDesktop && styles.bottomControlsWrapDesktop]}>
          <View style={styles.bottomControlsBar}>
            <View style={styles.controlsGroup}>
              <ControlButton
                icon={
                  isMuted ? (
                    <MicOff color="#e4e7fb" size={20} />
                  ) : (
                    <Mic color="#e4e7fb" size={20} fill="#e4e7fb" />
                  )
                }
                active={isMuted}
                onPress={toggleMute}
              />

              {!isAudioOnly && (
                <ControlButton
                  icon={
                    isVideoOff ? (
                      <VideoOff color="#e4e7fb" size={20} />
                    ) : (
                      <Video color="#e4e7fb" size={20} fill="#e4e7fb" />
                    )
                  }
                  active={isVideoOff}
                  onPress={toggleVideo}
                />
              )}

              <ControlButton
                icon={<Hand color={isHandRaised ? '#85adff' : '#e4e7fb'} size={20} />}
                active={isHandRaised}
                onPress={() => setIsHandRaised(prev => !prev)}
              />

              <ControlButton
                icon={<MoreVertical color="#e4e7fb" size={20} />}
                onPress={() => {
                  if (canEndForAll) {
                    Alert.alert('Meeting Options', '', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Leave Meeting', onPress: handleLeave },
                      { text: 'End for All', style: 'destructive', onPress: handleEndForAll },
                    ]);
                  }
                }}
              />
            </View>

            <View style={styles.controlsDivider} />

            <ControlButton
              icon={<PhoneOff color="#fff" size={20} />}
              danger
              onPress={handleLeave}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090e1b',
  },
  screen: {
    flex: 1,
    backgroundColor: '#090e1b',
  },

  // ── Loading ──────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#090e1b',
  },
  loadingText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    color: Colors.slate500,
    fontSize: 12,
  },

  // ── Lobby ────────────────────────────────────────────────────────────
  lobbyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
    backgroundColor: '#090e1b',
  },
  lobbyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.5,
  },
  lobbySubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 12,
    color: Colors.slate500,
  },
  lobbyVideoWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lobbyVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyVideo: {
    flex: 1,
  },
  lobbyInitials: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 56,
    color: Colors.accent,
    opacity: 0.5,
  },
  lobbyControls: {
    flexDirection: 'row',
    gap: 16,
  },
  lobbyCtrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lobbyCtrlBtnDanger: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  joinNowButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  joinNowButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  lobbyBack: {
    paddingVertical: 8,
  },
  lobbyBackText: {
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 13,
    color: Colors.slate500,
  },

  // ── Top Bar ──────────────────────────────────────────────────────────
  topBar: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9,14,27,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  brandText: {
    fontSize: 16,
    color: '#e4e7fb',
    fontFamily: Fonts.Outfit_700Bold,
    letterSpacing: -0.3,
    flex: 1,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(67,72,87,0.35)',
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ff716c',
  },
  timerText: {
    color: '#e4e7fb',
    fontSize: 14,
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  participantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantMetaText: {
    color: '#a6aabc',
    fontSize: 13,
    fontFamily: Fonts.Outfit_500Medium,
  },

  // ── Body ─────────────────────────────────────────────────────────────
  body: {
    flex: 1,
  },
  mainCanvas: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 112,
    backgroundColor: '#090e1b',
  },
  mainCanvasDesktop: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // ── Desktop Layout ───────────────────────────────────────────────────
  desktopMeetingLayout: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  desktopFeaturedWrap: {
    flex: 1.68,
  },
  desktopParticipantsColumn: {
    width: 300,
    gap: 16,
  },
  desktopParticipantItem: {
    flex: 1,
    minHeight: 0,
  },

  // ── Mobile Layout ────────────────────────────────────────────────────
  mobileMeetingContent: {
    gap: 16,
    paddingBottom: 12,
  },
  mobileFeaturedWrap: {
    width: '100%',
  },
  mobileParticipantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  // ── Participant Tile ─────────────────────────────────────────────────
  tileShell: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(67,72,87,0.24)',
    position: 'relative',
  },
  featuredTile: {
    flex: 1,
    borderColor: 'rgba(133,173,255,0.68)',
    shadowColor: '#85adff',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  participantTile: {
    flex: 1,
  },
  tileRtcView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  initialTileSurface: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialBadge: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: '#2f2ebe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialBadgeText: {
    color: '#9093ff',
    fontSize: 24,
    fontFamily: Fonts.Outfit_700Bold,
  },
  tileNameChip: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featuredNameChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    maxWidth: '82%',
  },
  smallNameChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '86%',
  },
  tileName: {
    color: '#f3f6ff',
    fontFamily: Fonts.Outfit_600SemiBold,
  },
  featuredTileName: {
    fontSize: 13,
  },
  smallTileName: {
    fontSize: 11,
  },
  hostBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(133,173,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(133,173,255,0.3)',
  },
  hostBadgeText: {
    color: '#85adff',
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: Fonts.Outfit_700Bold,
  },

  // ── Bottom Controls ──────────────────────────────────────────────────
  bottomControlsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  bottomControlsWrapDesktop: {
    paddingRight: 360,
  },
  bottomControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 32,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(13,19,33,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  controlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131929',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  controlsDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  endCallButton: {
    minWidth: 68,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9f0519',
    shadowColor: '#ff716c',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
