// Supabase Edge Function: ocr-fuel-receipt
//
// Receives a base64 JPEG of a fuel receipt and uses the Anthropic API (Claude
// vision) to extract the fields the Fuel Entry form needs. The Anthropic key
// lives ONLY here as a Supabase secret — it never ships in the app bundle.
//
// Deploy:   supabase functions deploy ocr-fuel-receipt
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request body : { image: "<base64 jpeg, no data: prefix>" }
// Response     : { dollars, gallons, pricePerGallon, state, date }  (any may be null)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// Haiku is fast + cheap and more than accurate enough for a printed receipt.
const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT =
  `You extract structured data from a photo of a US fuel/diesel receipt. ` +
  `Return ONLY a single JSON object, no prose, with these exact keys:\n` +
  `- "dollars": total amount paid for fuel (number) or null\n` +
  `- "gallons": gallons pumped (number) or null\n` +
  `- "pricePerGallon": price per gallon (number) or null\n` +
  `- "state": 2-letter US state code where purchased (string) or null\n` +
  `- "date": purchase date as YYYY-MM-DD (string) or null\n` +
  `Rules: numbers only (no $ or units). If a value is unreadable or absent, use null. ` +
  `Prefer the FUEL subtotal over any grand total that includes store items. ` +
  `Derive state from the station address if printed. Do not guess wildly.`;

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

  let image: string | undefined;
  try {
    ({ image } = await req.json());
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!image || typeof image !== 'string') return json({ error: 'missing_image' }, 400);

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
        max_tokens: 300,
        // Cache the static system prompt — it's identical on every scan, so
        // repeated calls read it from cache instead of re-billing input tokens.
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

    // Be tolerant: extract the first {...} block in case the model adds stray text.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: 'parse_failed' }, 502);

    const parsed = JSON.parse(match[0]);
    return json({
      dollars:        parsed.dollars ?? null,
      gallons:        parsed.gallons ?? null,
      pricePerGallon: parsed.pricePerGallon ?? null,
      state:          parsed.state ?? null,
      date:           parsed.date ?? null,
    });
  } catch (e) {
    console.error('Function error', e);
    return json({ error: 'ocr_failed' }, 502);
  }
});
