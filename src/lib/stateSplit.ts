/**
 * Splits a Mapbox driving-route geometry into per-state mileage for IFTA.
 *
 * Algorithm: for each consecutive pair of route coordinates, find the midpoint
 * and test which US state polygon contains it, then accumulate the great-circle
 * distance of that segment. Bounding-box pre-filtering keeps this fast even
 * for long routes with hundreds of coordinate pairs.
 */

import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, BBox } from 'geojson';
import * as topojson from 'topojson-client';
// @ts-ignore — us-atlas ships JSON, no TS types
import statesData from 'us-atlas/states-10m.json';

// Full state name → 2-letter abbreviation
const NAME_TO_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
};

interface StateEntry {
  feature: Feature<Polygon | MultiPolygon>;
  abbr:    string;
  bbox:    BBox; // [minLng, minLat, maxLng, maxLat]
}

// Convert TopoJSON → GeoJSON once at module load (synchronous, ~10ms).
let _stateIndex: StateEntry[] = [];
let _indexed = false;

function getStateIndex(): StateEntry[] {
  if (_indexed) return _stateIndex;
  _indexed = true;

  const collection = topojson.feature(
    statesData as any,
    (statesData as any).objects.states
  ) as unknown as FeatureCollection<Polygon | MultiPolygon>;

  _stateIndex = collection.features
    .map((f: Feature<Polygon | MultiPolygon>) => ({
      feature: f,
      abbr:    NAME_TO_ABBR[(f.properties as any)?.name as string] ?? '',
      bbox:    turf.bbox(f) as BBox,
    }))
    .filter((s: StateEntry) => s.abbr !== ''); // exclude territories

  return _stateIndex;
}

function pointInBBox(lng: number, lat: number, bbox: BBox): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function findStateForPoint(lng: number, lat: number, index: StateEntry[]): string | null {
  const pt = turf.point([lng, lat]);
  for (const entry of index) {
    if (!pointInBBox(lng, lat, entry.bbox)) continue;
    if (turf.booleanPointInPolygon(pt, entry.feature)) return entry.abbr;
  }
  return null;
}

export interface StateMileage {
  state: string;
  miles: number;
}

/**
 * Given a Mapbox route geometry (array of [lng, lat] coordinates), returns
 * the driving miles accumulated per US state, sorted by miles descending.
 * Segments whose midpoint falls outside all state polygons (e.g., offshore
 * tunnel approach) are silently skipped — they're a rounding error.
 */
export function splitRouteByState(coords: [number, number][]): StateMileage[] {
  if (coords.length < 2) return [];

  const index = getStateIndex();
  const acc: Record<string, number> = {};

  // Cache the last found state for the fast-path: consecutive segments are
  // almost always in the same state, so try it first before scanning all 50.
  let prevAbbr: string | null = null;
  let prevEntry: StateEntry | null = null;

  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];

    // Midpoint of the segment
    const midLng = (lng1 + lng2) / 2;
    const midLat = (lat1 + lat2) / 2;

    // Fast path: try previous state first
    let abbr: string | null = null;
    if (prevEntry && pointInBBox(midLng, midLat, prevEntry.bbox)) {
      const pt = turf.point([midLng, midLat]);
      if (turf.booleanPointInPolygon(pt, prevEntry.feature)) {
        abbr = prevAbbr;
      }
    }

    // Full scan if fast path missed
    if (!abbr) {
      abbr = findStateForPoint(midLng, midLat, index);
      if (abbr) {
        prevAbbr  = abbr;
        prevEntry = index.find(e => e.abbr === abbr) ?? null;
      }
    }

    if (abbr) {
      const segMiles = turf.distance([lng1, lat1], [lng2, lat2], { units: 'miles' });
      acc[abbr] = (acc[abbr] ?? 0) + segMiles;
    }
  }

  return Object.entries(acc)
    .map(([state, miles]) => ({ state, miles: Math.round(miles * 10) / 10 }))
    .sort((a, b) => b.miles - a.miles);
}
