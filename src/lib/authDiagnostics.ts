// A small rotating log of what Supabase's auth client actually reported,
// surfaced in Settings. Exists to answer one question precisely instead of
// guessing: when a driver gets bounced to Sign In, did Supabase itself decide
// the session ended (a real SIGNED_OUT / failed refresh), or does a session
// still exist and something in our own routing sent them there anyway?
import { getSetting, setSetting } from '../db/database';

const LOG_KEY = 'auth_event_log';
const MAX_ENTRIES = 8;

interface AuthLogEntry {
  event:      string;
  hasSession: boolean;
  at:         string;
}

export function recordAuthEvent(event: string, hasSession: boolean): void {
  try {
    const raw = getSetting(LOG_KEY);
    const log: AuthLogEntry[] = raw ? JSON.parse(raw) : [];
    log.push({ event, hasSession, at: new Date().toISOString() });
    setSetting(LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
  } catch { /* diagnostic logging must never throw into the auth flow */ }
}

/** Newest-first, human-readable lines for display in an Alert. */
export function getAuthEventLogText(): string | null {
  try {
    const raw = getSetting(LOG_KEY);
    if (!raw) return null;
    const log: AuthLogEntry[] = JSON.parse(raw);
    if (!log.length) return null;
    return [...log].reverse()
      .map(e => `${new Date(e.at).toLocaleString()} — ${e.event} (session: ${e.hasSession ? 'yes' : 'no'})`)
      .join('\n');
  } catch {
    return null;
  }
}
