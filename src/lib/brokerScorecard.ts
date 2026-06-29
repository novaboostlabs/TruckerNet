// Broker scorecard — crowdsourced broker intelligence.
//
// When a driver completes a load, we anonymously contribute pay-vs-market data
// for that broker (same Waze model as rate_reports). When a driver enters a
// broker name, we fetch the aggregated scorecard to surface it in Add Load /
// Check Load — telling them "this broker typically pays 8% below market."
//
// Broker identity: we prefer MC number (globally unique, permanent) and fall
// back to a normalized name slug so reports from different drivers still land
// in the same bucket even when spelled slightly differently.

import { supabase, isSupabaseConfigured } from './supabase';

const TABLE = 'broker_reports';
const MIN_REPORTS = 3;   // minimum before we show a scorecard (avoid 1-sample noise)

// ── Broker key normalization ──────────────────────────────────────────────────

export function brokerKey(name: string, mc: string): string | null {
  const trimMC   = mc.trim().replace(/\D/g, '');   // digits only
  const trimName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  if (trimMC.length >= 5)  return `mc:${trimMC}`;
  if (trimName.length >= 3) return `name:${trimName}`;
  return null;
}

// ── Scorecard types ───────────────────────────────────────────────────────────

export type BrokerGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface BrokerScorecard {
  brokerName:    string;
  brokerKey:     string;
  reportCount:   number;
  // Pay signal: average gross vs fair-market mid.
  // 1.05 = pays 5% above market, 0.92 = pays 8% below.
  avgPayVsMarket:  number | null;
  // Recommend rate: % of loads that were green/amber verdict (worth taking).
  recommendPct:  number | null;
  grade:         BrokerGrade;
  // Human-readable summary e.g. "+6% above market · 82% recommend"
  summary:       string;
}

function computeGrade(payVsMarket: number | null, recommendPct: number | null): BrokerGrade {
  // Weight: 60% pay, 40% recommend.
  let score = 0;
  let weights = 0;

  if (payVsMarket !== null) {
    // Map: 0.85 → 0, 1.0 → 50, 1.15 → 100
    const paySc = Math.min(100, Math.max(0, ((payVsMarket - 0.85) / 0.30) * 100));
    score += paySc * 0.6;
    weights += 0.6;
  }
  if (recommendPct !== null) {
    score += recommendPct * 0.4;
    weights += 0.4;
  }

  if (weights === 0) return 'C';
  const normalised = score / weights;
  if (normalised >= 80) return 'A';
  if (normalised >= 65) return 'B';
  if (normalised >= 50) return 'C';
  if (normalised >= 35) return 'D';
  return 'F';
}

function summarise(payVsMarket: number | null, recommendPct: number | null): string {
  const parts: string[] = [];
  if (payVsMarket !== null) {
    const pct = Math.round((payVsMarket - 1) * 100);
    parts.push(pct >= 0 ? `+${pct}% above market` : `${pct}% below market`);
  }
  if (recommendPct !== null) {
    parts.push(`${Math.round(recommendPct)}% recommend`);
  }
  return parts.join(' · ') || 'Insufficient data';
}

// ── Contribution ──────────────────────────────────────────────────────────────

export interface BrokerReportInput {
  brokerName:   string;
  brokerMC:     string;
  grossPay:     number;
  totalMiles:   number;
  // Pass the fair-market mid so we can compute pay_vs_market anonymously.
  fairMarketMin?: number | null;
  fairMarketMax?: number | null;
  verdict?:     string | null;
  equipmentType: string;
}

export async function contributeBrokerReport(input: BrokerReportInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const key = brokerKey(input.brokerName, input.brokerMC);
  if (!key) return;  // no usable identifier

  let payVsMarket: number | null = null;
  if (input.fairMarketMin != null && input.fairMarketMax != null &&
      input.fairMarketMin > 0 && input.fairMarketMax > 0) {
    const mid = (input.fairMarketMin + input.fairMarketMax) / 2;
    if (mid > 0) payVsMarket = Math.round((input.grossPay / mid) * 1000) / 1000;
  }

  const { error } = await supabase.from(TABLE).insert({
    broker_key:    key,
    broker_name:   input.brokerName.trim(),
    broker_mc:     input.brokerMC.trim(),
    gross_pay:     input.grossPay,
    total_miles:   Math.round(input.totalMiles),
    pay_vs_market: payVsMarket,
    verdict:       input.verdict ?? null,
    equipment_type: input.equipmentType,
  });
  if (error) console.warn('[brokerScorecard] contribute error:', error.message);
}

// ── Query ─────────────────────────────────────────────────────────────────────

/** Fetch the crowdsourced scorecard for a broker. Returns null when
 *  Supabase isn't configured, the broker can't be identified, or
 *  there aren't enough reports for a reliable signal. */
export async function getBrokerScorecard(
  brokerName: string,
  brokerMC:   string,
): Promise<BrokerScorecard | null> {
  if (!isSupabaseConfigured()) return null;

  const key = brokerKey(brokerName, brokerMC);
  if (!key) return null;

  try {
    // Aggregate over the last 365 days (stale data misleads more than helps).
    const { data, error } = await supabase
      .from(TABLE)
      .select('pay_vs_market, verdict, broker_name')
      .eq('broker_key', key)
      .gte('reported_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

    if (error || !data || data.length < MIN_REPORTS) return null;

    // Compute metrics.
    const withPaySignal = data.filter((r) => r.pay_vs_market != null);
    const avgPayVsMarket = withPaySignal.length > 0
      ? withPaySignal.reduce((s, r) => s + Number(r.pay_vs_market), 0) / withPaySignal.length
      : null;

    const withVerdict = data.filter((r) => r.verdict != null);
    const recommendPct = withVerdict.length > 0
      ? (withVerdict.filter((r) => r.verdict === 'green' || r.verdict === 'amber').length / withVerdict.length) * 100
      : null;

    const displayName = data.find((r) => r.broker_name)?.broker_name ?? brokerName;

    return {
      brokerName:    displayName,
      brokerKey:     key,
      reportCount:   data.length,
      avgPayVsMarket,
      recommendPct,
      grade:         computeGrade(avgPayVsMarket, recommendPct),
      summary:       summarise(avgPayVsMarket, recommendPct),
    };
  } catch {
    return null;
  }
}
