/*
 * Panda Tape — `places` Edge Function.
 *
 * Proxies the Foursquare Places API so the browser never sees the key and never
 * hits Foursquare's CORS wall. The frontend calls this via
 * `supabase.functions.invoke('places', { body: { lat, lng } })`.
 *
 * The Foursquare key is read from the FOURSQUARE_API_KEY secret — set it with:
 *   npx supabase secrets set FOURSQUARE_API_KEY=xxxxxxxx
 * It is NEVER prefixed VITE_ and never reaches the client bundle.
 */

const FSQ_URL = 'https://places-api.foursquare.com/places/search'
const FSQ_VERSION = '2025-06-17'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { lat?: unknown; lng?: unknown; radius?: unknown; limit?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: 'lat and lng are required numbers' }, 400)
  }
  // Clamp caller-supplied values so this proxy can't be pushed to extremes.
  const radius = Math.min(Math.max(Number(body.radius) || 8000, 100), 100000)
  const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 50)

  const key = Deno.env.get('FOURSQUARE_API_KEY')
  if (!key) return json({ error: 'FOURSQUARE_API_KEY is not configured' }, 500)

  const params = new URLSearchParams({
    ll: `${lat},${lng}`,
    radius: String(radius),
    query: 'compost recycling gym',
    limit: String(limit),
    sort: 'DISTANCE',
    // `geocodes` is a v3-era field the current API rejects; lat/lng come from
    // the latitude/longitude fields instead.
    fields: 'fsq_place_id,name,latitude,longitude,location,categories',
  })

  try {
    const res = await fetch(`${FSQ_URL}?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        'X-Places-Api-Version': FSQ_VERSION,
      },
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('Foursquare error', res.status, detail)
      return json({ error: `Foursquare responded ${res.status}` }, 502)
    }
    const data = await res.json()
    return json({ results: data.results ?? [] })
  } catch (err) {
    console.error('places proxy failed', err)
    return json({ error: 'Upstream request failed' }, 502)
  }
})
