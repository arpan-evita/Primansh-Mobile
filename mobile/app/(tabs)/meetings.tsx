import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Calendar,
  Check,
  Clock,
  Link2,
  Phone,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlassButton } from '../../components/ui/GlassButton';
import { Colors, Fonts } from '../../lib/theme';
import {
  getCurrentMobileProfile,
  listAccessibleMeetings,
  listAllowedMeetingProfiles,
  MobileMeeting,
  MobileProfile,
  startInstantMeeting,
} from '../../lib/meetings';

function formatMeetingTime(value?: string | null) {
  if (!value) return 'Unknown';

  const date = new Date(value);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export default function MeetingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [allowedProfiles, setAllowedProfiles] = useState<MobileProfile[]>([]);
  const [meetings, setMeetings] = useState<MobileMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerVisible, setComposerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [joinMeetingId, setJoinMeetingId] = useState('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [audioOnly, setAudioOnly] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  const activeMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.status === 'active'),
    [meetings]
  );

  const recentMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.status !== 'active'),
    [meetings]
  );

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allowedProfiles;

    return allowedProfiles.filter((item) => {
      const haystack = `${item.full_name} ${item.role}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [allowedProfiles, searchQuery]);

  async function fetchData() {
    setLoading(true);
    try {
      const currentProfile = await getCurrentMobileProfile();
      if (!currentProfile) {
        setProfile(null);
        setMeetings([]);
        setAllowedProfiles([]);
        return;
      }

      const [meetingData, recipientData] = await Promise.all([
        listAccessibleMeetings(currentProfile),
        listAllowedMeetingProfiles(currentProfile),
      ]);

      setProfile(currentProfile);
      setMeetings(meetingData);
      setAllowedProfiles(recipientData);
    } catch (error) {
      console.error('[MobileMeetings] fetchData failed:', error);
      Alert.alert('Meetings unavailable', 'We could not load your meetings right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function resetComposer() {
    setComposerVisible(false);
    setSearchQuery('');
    setMeetingTitle('');
    setSelectedParticipantIds([]);
    setAudioOnly(false);
  }

  function toggleParticipantSelection(profileId: string) {
    setSelectedParticipantIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((item) => item !== profileId)
        : [...prev, profileId]
    );
  }

  async function handleStartMeeting() {
    if (!profile) return;

    if (selectedParticipantIds.length === 0) {
      Alert.alert('Choose participants', 'Select at least one person before starting a meeting.');
      return;
    }

    setCreatingMeeting(true);
    try {
      const meeting = await startInstantMeeting({
        currentProfile: profile,
        participantIds: selectedParticipantIds,
        title: meetingTitle.trim() || 'Instant Meeting',
        isAudioOnly: audioOnly,
      });

      resetComposer();
      await fetchData();
      router.push(`/portal/meetings/room?id=${meeting.id}&audioOnly=${audioOnly}`);
    } catch (error: any) {
      console.error('[MobileMeetings] handleStartMeeting failed:', error);
      Alert.alert('Could not start meeting', error?.message || 'Please try again.');
    } finally {
      setCreatingMeeting(false);
    }
  }

  function handleJoinMeeting(meetingId: string, isAudioMeeting?: boolean | null) {
    router.push(`/portal/meetings/room?id=${meetingId}&audioOnly=${isAudioMeeting ? 'true' : 'false'}`);
  }

  function handleJoinByCode() {
    const meetingId = joinMeetingId.trim();

    if (!meetingId) {
      Alert.alert('Meeting ID missing', 'Enter the meeting ID you want to join.');
      return;
    }

    router.push(`/portal/meetings/room?id=${meetingId}&audioOnly=false`);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={Colors.accent} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Meet</Text>
            <Text style={styles.headerSubtitle}>
              Google Meet style meeting flow for quick start, fast join, and clean mobile calls.
            </Text>
          </View>
        </View>

        <View style={styles.heroRow}>
          <GlassCard style={styles.heroCard} intensity={25}>
            <View style={styles.heroIconWrap}>
              <Video color="#fff" size={22} />
            </View>
            <Text style={styles.heroTitle}>New meeting</Text>
            <Text style={styles.heroCopy}>
              Start an instant meeting with selected teammates or clients.
            </Text>
            <GlassButton
              title="Start Now"
              onPress={() => setComposerVisible(true)}
              style={styles.heroButton}
              icon={<Users color="#fff" size={16} />}
            />
          </GlassCard>

          <GlassCard style={styles.heroCard} intensity={18}>
            <View style={[styles.heroIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.18)' }]}>
              <Link2 color="#10b981" size={22} />
            </View>
            <Text style={styles.heroTitle}>Join by ID</Text>
            <Text style={styles.heroCopy}>
              Rejoin a live meeting by meeting ID when someone shares the session link.
            </Text>
            <TextInput
              value={joinMeetingId}
              onChangeText={setJoinMeetingId}
              placeholder="Paste meeting ID"
              placeholderTextColor={Colors.slate500}
              style={styles.joinInput}
              autoCapitalize="none"
            />
            <GlassButton
              title="Join"
              onPress={handleJoinByCode}
              variant="secondary"
              style={styles.heroButton}
              icon={<Video color="#fff" size={16} />}
            />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live meetings</Text>
            <Text style={styles.sectionMeta}>{activeMeetings.length}</Text>
          </View>

          {activeMeetings.length > 0 ? (
            activeMeetings.map((meeting) => (
              <GlassCard key={meeting.id} style={styles.meetingCard} intensity={20}>
                <View style={styles.meetingTopRow}>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  <Text style={styles.meetingTimestamp}>{formatMeetingTime(meeting.start_time)}</Text>
                </View>

                <Text style={styles.meetingTitle}>
                  {meeting.conversation?.title || 'Team meeting'}
                </Text>

                <Text style={styles.meetingSubtitle}>
                  {meeting.is_audio_only ? 'Audio room in progress' : 'Video meeting in progress'}
                </Text>

                <View style={styles.meetingActions}>
                  <TouchableOpacity
                    style={styles.primaryJoinButton}
                    onPress={() => handleJoinMeeting(meeting.id, false)}
                  >
                    <Video color="#fff" size={16} />
                    <Text style={styles.primaryJoinButtonText}>Join video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryJoinButton}
                    onPress={() => handleJoinMeeting(meeting.id, true)}
                  >
                    <Phone color="#fff" size={16} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))
          ) : (
            <GlassCard style={styles.emptyCard} intensity={14}>
              <Text style={styles.emptyTitle}>No live meetings right now</Text>
              <Text style={styles.emptyCopy}>Use New meeting to launch one instantly.</Text>
            </GlassCard>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent meetings</Text>
            <Text style={styles.sectionMeta}>{recentMeetings.length}</Text>
          </View>

          {recentMeetings.length > 0 ? (
            recentMeetings.map((meeting) => (
              <GlassCard key={meeting.id} style={styles.historyCard} intensity={12}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>
                    {meeting.conversation?.title || 'Meeting room'}
                  </Text>
                  <Calendar color={Colors.slate500} size={14} />
                </View>

                <Text style={styles.historyTime}>Started: {formatMeetingTime(meeting.start_time)}</Text>
                <Text style={styles.historyTime}>Ended: {formatMeetingTime(meeting.end_time)}</Text>
              </GlassCard>
            ))
          ) : (
            <GlassCard style={styles.emptyCard} intensity={10}>
              <Text style={styles.emptyTitle}>No recent meetings yet</Text>
              <Text style={styles.emptyCopy}>Ended sessions will show up here automatically.</Text>
            </GlassCard>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={composerVisible}
        onRequestClose={resetComposer}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New meeting</Text>
                <Text style={styles.modalSubtitle}>Pick participants and choose your meeting mode.</Text>
              </View>

              <TouchableOpacity onPress={resetComposer} style={styles.iconButton}>
                <X color="#fff" size={18} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={meetingTitle}
              onChangeText={setMeetingTitle}
              placeholder="Meeting title"
              placeholderTextColor={Colors.slate500}
              style={styles.modalInput}
            />

            <View style={styles.modeRow}>
              <TouchableOpacity
                onPress={() => setAudioOnly(false)}
                style={[styles.modeButton, !audioOnly && styles.modeButtonActive]}
              >
                <Video color="#fff" size={16} />
                <Text style={styles.modeButtonText}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAudioOnly(true)}
                style={[styles.modeButton, audioOnly && styles.modeButtonActive]}
              >
                <Phone color="#fff" size={16} />
                <Text style={styles.modeButtonText}>Audio</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Search color={Colors.slate500} size={16} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search people"
                placeholderTextColor={Colors.slate500}
                style={styles.searchInput}
              />
            </View>

            <ScrollView style={styles.participantList} contentContainerStyle={styles.participantListContent}>
              {filteredProfiles.map((item) => {
                const selected = selectedParticipantIds.includes(item.id);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.participantRow, selected && styles.participantRowSelected]}
                    onPress={() => toggleParticipantSelection(item.id)}
                  >
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantAvatarText}>
                        {(item.full_name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.participantMeta}>
                      <Text style={styles.participantName}>{item.full_name}</Text>
                      <Text style={styles.participantRole}>{item.role}</Text>
                    </View>

                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Check color="#fff" size={14} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {filteredProfiles.length === 0 ? (
                <Text style={styles.emptyPickerText}>No matching participants available.</Text>
              ) : null}
            </ScrollView>

            <GlassButton
              title={creatingMeeting ? 'Starting...' : `Start with ${selectedParticipantIds.length || 0} people`}
              onPress={handleStartMeeting}
              style={styles.startMeetingButton}
              icon={<Users color="#fff" size={16} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 18,
  },
  header: {
    marginBottom: 4,
  },
  headerTextWrap: {
    gap: 6,
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 32,
    color: '#fff',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    lineHeight: 18,
    color: Colors.slate500,
  },
  heroRow: {
    gap: 14,
  },
  heroCard: {
    padding: 0,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 20,
    color: '#fff',
    marginBottom: 6,
  },
  heroCopy: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    lineHeight: 18,
    color: Colors.slate500,
    marginBottom: 16,
  },
  heroButton: {
    marginTop: 4,
  },
  joinInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 12,
    marginBottom: 12,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  sectionMeta: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.accent,
  },
  meetingCard: {
    padding: 0,
  },
  meetingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 9,
    color: '#10b981',
  },
  meetingTimestamp: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  },
  meetingTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 22,
    color: '#fff',
    marginBottom: 6,
  },
  meetingSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    color: Colors.slate500,
    marginBottom: 16,
  },
  meetingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryJoinButton: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryJoinButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#fff',
  },
  secondaryJoinButton: {
    width: 56,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historyCard: {
    padding: 0,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  historyTime: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    marginTop: 4,
  },
  emptyCard: {
    padding: 0,
  },
  emptyTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 6,
  },
  emptyCopy: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
    color: Colors.slate500,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#08111f',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 24,
    color: '#fff',
  },
  modalSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    lineHeight: 16,
    color: Colors.slate500,
    marginTop: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.Outfit_500Medium,
    fontSize: 14,
    marginBottom: 14,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderColor: 'rgba(59,130,246,0.5)',
  },
  modeButtonText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 13,
    color: '#fff',
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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 13,
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 11,
  },
  participantList: {
    maxHeight: 320,
  },
  participantListContent: {
    paddingBottom: 12,
    gap: 10,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  participantRowSelected: {
    borderColor: 'rgba(59,130,246,0.55)',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  participantAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
  participantRole: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    marginTop: 3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  emptyPickerText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
    textAlign: 'center',
    marginTop: 16,
  },
  startMeetingButton: {
    marginTop: 10,
  },
});
