import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckSquare, Clock, AlertCircle, ChevronRight, Circle, CheckCircle2 } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  async function fetchTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('id, role, associated_client_id').eq('id', user.id).single();
    setProfile(profile);

    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
    
    if (profile?.role === 'client') {
      query = query.eq('client_id', profile.associated_client_id);
    } else {
      query = query.eq('assigned_to', user.id);
    }

    const { data } = await query;
    setTasks(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetchTasks();

    // Real-time subscription
    const channel = supabase
      .channel('public:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          // Check if it belongs to this user/client
          if (profile?.role === 'client' && payload.new.client_id === profile.associated_client_id) {
            setTasks(prev => [payload.new, ...prev]);
          } else if (profile?.role !== 'client' && payload.new.assigned_to === profile?.id) {
            setTasks(prev => [payload.new, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id === payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, profile?.associated_client_id]);

  async function toggleTask(task: any) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);
    
    // UI will update via real-time subscription
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WORKFLOW CONTROL</Text>
        <Text style={styles.headerSubtitle}>// ACTIVE NODES & TASKING</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); }} tintColor="#3b82f6" />}
        renderItem={({ item }) => (
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => profile?.role !== 'client' && toggleTask(item)}
          >
            <GlassCard 
              style={[styles.taskCard, item.status === 'done' && styles.taskDoneCard]}
              intensity={item.status === 'done' ? 15 : 25}
            >
              <View style={styles.taskContent}>
                <View style={styles.taskIcon}>
                  {item.status === 'done' ? (
                    <CheckCircle2 size={24} color="#10b981" />
                  ) : (
                    <Circle size={24} color="#475569" />
                  )}
                </View>
                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, item.status === 'done' && styles.taskDoneTitle]}>{item.title}</Text>
                  <View style={styles.taskMeta}>
                    <Clock size={12} color="#64748b" />
                    <Text style={styles.taskDate}>
                      {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No date'}
                    </Text>
                    {item.priority === 'high' && (
                      <View style={styles.priorityBadge}>
                        <AlertCircle size={10} color="#ef4444" />
                        <Text style={styles.priorityText}>HIGH</Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={16} color="#1e293b" />
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CheckSquare size={48} color="#1e293b" />
            <Text style={styles.emptyText}>Protocol Clean: No active tasks assigned</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070b14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(7, 11, 20, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#3b82f6',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 4,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  taskCard: {
    padding: 0, // Handled by GlassCard's inner content if needed, but we used custom content inside
    marginBottom: 12,
  },
  taskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  taskDoneCard: {
    opacity: 0.6,
  },
  taskIcon: {
    marginRight: 16,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  taskDoneTitle: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskDate: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ef4444',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    opacity: 0.3,
  },
  emptyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
  },
});
