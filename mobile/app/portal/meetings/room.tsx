import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Mic, MicOff, Video, VideoOff, Maximize, Hand, Loader2 } from 'lucide-react-native';
import { Colors, Fonts } from '../../../lib/theme';
import { supabase } from '../../../lib/supabase';
import { 
  RTCPeerConnection, 
  RTCIceCandidate, 
  RTCSessionDescription, 
  RTCView, 
  mediaDevices, 
  MediaStream 
} from 'react-native-webrtc';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function MeetingRoomNativeScreen() {
  const { id, audioOnly } = useLocalSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  
  // States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(audioOnly === 'true');
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]); // To track layout
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteMutedStates, setRemoteMutedStates] = useState<Record<string, boolean>>({});

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidates = useRef<Record<string, any[]>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase.from('profiles').select('*').eq('id', data.session.user.id).single()
          .then(({ data: pData }) => setProfile(pData));
      } else {
        Alert.alert("Error", "You must be logged in.");
        router.back();
      }
    });
  }, []);

  useEffect(() => {
    if (!profile || !id) return;
    initHardwareAndSignaling();

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      Object.keys(peerConnections.current).forEach(key => {
        peerConnections.current[key].close();
      });
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [profile, id]);

  const initHardwareAndSignaling = async () => {
    setLoading(true);
    
    // Request Hardware permissions securely
    const camStatus = await Camera.requestCameraPermissionsAsync();
    const micStatus = await Audio.requestPermissionsAsync();

    if (micStatus.status !== 'granted') {
      Alert.alert("Permission Required", "Microphone access is required for meetings.");
      router.back();
      return;
    }

    try {
      // Initialize local stream
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideoOff ? false : {
          width: 640,
          height: 480,
          frameRate: 30,
          facingMode: "user"
        }
      });

      localStreamRef.current = stream;

      // Add self to participants array for UI rendering
      setParticipants([{ id: profile.id, name: profile.full_name, isLocal: true }]);

      // Now join the Supabase Signaling Room
      setupSignaling();

    } catch (e) {
      console.warn("Media devices failed:", e);
      Alert.alert("Hardware Error", "Could not access hardware.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const setupSignaling = () => {
    const channel = supabase.channel(`meeting:${id}`, {
      config: { presence: { key: profile?.id } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);
        
        // Update participants for UI dynamically
        setParticipants(activeIds.map(uid => ({
          id: uid,
          name: state[uid]?.[0]?.name || "Unknown",
          isLocal: uid === profile.id
        })));

        // Initiate RTC connection to any people who have a smaller ID than us 
        // (canonical sorting prevents race conditions just like the web app)
        const sorted = [...activeIds].sort();
        sorted.forEach(uid => {
          if (uid < profile.id && !peerConnections.current[uid]) {
            createPeerConnection(uid, true);
          }
        });
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const { from, to, type, data } = payload;
        
        // Drop unrelated messages
        if (to !== profile.id && to !== 'all') return;

        if (type === 'mute_state') {
          setRemoteMutedStates(prev => ({ ...prev, [from]: !!data.isMuted }));
        } else if (type === 'offer') {
          handleOffer(from, data);
        } else if (type === 'answer') {
          handleAnswer(from, data);
        } else if (type === 'candidate') {
          handleCandidate(from, data);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: profile.id,
            name: profile.full_name,
            online_at: new Date().toISOString()
          });
        }
      });

    channelRef.current = channel;
  };

  const createPeerConnection = (targetId: string, isOfferer: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS as any);
    peerConnections.current[targetId] = pc;

    // Add local tracks to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: profile.id, to: targetId, type: 'candidate', data: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      // React Native WebRTC supplies event.streams[0]
      const stream = event.streams[0];
      if (stream) {
        setRemoteStreams(prev => ({ ...prev, [targetId]: stream }));
      }
    };

    if (isOfferer) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: profile.id, to: targetId, type: 'offer', data: offer }
        });
      });
    }

    return pc;
  };

  const handleOffer = async (from: string, offer: any) => {
    const pc = createPeerConnection(from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Process pending candidates
    if (pendingCandidates.current[from]) {
      pendingCandidates.current[from].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
      delete pendingCandidates.current[from];
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: { from: profile.id, to: from, type: 'answer', data: answer }
    });
  };

  const handleAnswer = async (from: string, answer: any) => {
    const pc = peerConnections.current[from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      if (pendingCandidates.current[from]) {
        pendingCandidates.current[from].forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
        delete pendingCandidates.current[from];
      }
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

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        channelRef.current?.send({
          type: 'broadcast', event: 'signal',
          payload: { from: profile.id, to: 'all', type: 'mute_state', data: { isMuted: !audioTrack.enabled } }
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Initializing Secure Hardware...</Text>
      </View>
    );
  }

  // Determine grid layout based on number of participants
  const totalCards = participants.length;
  // If 1 person (you), flex 1. If 2, flex 1/2 each. If 3+, wrap grid.

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.leaveButton} onPress={() => router.back()}>
          <Text style={styles.leaveButtonText}>Leave System</Text>
        </TouchableOpacity>
      </View>

      {/* Main RTC Mesh Grid */}
      <View style={styles.gridContainer}>
        {participants.map((p, idx) => {
          const isLocal = p.isLocal;
          const stream = isLocal ? localStreamRef.current : remoteStreams[p.id];
          const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
          
          return (
            <View key={p.id} style={[styles.videoWrapper, { flex: totalCards <= 2 ? 1 : 0.5, height: totalCards > 2 ? '50%' : 'auto' }]}>
              {stream && (hasVideo || isLocal && !isVideoOff) ? (
                // Use the Native RTCView to render hardware frames straight to the screen buffer
                <RTCView 
                  streamURL={stream.toURL()} 
                  style={styles.videoNode}
                  objectFit="cover" 
                  mirror={isLocal} 
                />
              ) : (
                <View style={styles.audioOnlyNode}>
                  <Text style={styles.audioOnlyText}>{p.name?.[0]?.toUpperCase()}</Text>
                </View>
              )}
              
              {/* Overlay Tags */}
              <View style={styles.overlayTag}>
                <Text style={styles.overlayText}>{p.name} {isLocal ? '(You)' : ''}</Text>
                {remoteMutedStates[p.id] && <MicOff size={12} color="#ef4444" style={{marginLeft: 4}} />}
              </View>
            </View>
          );
        })}
      </View>

      {/* Control Bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity style={[styles.controlButton, isMuted && styles.controlButtonDanger]} onPress={toggleMute}>
          {isMuted ? <MicOff color="#fff" size={24} /> : <Mic color="#fff" size={24} />}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, isVideoOff && styles.controlButtonDanger]} onPress={toggleVideo}>
          {isVideoOff ? <VideoOff color="#fff" size={24} /> : <Video color="#fff" size={24} />}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, { backgroundColor: '#ef4444' }]} onPress={() => router.back()}>
          <X color="#fff" size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070b14' },
  loadingContainer: { flex: 1, backgroundColor: '#070b14', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: Fonts.SpaceMono_400Regular, color: Colors.slate500, marginTop: 16, fontSize: 12 },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'flex-start' },
  leaveButton: { backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  leaveButtonText: { fontFamily: Fonts.SpaceMono_700Bold, color: '#ef4444', fontSize: 12 },
  gridContainer: { flex: 1, padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  videoWrapper: { backgroundColor: '#1e293b', borderRadius: 20, overflow: 'hidden', position: 'relative' },
  videoNode: { flex: 1, width: '100%', height: '100%' },
  audioOnlyNode: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  audioOnlyText: { fontFamily: Fonts.Outfit_700Bold, fontSize: 48, color: '#3b82f6', opacity: 0.5 },
  overlayTag: { position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  overlayText: { fontFamily: Fonts.SpaceMono_700Bold, fontSize: 10, color: '#fff' },
  controlBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 24, gap: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  controlButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
  controlButtonDanger: { backgroundColor: 'rgba(255,255,255,0.1)' }
});
