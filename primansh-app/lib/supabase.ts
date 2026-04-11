import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tpeskbbvrfebtjiituwi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwZXNrYmJ2cmZlYnRqaWl0dXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTA2ODEsImV4cCI6MjA4OTc2NjY4MX0.g8fKnnGYZzFBQUyW7BKNidnihXApZpDk4soElldRLz0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper for real-time subscriptions
export const subscribeToChannel = (channelName: string, event: string, callback: (payload: any) => void) => {
  return supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: channelName.split(':')[1] || channelName }, callback)
    .subscribe();
};

// Helper to get current profile
export const getUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  return profile;
};
