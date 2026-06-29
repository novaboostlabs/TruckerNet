import { supabase, isSupabaseConfigured } from './supabase';
import { getSetting, setSetting } from '../db/database';
import { setBaselineDryVan } from '../utils/marketRates';

// Refinement #3a — remotely-tunable fair-market baseline.
//
// The national baseline lives in the Supabase `market_config` row and is edited
// from the dashboard when the freight market swings (see migration
// 2026-06-27_market_config.sql). On launch we (1) immediately apply the last
// value we cached locally so the very first estimate uses our best-known number,
// then (2) fetch the latest in the background. Everything degrades gracefully:
// offline, unconfigured, or first-launch all fall back to the bundled default
// baked into the rate engine.

const CACHE_KEY = 'market_baseline_dry_van';

/**
 * Apply the locally-cached baseline (from a prior launch) to the rate engine.
 * Synchronous — safe to call right after initDatabase() so the first
 * fair-market calc already reflects the most recent value we have.
 */
export function loadCachedMarketConfig(): void {
  const cached = getSetting(CACHE_KEY);
  if (!cached) return;
  const v = parseFloat(cached);
  if (!Number.isNaN(v)) setBaselineDryVan(v);
}

/**
 * Fetch the latest baseline from Supabase, apply it to the rate engine (which
 * clamps to a sane envelope), and cache the applied value for next launch.
 * Fire-and-forget on app start; no-ops offline / when Supabase isn't configured.
 */
export async function refreshMarketConfig(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { data, error } = await supabase
      .from('market_config')
      .select('baseline_dry_van')
      .eq('id', 1)
      .single();
    if (error || !data) return;

    const v = Number(data.baseline_dry_van);
    if (Number.isNaN(v)) return;

    const applied = setBaselineDryVan(v); // returns the clamped value actually used
    setSetting(CACHE_KEY, String(applied));
  } catch {
    // Offline / transient failure — keep whatever value is already active.
  }
}
