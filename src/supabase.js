/*
 * Panda Tape — Supabase client (browser).
 *
 * Backend services live in Supabase:
 *   • `places` Edge Function — proxies the Foursquare Places API server-side so
 *     the drop-off map works from the browser (no CORS) and the Foursquare key
 *     never ships to the client. See supabase/functions/places/index.ts.
 *   • `reservations` table — stores emails from the "Reserve your Roll" form.
 *
 * Both keys below are PUBLIC client keys (Settings > API in the Supabase
 * dashboard) and are safe to expose. The anon key only grants what row-level
 * security allows. If the env vars are missing (e.g. a bare local checkout),
 * `supabase` is null and callers degrade gracefully instead of crashing.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : null

if (!supabase) {
  console.warn(
    '[panda] Supabase not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing) — ' +
      'the drop-off map and reservations are disabled.'
  )
}
