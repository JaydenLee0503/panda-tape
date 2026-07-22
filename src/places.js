/*
 * Panda Tape — drop-off point data.
 *
 * A "Panda point" is a compost bin / recycling drop-off / partner gym where a
 * used strip can return to soil. The live list comes from the Foursquare Places
 * API — but the browser never calls Foursquare directly (CORS blocks it, and the
 * key must stay secret). Instead we call our Supabase `places` Edge Function,
 * which holds the Foursquare key server-side and proxies the search.
 * See supabase/functions/places/index.ts.
 *
 * If Supabase isn't configured, or the proxy fails, we return NO points rather
 * than inventing fake ones — the map then shows an honest "couldn't load" state
 * instead of misleading sample data.
 */
import { supabase } from './supabase.js'

// Default view when we don't have the user's location (Brooklyn, NY).
export const DEFAULT_CENTER = { lat: 40.6782, lng: -73.9742, label: 'Brooklyn, NY' }

const R_EARTH_MI = 3958.8

/** Haversine distance in miles between two lat/lng points. */
export function distanceMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH_MI * Math.asin(Math.sqrt(s))
}

export function formatMiles(mi) {
  if (mi < 0.1) return '< 0.1 mi'
  return `${mi.toFixed(1)} mi`
}

/** Attach a `.distance` (miles) to each point, measured from `from`, and sort. */
function withDistance(points, from) {
  return points
    .map((p) => ({ ...p, distance: distanceMiles(from, p) }))
    .sort((a, b) => a.distance - b.distance)
}

function normalizeFsq(r) {
  const lat = r.latitude ?? r.geocodes?.main?.latitude
  const lng = r.longitude ?? r.geocodes?.main?.longitude
  return {
    id: r.fsq_place_id || r.fsq_id || `${lat},${lng}`,
    name: r.name,
    lat,
    lng,
    category: r.categories?.[0]?.name || 'Drop-off point',
    address: r.location?.formatted_address || r.location?.address || '',
  }
}

/**
 * Resolve nearby Panda points around `center`.
 * Returns { points, live } — `live: true` when data came back from the proxy.
 * Never throws: any failure returns an empty list (no fake sample data).
 */
export async function getPandaPoints(center) {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('places', {
        body: { lat: center.lat, lng: center.lng },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      const points = (data?.results || [])
        .map(normalizeFsq)
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      if (points.length) return { points: withDistance(points, center), live: true }
    } catch (err) {
      console.warn('[panda] places lookup failed (no sample fallback):', err.message)
    }
  }
  return { points: [], live: false }
}
