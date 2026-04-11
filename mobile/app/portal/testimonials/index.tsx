import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Colors, Fonts } from '../../../lib/theme';
import { useMobileSession } from '../../../context/MobileSessionContext';

export default function TestimonialsScreen() {
  const router = useRouter();
  const { profile } = useMobileSession();
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchTestimonials() {
    setLoading(true);
    let query = supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Non-admins only see approved testimonials
    if (profile?.normalizedRole !== 'admin') {
      query = query.eq('status', 'approved');
    }

    const { data } = await query;
    if (data) setTestimonials(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchTestimonials();

    const channel = supabase
      .channel('testimonial_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testimonials' }, () => {
        fetchTestimonials();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'pending') => {
    const { error } = await supabase.from('testimonials').update({ status }).eq('id', id);
    if (!error) {
      Alert.alert('Success', `Testimonial ${status === 'approved' ? 'approved' : 'moved to pending'}`);
      fetchTestimonials();
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Testimonial',
      'Are you sure you want to permanently remove this?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            await supabase.from('testimonials').delete().eq( 'id', id);
            fetchTestimonials();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social Proof</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTestimonials} tintColor={Colors.accent} />}
      >
        <Text style={styles.sectionTitle}>CLIENT TESTIMONIALS</Text>
        
        {testimonials.map((t) => (
          <GlassCard key={t.id} style={styles.card} intensity={15}>
            <View style={styles.cardHeader}>
              <View style={styles.clientInfo}>
                <Image 
                  source={{ uri: t.image_url || 'https://via.placeholder.com/100/1e293b/ffffff' }}
                  style={styles.clientImage}
                />
                <View>
                  <Text style={styles.clientName}>{t.name}</Text>
                  <Text style={styles.clientRole}>{t.role} {t.company_name ? `@ ${t.company_name}` : ''}</Text>
                </View>
              </View>
              <View style={styles.rating}>
                <Star size={12} color="#fbbf24" fill="#fbbf24" />
                <Text style={styles.ratingText}>{t.rating}</Text>
              </View>
            </View>
            
            <Text style={styles.content}>"{t.quote}"</Text>
            
            <View style={styles.footer}>
              <View style={[styles.statusBadge, { backgroundColor: t.status === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.1)' }]}>
                <Text style={[styles.statusText, { color: t.status === 'approved' ? '#10b981' : '#fbbf24' }]}>
                  {t.status.toUpperCase()}
                </Text>
              </View>
              
              {profile?.normalizedRole === 'admin' && (
                <View style={styles.adminActions}>
                   {t.status === 'pending' && (
                     <TouchableOpacity 
                      onPress={() => handleUpdateStatus(t.id, 'approved')}
                      style={styles.approveIcon}
                     >
                       <Star size={16} color="#10b981" />
                     </TouchableOpacity>
                   )}
                   {t.status === 'approved' && (
                     <TouchableOpacity 
                      onPress={() => handleUpdateStatus(t.id, 'pending')}
                      style={styles.actionIcon}
                     >
                       <ArrowLeft size={16} color={Colors.slate500} />
                     </TouchableOpacity>
                   )}
                   <TouchableOpacity onPress={() => handleDelete(t.id)} style={styles.deleteIcon}>
                     <Trash2 size={16} color="#ef4444" />
                   </TouchableOpacity>
                </View>
              )}
            </View>
          </GlassCard>
        ))}

        {testimonials.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No testimonials synchronizing with this channel.</Text>
          </View>
        )}
      </ScrollView>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 10,
    color: Colors.slate500,
    letterSpacing: 2,
    marginBottom: 16,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clientImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  clientName: {
    fontFamily: Fonts.Outfit_700Bold,
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  clientRole: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 9,
    color: Colors.slate500,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 12,
    color: '#fbbf24',
    marginLeft: 4,
  },
  content: {
    fontFamily: Fonts.SpaceMono_400Regular,
    fontSize: 13,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: Fonts.SpaceMono_700Bold,
    fontSize: 8,
    letterSpacing: 1,
  },
  adminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approveIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  actionIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  deleteIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.Outfit_400Regular,
    color: Colors.slate600,
    textAlign: 'center',
    fontSize: 14,
  }
});
