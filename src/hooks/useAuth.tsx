import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { registerPushNotifications, unregisterPushNotifications } from "./usePushNotifications";

interface Profile {
  id: string;
  role: 'admin' | 'team' | 'client' | 'seo' | 'content' | 'developer' | 'pending';
  full_name: string | null;
  associated_client_id?: string | null;
  avatar_url?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  signUp: (email: string, pass: string, fullName: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeRole = (role: string): Profile['role'] => {
  if (!role) return 'client';
  const r = role.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (r.includes('admin') || r.includes('manager')) return 'admin';
  if (r.includes('seo')) return 'seo';
  if (r.includes('content')) return 'content';
  if (r.includes('dev')) return 'developer';
  if (r.includes('team')) return 'team';
  if (r.includes('client')) return 'client';
  if (r.includes('pending')) return 'pending';
  return 'pending';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // First try fetching with the new associated_client_id field
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, associated_client_id, avatar_url')
        .eq('id', userId)
        .single();
      
      if (error) {
        // If it's a "column does not exist" error (PGRST204 or similar), retry without it
        console.warn("Attempting profile fetch without associated_client_id (migration pending?):", error.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, role, full_name, avatar_url')
          .eq('id', userId)
          .single();
        
        if (fallbackError) throw fallbackError;
        setProfile({
          ...fallbackData,
          role: normalizeRole(fallbackData.role)
        } as Profile);
      } else {
        setProfile({
          ...data,
          role: normalizeRole(data.role)
        } as Profile);
      }
    } catch (error) {
      console.error("Critical error fetching profile:", error);
    } finally {
      setLoading(false);
    }

    // Register push notifications after profile is loaded (non-blocking)
    setTimeout(() => registerPushNotifications(userId), 2000);
  };

  const signIn = async (email: string, pass: string) => {
    return await supabase.auth.signInWithPassword({ email, password: pass });
  };

  const signUp = async (email: string, pass: string, fullName: string) => {
    const res = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
    return res;
  };

  const signOut = async () => {
    // Unregister push subscription before signing out
    if (user?.id) {
      await unregisterPushNotifications(user.id).catch(() => {});
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
