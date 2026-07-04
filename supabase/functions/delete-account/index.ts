// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's account and all associated data —
// required for Apple App Store Guideline 5.1.1(v) (in-app account deletion;
// "email us to delete your account" is no longer accepted). Called from
// SettingsScreen in place of the bare sign-out that used to run here.
//
// Deploy: supabase functions deploy delete-account
// (Uses the SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY that
// every Edge Function gets automatically — no extra secrets to set.)
//
// Request body : (none — the caller is identified from the Authorization JWT)
// Response     : { ok: true } or { error: string }
//
// Deletes rows in child-before-parent order so this is correct regardless of
// whatever FK/cascade behavior the base schema (not in this repo) actually
// has — every step is redundant-safe if a cascade already exists. Storage
// (BOL photos) is cleaned up before the auth user is removed. The final
// admin.deleteUser call is the one step that MUST succeed for this to count
// as "deleted" — everything before it is best-effort so one renamed/missing
// table can't block the rest.
//
// NOT deleted (by design): `rate_reports` and `broker_reports` are fully
// anonymous crowdsourced tables with no user_id column — there is nothing in
// them to attribute back to this account.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE) {
    return json({ error: 'server_not_configured' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  // Identify the caller from their own JWT (validated against the auth server).
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) return json({ error: 'unauthorized' }, 401);
  const uid = user.id;

  // Admin client (service role) — bypasses RLS to delete across every table
  // and to remove the auth user itself.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Best-effort row deletes, child tables first. Logged, never thrown — a
  // single missing/renamed table must not stop account deletion.
  async function wipe(label: string, fn: () => Promise<{ error: unknown }>) {
    try {
      const { error } = await fn();
      if (error) console.error(`delete-account: ${label} failed`, error);
    } catch (e) {
      console.error(`delete-account: ${label} threw`, e);
    }
  }

  const { data: userLoads } = await admin.from('loads').select('id').eq('user_id', uid);
  const loadIds = (userLoads ?? []).map((l: { id: string }) => l.id);

  if (loadIds.length > 0) {
    await wipe('state_mileage', () => admin.from('state_mileage').delete().in('load_id', loadIds));
  }
  await wipe('load_expenses',    () => admin.from('load_expenses').delete().eq('user_id', uid));
  await wipe('loads',            () => admin.from('loads').delete().eq('user_id', uid));
  await wipe('fuel_entries',     () => admin.from('fuel_entries').delete().eq('user_id', uid));
  await wipe('user_expenses',    () => admin.from('user_expenses').delete().eq('id', uid));
  await wipe('general_expenses', () => admin.from('general_expenses').delete().eq('user_id', uid));
  await wipe('profiles',         () => admin.from('profiles').delete().eq('id', uid));

  // BOL photos live at bol-photos/{uid}/{uuid}.jpg — remove the whole prefix.
  try {
    const { data: files } = await admin.storage.from('bol-photos').list(uid);
    if (files && files.length > 0) {
      await admin.storage.from('bol-photos').remove(files.map((f) => `${uid}/${f.name}`));
    }
  } catch (e) {
    console.error('delete-account: bol-photos cleanup threw', e);
  }

  // The step that actually counts: remove the auth user (also invalidates
  // their sessions). If this fails, report an error — the app must not treat
  // the account as deleted or clear local data on a false success.
  console.log(`delete-account: deleting user ${uid} (${user.email ?? 'no email'})`);
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(uid);
  if (deleteUserErr) {
    console.error('delete-account: deleteUser failed', deleteUserErr);
    return json({ error: 'delete_failed' }, 500);
  }

  // Belt-and-suspenders: confirm the user is actually gone rather than trusting
  // a no-error response alone. If this still resolves the user, something is
  // wrong (e.g. a soft-delete/eventual-consistency surprise) and the client
  // must be told this did NOT succeed — a driver must never be told their
  // account is deleted while they can still sign back in with it.
  const { data: check } = await admin.auth.admin.getUserById(uid);
  if (check?.user) {
    console.error(`delete-account: user ${uid} still resolvable after deleteUser`);
    return json({ error: 'delete_incomplete' }, 500);
  }

  console.log(`delete-account: confirmed user ${uid} removed`);
  return json({ ok: true });
});
