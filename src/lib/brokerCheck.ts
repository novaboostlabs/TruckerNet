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

    const statusCode       = record.statusCode ?? null;
    const allowedToOperate = record.allowedToOperate ?? null;
    const oosDate          = record.oosDate ?? null;

    const healthy =
      allowedToOperate !== 'N' &&
      statusCode !== 'I' &&
      !oosDate;

    return {
      verdict:   healthy ? 'verified' : 'caution',
      legalName: record.legalName ?? null,
      dbaName:   record.dbaName ?? null,
      dotNumber: record.dotNumber != null ? String(record.dotNumber) : null,
      statusCode,
      allowedToOperate,
      oosDate,
    };
  } catch {
    return null; // offline / timeout — show nothing
  }
}
