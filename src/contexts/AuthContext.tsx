import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearAllUserData } from '../db/database';
import { pushAll } from '../lib/sync';
import { identify, reset } from '../lib/analytics';
import { recordAuthEvent } from '../lib/authDiagnostics';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  /**
   * Backs up local data, then clears it and ends the session. If the backup
   * can't be confirmed (offline, slow, failed) it does NOT clear anything and
   * resolves `{ unsynced: true }` — the caller asks the driver, then calls
   * again with `discardUnsynced: true` to sign out anyway.
   */
  signOut: (opts?: { discardUnsynced?: boolean }) => Promise<{ unsynced: boolean }>;
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

  async function signOut(opts?: { discardUnsynced?: boolean }): Promise<{ unsynced: boolean }> {
    // Flush any unsynced local edits (income goal, tax rate, weekly miles,
    // expenses…) UP to the cloud before wiping local data. Settings edits save
    // locally and don't push on their own, so without this a change made since
    // the last sync is lost on sign-out — the "income goal didn't persist"
    // bug. Bounded: an offline/slow push must never hang sign-out.
    const uid = user?.id;
    if (uid && !opts?.discardUnsynced) {
      let backedUp = false;
      try {
        backedUp = await Promise.race([
          pushAll(uid).then((r) => !r.error),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4000)),
        ]);
      } catch { /* treated as not backed up */ }
      // Wiping now would permanently destroy whatever never reached the cloud
      // (a sign-out at a truck stop with no signal used to do exactly that).
      // Keep everything and let the driver decide. Leaving the data in place
      // is safe: it stays stamped with this account's data_owner_id, so
      // claimDataOwnership() wipes it if a DIFFERENT account signs in next.
      if (!backedUp) return { unsynced: true };
    }
    await endSession();
    return { unsynced: false };
  }

  // Clear local data before ending the session so the next account on this
  // device starts with a clean slate — prevents cross-account data leaks.
  async function endSession() {
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
    // The account and its cloud data are gone — nothing left to back up, and
    // pushing here (with a still-valid token) could try to re-upload it.
    await endSession();
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
