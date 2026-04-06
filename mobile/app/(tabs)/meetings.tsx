import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { Video, Phone, Calendar, Clock, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function fetchMeetings() {
    setLoading(true);
    const { data } = await supabase
      .from('meetings')
      .select('*, conversation:conversations(title)')
      .order('start_time', { ascending: false })
      .limit(20);
    
    if (data) setMeetings(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleJoin = (id: string, isAudio: boolean) => {
    router.push(`/portal/meetings/room?id=${id}&audioOnly=${isAudio}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'ended': return Colors.slate500;
      default: return '#f59e0b';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Meetings</Text>
          <Text style={styles.headerSubtitle}>Real-time secure nodes</Text>
        </View>
        
        <TouchableOpacity style={styles.newButton}>
          <Plus size={16} color="#fff" />
          <Text style={styles.newButtonText}>NEW</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={meetings}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchMeetings} tintColor={Colors.accent} />}
        renderItem={({ item }) => (
          <GlassCard style={styles.card} intensity={15}>
            <View style={styles.cardHeader}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '22' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
              
              <Text style={styles.timeText}>
                {new Date(item.start_time).toLocaleDateString()} {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <Text style={styles.title}>{item.conversation?.title || 'Secure Call Session'}</Text>
            
            {item.status === 'active' && (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.joinButton, { backgroundColor: '#3b82f6' }]} 
                  onPress={() => handleJoin(item.id, false)}
                >
                  <Video size={16} color="#fff" />
                  <Text style={styles.joinButtonText}>Join Video</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.joinButton, { backgroundColor: 'rgba(255,255,255,0.1)' }]} 
                  onPress={() => handleJoin(item.id, true)}
                >
                  <Phone size={16} color="#fff" />
                  <Text style={styles.joinButtonText}>Audio Only</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'ended' && (
              <View style={styles.endedInfo}>
                <Clock size={12} color={Colors.slate500} />
                <Text style={styles.endedText}>
                  Ended {item.end_time ? new Date(item.end_time).toLocaleTimeString() : 'Unknown'}
                </Text>
              </View>
            )}
          </GlassCard>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={styles.emptyText}>No historical meetings exist.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontFamily: Fonts.Outfit_700Bold, fontSize: 28, color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 12, color: Colors.slate500, marginTop: 4 },
  newButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  newButtonText: { fontFamily: Fonts.Outfit_700Bold, fontSize: 12, color: '#fff', marginLeft: 4, letterSpacing: 0.5 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { padding: 16, borderRadius: 20, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontFamily: Fonts.Outfit_700Bold, fontSize: 10, letterSpacing: 1 },
  timeText: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 10, color: Colors.slate500 },
  title: { fontFamily: Fonts.Outfit_700Bold, fontSize: 18, color: '#fff', marginBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 12 },
  joinButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, paddingHorizontal: 10 },
  joinButtonText: { fontFamily: Fonts.Outfit_700Bold, fontSize: 12, color: '#fff', marginLeft: 8 },
  endedInfo: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
  endedText: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 10, color: Colors.slate500, marginLeft: 6 },
  emptyText: { fontFamily: Fonts.SpaceMono_400Regular, color: Colors.slate500, textAlign: 'center', marginTop: 40 }
});
