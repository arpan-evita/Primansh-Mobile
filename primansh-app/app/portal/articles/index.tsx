import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Colors, Fonts } from '../../../lib/theme';
import { Search, Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ArticleMasterScreen() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  async function fetchBlogs() {
    setLoading(true);
    const { data } = await supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setBlogs(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleDelete = async (id: string) => {
    // Basic confirmation skipped for brevity
    await supabase.from('blogs').delete().eq('id', id);
    fetchBlogs();
  };

  const filteredBlogs = blogs.filter(b => 
    b.title?.toLowerCase().includes(search.toLowerCase()) || 
    b.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Article Master</Text>
        <TouchableOpacity onPress={() => router.push('/portal/articles/editor')} style={styles.actionButton}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search color={Colors.slate500} size={18} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search articles, categories..."
            placeholderTextColor={Colors.slate500}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* FlatList */}
      <FlatList 
        data={filteredBlogs}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchBlogs} tintColor={Colors.accent} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <GlassCard style={styles.card} intensity={15}>
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: item.featured_image || 'https://via.placeholder.com/300x150/1e293b/ffffff?text=No+Image' }} 
                style={styles.image}
              />
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: Colors.accent }]}>
                  <Text style={styles.badgeText}>{item.category || 'GENERAL'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: item.published ? '#10b981' : Colors.slate500 }]}>
                  <Text style={styles.badgeText}>{item.published ? 'PUBLISHED' : 'DRAFT'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt || 'No summary provided.'}</Text>
              
              <View style={styles.footer}>
                <View style={styles.actions}>
                  {/* We could pass ID to webview but for now just pass URL directly if possible, or ID */}
                  <TouchableOpacity onPress={() => router.push(`/portal/articles/editor?id=${item.id}`)} style={styles.actionIcon}>
                    <Edit2 size={16} color={Colors.slate500} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionIcon}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.idText}>ID: {item.id?.substring(0, 8)}</Text>
              </View>
            </View>
          </GlassCard>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: Fonts.SpaceMono_400Regular,
    color: '#fff',
    fontSize: 12,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 0, 
  },
  imageContainer: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badges: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 9,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoContainer: {
    padding: 20,
  },
  title: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
  },
  excerpt: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 12,
    color: Colors.slate500,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  idText: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 10,
    color: Colors.slate500,
  }
});
