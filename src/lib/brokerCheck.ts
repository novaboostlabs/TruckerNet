// Broker Check — FMCSA authority verification ("scam shield").
//
// Double-brokering fraud is an epidemic: fake or hijacked MC numbers, revoked
// authority, brand-new shells. FMCSA's QCMobile API is FREE (register a webKey
// at https://mobile.fmcsa.dot.gov/QCDevsite/) and answers the three biggest
// red flags from an MC number: does the authority exist, is it active, and is
// the entity out of service.
//
// Design rules:
//   - OBJECTIVE DATA ONLY (FMCSA facts). No crowdsourced opinions here —
//     that keeps us out of defamation territory.
//   - Degrade gracefully: no webKey configured → feature hidden entirely.
//   - "Not found" is itself a signal: a fake MC returns no record. We surface
//     that as a warning, never as a definitive "scam" verdict.
//   - Network/API errors are NOT warnings — show nothing rather than casting
//     false suspicion on a legitimate broker because a request timed out.

const WEBKEY = process.env.EXPO_PUBLIC_FMCSA_WEBKEY ?? '';
const BASE   = 'https://mobile.fmcsa.dot.gov/qc/services';

export function isBrokerCheckConfigured(): boolean {
  return WEBKEY.length > 0;
}

export type BrokerCheckVerdict =
  | 'verified'   // record found, allowed to operate, no OOS flag
  | 'caution'    // record found but authority inactive / not allowed / OOS
  | 'not_found'; // no FMCSA record for this MC — verify before booking

export interface BrokerCheckResult {
  verdict:    BrokerCheckVerdict;
  legalName:  string | null;
  dbaName:    string | null;
  dotNumber:  string | null;
  /** FMCSA statusCode ('A' active / 'I' inactive) when present. */
  statusCode: string | null;
  /** 'Y' | 'N' when present. */
  allowedToOperate: string | null;
  /** Out-of-service date when the entity is OOS. */
  oosDate:    string | null;
}

/** One FMCSA match from a name search — shown in the "is this your broker?" picker. */
export interface BrokerCandidate {
  dotNumber:        string;
  legalName:        string;
  dbaName:          string | null;
  city:             string | null;
  state:            string | null;
  // Authority fields, carried so we can show the verdict without a second call.
  statusCode:       string | null;
  allowedToOperate: string | null;
  oosDate:          string | null;
}

// Build a verdict from an FMCSA carrier record (shared by MC lookup + name search).
function verdictFromRecord(record: any): BrokerCheckResult {
  const statusCode       = record.statusCode ?? null;
  const allowedToOperate = record.allowedToOperate ?? null;
  const oosDate          = record.oosDate ?? null;
  const healthy = allowedToOperate !== 'N' && statusCode !== 'I' && !oosDate;
  return {
    verdict:   healthy ? 'verified' : 'caution',
    legalName: record.legalName ?? null,
    dbaName:   record.dbaName ?? null,
    dotNumber: record.dotNumber != null ? String(record.dotNumber) : null,
    statusCode,
    allowedToOperate,
    oosDate,
  };
}

/** Turn a picked candidate into the same verdict shape the MC lookup produces. */
export function candidateToResult(c: BrokerCandidate): BrokerCheckResult {
  return verdictFromRecord(c);
}

/**
 * Look up an MC (docket) number against FMCSA. Returns null when the feature
 * is unconfigured, the MC is malformed, or the request errored (never cast
 * suspicion on a network failure).
 */
export async function lookupBrokerAuthority(
  mcNumber: string,
  signal?: AbortSignal
): Promise<BrokerCheckResult | null> {
  if (!isBrokerCheckConfigured()) return null;

  // Accept "MC-123456", "mc 123456", "123456" — digits are the docket number.
  const digits = mcNumber.replace(/\D/g, '');
  if (digits.length < 4 || digits.length > 8) return null;

  try {
    const res = await fetch(
      `${BASE}/carriers/docket-number/${digits}?webKey=${encodeURIComponent(WEBKEY)}`,
      { signal }
    );
    if (!res.ok) return null; // API error ≠ suspicious broker
    const data = await res.json();

    // QCMobile wraps results as { content: [ { carrier: {...} } ] }.
    const record = Array.isArray(data?.content) ? data.content[0]?.carrier : null;

    if (!record) {
      return {
        verdict: 'not_found',
        legalName: null, dbaName: null, dotNumber: null,
        statusCode: null, allowedToOperate: null, oosDate: null,
      };
    }

    return verdictFromRecord(record);
  } catch {
    return null; // offline / timeout — show nothing
  }
}

/**
 * Search FMCSA by broker/carrier NAME. Returns up to 8 candidates for the
 * driver to disambiguate — we never auto-pick a match, because a wrong "verified"
 * is worse than no answer. Fail-safe: returns [] on any error / no config.
 */
export async function searchBrokersByName(
  name: string,
  signal?: AbortSignal
): Promise<BrokerCandidate[]> {
  if (!isBrokerCheckConfigured()) return [];
  const q = name.trim();
  if (q.length < 3) return [];

  try {
    const res = await fetch(
      `${BASE}/carriers/name/${encodeURIComponent(q)}?webKey=${encodeURIComponent(WEBKEY)}`,
      { signal }
    );
    if (!res.ok) return [];
    const data = await res.json();

    const list = Array.isArray(data?.content) ? data.content : [];
    return list
      .map((item: any) => item?.carrier ?? item)
      .filter((c: any) => c && c.dotNumber != null)
      .slice(0, 8)
      .map((c: any): BrokerCandidate => ({
        dotNumber:        String(c.dotNumber),
        legalName:        c.legalName ?? c.dbaName ?? '',
        dbaName:          c.dbaName ?? null,
        city:             c.phyCity ?? null,
        state:            c.phyState ?? null,
        statusCode:       c.statusCode ?? null,
        allowedToOperate: c.allowedToOperate ?? null,
        oosDate:          c.oosDate ?? null,
      }))
      .filter((c: BrokerCandidate) => c.legalName.length > 0);
  } catch {
    return [];
  }
}

/**
 * Best-effort: fetch the MC/docket number for a DOT number, so picking a broker
 * by name can auto-fill the MC field (and the saved load keeps a real MC).
 * Returns null on any error — the verdict already stands without it.
 */
export async function getMcForDot(
  dotNumber: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (!isBrokerCheckConfigured() || !dotNumber) return null;
  try {
    const res = await fetch(
      `${BASE}/carriers/${encodeURIComponent(dotNumber)}/docket-numbers?webKey=${encodeURIComponent(WEBKEY)}`,
      { signal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data?.content) ? data.content : [];
    const num  = list[0]?.docketNumber ?? list[0]?.docket_number ?? null;
    return num != null ? String(num) : null;
  } catch {
    return null;
  }
}
