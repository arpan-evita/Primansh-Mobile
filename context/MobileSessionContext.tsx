import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { unregisterMobilePushNotifications } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { normalizeRole } from '../lib/meetings';

export type MobileSessionRole =
  | 'admin'
  | 'team'
  | 'seo'
  | 'content'
  | 'developer'
  | 'client'
  | 'pending';

export type MobileSessionProfile = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url?: string | null;
  role: string;
  normalizedRole: MobileSessionRole;
  associated_client_id?: string | null;
  last_seen_at?: string | null;
};

type MobileSessionContextValue = {
  session: Session | null;
  profile: MobileSessionProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<MobileSessionProfile | null>;
  signOut: () => Promise<void>;
};

const MobileSessionContext = createContext<MobileSessionContextValue | undefined>(undefined);

function normalizeSessionRole(role?: string | null): MobileSessionRole {
  const normalized = normalizeRole(role || 'client');
  if (normalized === 'admin') return 'admin';
  if (normalized === 'team') return 'team';
  if (normalized === 'seo') return 'seo';
  if (normalized === 'content') return 'content';
  if (normalized === 'developer') return 'developer';
  if (normalized === 'pending') return 'pending';
  return 'client';
}

async function fetchProfileForUser(userId: string, fallbackEmail?: string | null) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, associated_client_id, last_seen_at')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    ...(data as any),
    email: fallbackEmail || null,
    normalizedRole: normalizeSessionRole((data as any)?.role),
  } as MobileSessionProfile;
}

export function MobileSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MobileSessionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: nextSession },
    } = await supabase.auth.getSession();

    setSession(nextSession);

    if (!nextSession?.user?.id) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchProfileForUser(nextSession.user.id, nextSession.user.email || null);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  const signOut = useCallback(async () => {
    const profileId = profile?.id || session?.user?.id || null;
    if (profileId) {
      await unregisterMobilePushNotifications(profileId).catch(() => undefined);
    }

    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, [profile?.id, session?.user?.id]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(initialSession);

        if (!initialSession?.user?.id) {
          setProfile(null);
          return;
        }

        const nextProfile = await fetchProfileForUser(
          initialSession.user.id,
          initialSession.user.email || null
        );

        if (!mounted) return;
        setProfile(nextProfile);
      } catch (error) {
        console.error('[MobileSession] bootstrap failed', error);
        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user?.id) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextProfile = await fetchProfileForUser(nextSession.user.id, nextSession.user.email || null);
        setProfile(nextProfile);
      } catch (error) {
        console.error('[MobileSession] auth change profile fetch failed', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<MobileSessionContextValue>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [loading, profile, refreshProfile, session, signOut]
  );

  return <MobileSessionContext.Provider value={value}>{children}</MobileSessionContext.Provider>;
}

export function useMobileSession() {
  const context = useContext(MobileSessionContext);
  if (!context) {
    throw new Error('useMobileSession must be used inside MobileSessionProvider');
  }

  return context;
}
