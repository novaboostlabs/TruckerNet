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
 * Forward-geocode a single full address to its best match (with coordinates).
 * Used to turn OCR'd BOL addresses into routable points. Non-autocomplete,
 * top result only. Returns null if unconfigured or nothing matched.
 */
export async function geocodeAddress(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion | null> {
  const q = query.trim();
  if (!isMapboxConfigured() || q.length < 3) return null;

  const params = new URLSearchParams({
    q,
    autocomplete: 'false',
    country: 'us',
    limit: '1',
    types: 'address,street,place,postcode,locality,neighborhood',
    access_token: TOKEN,
  });

  try {
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates ?? [];
    if (!f || coords[0] == null || coords[1] == null) return null;
    return {
      id:    f.id ?? f.properties?.mapbox_id ?? String(f.properties?.full_address),
      label: f.properties?.full_address ?? f.properties?.name ?? q,
      lng:   coords[0],
      lat:   coords[1],
    };
  } catch {
    return null;
  }
}

export interface RouteData {
  miles:    number;
  /** GeoJSON coordinate pairs [lng, lat] along the driving route. */
  geometry: [number, number][];
}

// In-memory cache keyed by rounded endpoint coordinates. Stores full route
// data (miles + geometry) so the state-mileage split can reuse the same
// response without a second Mapbox billing.
const routeCache = new Map<string, RouteData>();

function routeKey(from: AddressSuggestion, to: AddressSuggestion): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(from.lng)},${r(from.lat)}->${r(to.lng)},${r(to.lat)}`;
}

/**
 * Driving route between two geocoded points — returns miles AND the full
 * GeoJSON geometry for per-state mileage splitting. Results are cached per
 * lane so the same trip is only billed once per app session.
 */
export async function getRouteData(
  from: AddressSuggestion,
  to: AddressSuggestion,
  signal?: AbortSignal
): Promise<RouteData> {
  if (!isMapboxConfigured()) throw new Error('Mapbox token missing');

  const key = routeKey(from, to);
  const cached = routeCache.get(key);
  if (cached != null) return cached;

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({
    overview:   'full',
    geometries: 'geojson',
    access_token: TOKEN,
  });

  const res = await fetch(`${DIRECTIONS_URL}/${coords}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error('No route found');

  const miles    = route.distance / METERS_PER_MILE;
  const geometry = (route.geometry?.coordinates ?? []) as [number, number][];

  const result: RouteData = { miles, geometry };
  routeCache.set(key, result);
  return result;
}

/** Convenience wrapper — returns just the driving distance in miles. */
export async function getRouteMiles(
  from: AddressSuggestion,
  to: AddressSuggestion,
  signal?: AbortSignal
): Promise<number> {
  return (await getRouteData(from, to, signal)).miles;
}
