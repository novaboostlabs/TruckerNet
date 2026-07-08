import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearAllUserData } from '../db/database';
import { identify, reset } from '../lib/analytics';
import { recordAuthEvent } from '../lib/authDiagnostics';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        recordAuthEvent('INITIAL_SESSION_CHECK', !!session);
      })
      .catch((e) => {
        console.warn('[TruckerNet] getSession error:', e);
        // Session unreadable (SecureStore error, corrupted token, etc.) —
        // treat as signed out so the app can proceed to the sign-in screen.
        recordAuthEvent(`INITIAL_SESSION_ERROR: ${e instanceof Error ? e.message : String(e)}`, false);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      recordAuthEvent(event, !!session);
      if (session?.user) {
        identify(session.user.id, { email: session.user.email });
      } else if (event === 'SIGNED_OUT') {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    // Clear local data before ending the session so the next account on this
    // device starts with a clean slate — prevents cross-account data leaks.
    clearAllUserData();
    await supabase.auth.signOut();
  }

  // Permanently deletes the account + all cloud data via the `delete-account`
  // Edge Function (Apple guideline 5.1.1(v) requires real in-app deletion, not
  // "email us"). Only clears local data / signs out on CONFIRMED server-side
  // success — a failed call must never make the app claim the account is gone.
  async function deleteAccount() {
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) return { error: error.message ?? 'delete_failed' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'delete_failed' };
    }
    await signOut();
    return { error: null };
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
