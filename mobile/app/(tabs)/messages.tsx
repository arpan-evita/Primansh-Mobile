import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Check, CheckCheck } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';

export default function MessagesScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function setupChat() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Fetch initial messages
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      
      setMessages(data || []);
      setLoading(false);

      // Real-time subscription & Presence
      const channel = supabase.channel('room:intelligence');

      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        })
        .on('presence', { event: 'sync' }, () => {
          const newState = channel.presenceState();
          const typing = Object.values(newState)
            .flat()
            .filter((p: any) => p.is_typing && p.user_id !== user?.id)
            .map((p: any) => p.full_name || 'Someone');
          setTypingUsers(typing);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user?.id,
              is_typing: false,
              full_name: user?.user_metadata?.full_name || 'Operator'
            });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }

    setupChat();
  }, []);

  const handleTyping = (text: string) => {
    setInputText(text);

    if (!isTyping) {
      setIsTyping(true);
      updatePresence(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updatePresence(false);
    }, 3000);
  };

  const updatePresence = async (typing: boolean) => {
    const channel = supabase.channel('room:intelligence');
    await channel.track({
      user_id: user?.id,
      is_typing: typing,
      full_name: user?.user_metadata?.full_name || 'Operator'
    });
  };

  async function handleSend() {
    if (!inputText.trim() || !user) return;

    const newMessage = {
      content: inputText,
      sender_id: user.id,
    };

    setIsTyping(false);
    updatePresence(false);

    const { error } = await supabase.from('messages').insert([newMessage]);
    if (error) alert(error.message);
    setInputText('');
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
        <Text style={styles.headerTitle}>SECURE SIGNALS</Text>
        <Text style={styles.headerSubtitle}>// ENCRYPTED NODE-TO-NODE</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender_id === user?.id ? styles.myMessageContainer : styles.theirMessageContainer
          ]}>
            <View style={[
              styles.messageBubble, 
              item.sender_id === user?.id ? styles.myMessage : styles.theirMessage
            ]}>
              <Text style={styles.messageText}>{item.content}</Text>
              <View style={styles.messageFooter}>
                <Text style={styles.messageTime}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.sender_id === user?.id && (
                  <View style={styles.statusIcon}>
                    {item.is_read ? (
                      <CheckCheck size={10} color="#3b82f6" />
                    ) : (
                      <Check size={10} color="rgba(255, 255, 255, 0.5)" />
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {typingUsers.length > 0 && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} initializing response...
          </Text>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Initialize transmit..."
            placeholderTextColor="#475569"
            value={inputText}
            onChangeText={handleTyping}
            multiline
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(7, 11, 20, 0.8)',
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
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
    width: '100%',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 20,
  },
  myMessage: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statusIcon: {
    marginLeft: 2,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 10,
    color: '#475569',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#fff',
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
