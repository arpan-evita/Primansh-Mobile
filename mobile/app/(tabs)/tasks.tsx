import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Fonts } from '../../lib/theme';
import { CheckCircle2, Circle, Clock } from 'lucide-react-native';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchTasks() {
    setLoading(true);
    const { data: taskData, error } = await supabase
      .from('tasks')
      .select('*, client:clients(firm_name)')
      .order('created_at', { ascending: false });
    
    if (taskData) setTasks(taskData);
    setLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  const toggleTaskStatus = async (task: any) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);
  };

  // Grouping tasks for SectionList
  const getGroupedTasks = () => {
    const todo = tasks.filter(t => t.status === 'todo');
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const done = tasks.filter(t => t.status === 'done');

    return [
      { title: 'TODO', data: todo, color: Colors.slate500 },
      { title: 'IN PROGRESS', data: inProgress, color: '#3b82f6' },
      { title: 'COMPLETED', data: done, color: '#10b981' }
    ].filter(section => section.data.length > 0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks</Text>
        <Text style={styles.headerSubtitle}>Kanban Execution List</Text>
      </View>

      <SectionList
        sections={getGroupedTasks()}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTasks} tintColor={Colors.accent} />}
        renderSectionHeader={({ section: { title, color } }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: color }]} />
            <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <GlassCard style={styles.card} intensity={10}>
            <TouchableOpacity onPress={() => toggleTaskStatus(item)} style={styles.taskContainer}>
              <View style={styles.checkboxContainer}>
                {item.status === 'done' ? (
                  <CheckCircle2 color="#10b981" size={20} />
                ) : item.status === 'in_progress' ? (
                  <Clock color="#3b82f6" size={20} />
                ) : (
                  <Circle color={Colors.slate500} size={20} />
                )}
              </View>
              
              <View style={styles.taskInfo}>
                <Text style={[
                  styles.taskTitle, 
                  item.status === 'done' && styles.taskTitleDone
                ]}>
                  {item.title}
                </Text>
                {item.client?.firm_name && (
                  <Text style={styles.clientLabel}>{item.client.firm_name}</Text>
                )}
              </View>

              <View style={[styles.priorityBadge, { 
                backgroundColor: item.priority === 'urgent' ? '#ef444422' : 
                                 item.priority === 'high' ? '#f59e0b22' : '#ffffff11'
              }]}>
                <Text style={[styles.priorityText, { 
                  color: item.priority === 'urgent' ? '#ef4444' : 
                         item.priority === 'high' ? '#f59e0b' : Colors.slate500
                }]}>
                  {item.priority?.toUpperCase() || 'NORMAL'}
                </Text>
              </View>
            </TouchableOpacity>
          </GlassCard>
        )}
        ListEmptyComponent={!loading ? (
          <Text style={styles.emptyText}>No tasks assigned.</Text>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 12,
    color: Colors.slate500,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 12,
    letterSpacing: 1,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  taskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 13,
    color: '#fff',
    marginBottom: 4,
  },
  taskTitleDone: {
    color: Colors.slate500,
    textDecorationLine: 'line-through',
  },
  clientLabel: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: '#3b82f6',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  priorityText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    color: Colors.slate500,
    textAlign: 'center',
    marginTop: 40,
  }
});
