import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Colors, Fonts } from '../../lib/theme';
import { MessageSquare, ArrowLeft, Send, Search } from 'lucide-react-native';

export default function MessagesScreen() {
  const [session, setSession] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<any>(null);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  // Fetch Conversations
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchConversations = async () => {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', session.user.id);
      
      const cids = participations?.map(p => p.conversation_id) || [];
      if (cids.length === 0) return;

      const { data: convs } = await supabase
        .from('conversations')
        .select('*, participants:conversation_participants(profile:profiles(*)), last_message:messages(*)')
        .in('id', cids)
        .order('updated_at', { ascending: false });

      if (convs) setConversations(convs);
    };

    fetchConversations();
  }, [session, activeConversationId]); // Refresh list when we exit chat

  // Fetch Messages for active conversation
  useEffect(() => {
    if (!activeConversationId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true }); // standard order, we scroll to bottom
      
      if (data) setMessages(data);
    };

    fetchMessages();

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  const handleSend = async () => {
    if (!input.trim() || !activeConversationId || !session?.user?.id) return;
    const msg = input.trim();
    setInput('');
    
    await supabase.from('messages').insert({
      conversation_id: activeConversationId,
      sender_id: session.user.id,
      content: msg,
      message_type: 'text',
      status: 'sent'
    });
    
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversationId);
  };

  if (activeConversationId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveConversationId(null)} style={styles.backButton}>
            <ArrowLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View>
            <Text style={styles.chatHeaderTitle}>{otherParticipant?.full_name || 'Chat'}</Text>
            <Text style={styles.chatHeaderSub}>Secure channel</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isOwn = item.sender_id === session?.user?.id;
            return (
              <View style={[styles.messageBubble, isOwn ? styles.messageOwn : styles.messageOther]}>
                <Text style={styles.messageText}>{item.content}</Text>
              </View>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              placeholder="Type a secure message..."
              placeholderTextColor={Colors.slate500}
              value={input}
              onChangeText={setInput}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Send color="#fff" size={18} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>Secure communication node</Text>
      </View>

      <FlatList 
        data={conversations}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const other = item.participants?.find((p: any) => p.profile?.id !== session?.user?.id)?.profile;
          const lastMsg = item.last_message?.[0]; // Supabase might return array if not handled strictly

          return (
            <TouchableOpacity 
              style={styles.convCard}
              onPress={() => {
                setOtherParticipant(other);
                setActiveConversationId(item.id);
              }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{other?.full_name?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <View style={styles.convInfo}>
                <Text style={styles.convName}>{other?.full_name || 'Member'}</Text>
                <Text style={styles.convPreview} numberOfLines={1}>
                  {lastMsg ? lastMsg.content : 'No messages yet'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No active conversations.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontFamily: Fonts.Outfit_700Bold, fontSize: 28, color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 12, color: Colors.slate500, marginTop: 4 },
  listContent: { padding: 20, paddingBottom: 100 },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    marginBottom: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(59, 130, 246, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontFamily: Fonts.Outfit_700Bold, fontSize: 18, color: '#3b82f6' },
  convInfo: { flex: 1 },
  convName: { fontFamily: Fonts.Outfit_700Bold, fontSize: 16, color: '#fff', marginBottom: 4 },
  convPreview: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 12, color: Colors.slate500 },
  emptyText: { fontFamily: Fonts.SpaceMono_400Regular, color: Colors.slate500, textAlign: 'center', marginTop: 40 },

  // Chat View
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 12 },
  chatHeaderTitle: { fontFamily: Fonts.Outfit_700Bold, fontSize: 18, color: '#fff' },
  chatHeaderSub: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 10, color: Colors.slate500 },
  chatScroll: { padding: 20, paddingBottom: 40 },
  messageBubble: { padding: 14, borderRadius: 20, maxWidth: '80%', marginBottom: 12 },
  messageOwn: { backgroundColor: '#3b82f6', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  messageOther: { backgroundColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  messageText: { fontFamily: Fonts.SpaceMono_400Regular, fontSize: 13, color: '#fff', lineHeight: 20 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: Colors.background },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontFamily: Fonts.SpaceMono_400Regular, fontSize: 13 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginLeft: 12 }
});
