// Supabase Edge Function: ocr-bol
//
// Receives a base64 JPEG of a bill of lading (BOL) and uses the Anthropic API
// (Claude vision) to extract the fields the Add Load form needs. The Anthropic
// key lives ONLY here as a Supabase secret — it never ships in the app bundle.
//
// Deploy:   supabase functions deploy ocr-bol
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (shared with ocr-fuel-receipt)
//
// Request body : { image: "<base64 jpeg, no data: prefix>" }
// Response     : { pickupAddress, deliveryAddress, weightLbs, bolNumber, brokerName } (any may be null)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// Largest base64 image we'll forward to the paid vision API. The app downscales
// BOL photos well under this; the cap stops a malicious caller from running up
// Anthropic costs with huge payloads. ~8M chars ≈ ~6MB binary.
const MAX_IMAGE_CHARS = 8_000_000;

// Verify the caller is a REAL authenticated user — not just anyone holding the
// public anon key (which ships in the app binary). Without this, the paid
// Anthropic key behind this endpoint is open to abuse by anyone who decompiles
// the app. getUser() validates the JWT against the auth server.
async function isAuthedUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && !!user;
  } catch {
    return false;
  }
}
// BOLs are denser/more varied than a fuel receipt — Sonnet reads them more
// reliably (addresses, handwriting, multi-stop layouts) and the volume is low.
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT =
  `You extract structured data from a photo of a US freight Bill of Lading (BOL). ` +
  `Return ONLY a single JSON object, no prose, with these exact keys:\n` +
  `- "pickupAddress": the SHIPPER / ORIGIN / "Ship From" full address as one string ` +
  `(street, city, state, ZIP) or null\n` +
  `- "deliveryAddress": the CONSIGNEE / DESTINATION / "Ship To" full address as one ` +
  `string (street, city, state, ZIP) or null\n` +
  `- "weightLbs": total shipment weight in POUNDS (number, no units) or null\n` +
  `- "bolNumber": the BOL / shipment / pro number (string) or null\n` +
  `- "brokerName": the broker or carrier company name (string) or null\n` +
  `Rules: include city+state in each address whenever visible — they are needed to ` +
  `map the route. If weight is shown in another unit, convert to pounds. ` +
  `If a field is unreadable or absent, use null. Do not invent addresses.`;

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
  if (!ANTHROPIC_API_KEY) return json({ error: 'server_not_configured' }, 500);
  if (!(await isAuthedUser(req))) return json({ error: 'unauthorized' }, 401);

  let image: string | undefined;
  try {
    ({ image } = await req.json());
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!image || typeof image !== 'string') return json({ error: 'missing_image' }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ error: 'image_too_large' }, 413);

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        // Cache the static system prompt — identical on every scan, so repeated
        // calls read it from cache instead of re-billing input tokens.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
              { type: 'text', text: 'Extract the fields as JSON.' },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('Anthropic error', resp.status, detail);
      return json({ error: 'ocr_failed' }, 502);
    }

    const payload = await resp.json();
    const text: string = payload?.content?.[0]?.text ?? '';

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: 'parse_failed' }, 502);

    const parsed = JSON.parse(match[0]);
    return json({
      pickupAddress:   parsed.pickupAddress   ?? null,
      deliveryAddress: parsed.deliveryAddress ?? null,
      weightLbs:       parsed.weightLbs       ?? null,
      bolNumber:       parsed.bolNumber       ?? null,
      brokerName:      parsed.brokerName      ?? null,
    });
  } catch (e) {
    console.error('Function error', e);
    return json({ error: 'ocr_failed' }, 502);
  }
});
