// Mapbox-powered address autocomplete + route mileage.
//
// Pure REST (fetch) so it stays Expo Go compatible — no native modules.
// Needs a public Mapbox token (starts with `pk.`) in EXPO_PUBLIC_MAPBOX_TOKEN.
// If the token is missing, every call degrades gracefully (autocomplete returns
// nothing, routing throws) so manual entry still works.

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

const GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

const METERS_PER_MILE = 1609.344;

export interface AddressSuggestion {
  id: string;
  /** Full street-level address for display, e.g. "1247 Industrial Blvd, Dallas, TX 75207". */
  label: string;
  lng: number;
  lat: number;
}

export function isMapboxConfigured(): boolean {
  return TOKEN.startsWith('pk.');
}

/**
 * Type-ahead address search. Returns up to 5 US suggestions, house-number
 * level when available. Pass an AbortSignal to cancel in-flight requests when
 * the query changes.
 */
export async function searchAddress(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (!isMapboxConfigured() || q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    autocomplete: 'true',
    country: 'us',
    limit: '5',
    types: 'address,street,place,postcode,locality,neighborhood',
    access_token: TOKEN,
  });

  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();

  return (data.features ?? [])
    .map((f: any): AddressSuggestion => {
      const coords = f.geometry?.coordinates ?? [];
      return {
        id: f.id ?? f.properties?.mapbox_id ?? String(f.properties?.full_address),
        label: f.properties?.full_address ?? f.properties?.name ?? '',
        lng: coords[0],
        lat: coords[1],
      };
    })
    .filter((s: AddressSuggestion) => !!s.label && s.lng != null && s.lat != null);
}

/**
 * Driving distance in miles between two geocoded points. Uses the standard
 * driving profile (Mapbox truck routing is enterprise-only) — accurate enough
 * for a pay-per-mile estimate.
 */
export async function getRouteMiles(
  from: AddressSuggestion,
  to: AddressSuggestion,
  signal?: AbortSignal
): Promise<number> {
  if (!isMapboxConfigured()) throw new Error('Mapbox token missing');

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({
    overview: 'false',
    access_token: TOKEN,
  });

  const res = await fetch(`${DIRECTIONS_URL}/${coords}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();

  const meters = data.routes?.[0]?.distance;
  if (meters == null) throw new Error('No route found');
  return meters / METERS_PER_MILE;
}
