import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Image, TextInput, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Edit2, Globe, Eye, Plus, Search } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';

export default function ArticlesScreen() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  async function fetchArticles() {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error) {
      setArticles(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetchArticles();
  }, []);

  const filteredArticles = articles.filter(a => 
    !filter || 
    a.title.toLowerCase().includes(filter.toLowerCase()) || 
    a.category?.toLowerCase().includes(filter.toLowerCase())
  );

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
        <Text style={styles.headerTitle}>ARTICLE MASTER</Text>
        <Text style={styles.headerSubtitle}>// CONTENT NODE MANAGEMENT</Text>
      </View>

      <FlatList
        data={filteredArticles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchArticles(); }} tintColor="#3b82f6" />}
        ListHeaderComponent={
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Search size={16} color="#64748b" />
              <TextInput 
                style={styles.searchInput}
                placeholder="Search index..."
                placeholderTextColor="#475569"
                value={filter}
                onChangeText={setFilter}
              />
            </View>
            <TouchableOpacity style={styles.addButton}>
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.articleCard} intensity={25}>
            <View style={styles.cardHeader}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category || 'GENERAL'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: item.published ? 'rgba(16, 185, 129, 0.1)' : 'rgba(71, 85, 105, 0.2)' }]}>
                <Text style={[styles.statusText, { color: item.published ? '#10b981' : '#64748b' }]}>
                  {item.published ? 'LIVE' : 'DRAFT'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.articleExcerpt} numberOfLines={2}>
              {item.excerpt || "No summary provided for this intelligence module."}
            </Text>

            <View style={styles.cardFooter}>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Edit2 size={16} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Eye size={16} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Globe size={16} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.articleId}>ID: {item.id.substring(0, 8)}</Text>
            </View>
          </GlassCard>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText size={48} color="#1e293b" />
            <Text style={styles.emptyText}>No articles found in index</Text>
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
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#3b82f6',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 22,
  },
  articleExcerpt: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  articleId: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
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
