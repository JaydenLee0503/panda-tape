# Panda Tape — backend setup (Supabase + Vercel)

The site is a static Vite build hosted on **Vercel**. All backend lives in
**Supabase**:

| Service              | What it does                                              | Where |
|----------------------|----------------------------------------------------------|-------|
| `places` Edge Function | Proxies the Foursquare Places API for the drop-off map (hides the key, fixes CORS) | `supabase/functions/places/index.ts` |
| `reservations` table  | Stores emails from the "Reserve your Roll" form          | `supabase/migrations/0001_reservations.sql` |

You don't need to install the Supabase CLI globally — run it with `npx`.

---

## 1. Install frontend deps

```bash
npm install
```

This pulls in `@supabase/supabase-js` (already in `package.json`).

## 2. Create a Supabase project

Make one at https://supabase.com. Then grab, from **Settings → API**:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 3. Link the CLI to your project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

(`<your-project-ref>` is the subdomain in your project URL, e.g. `abcd1234xyz`.)

## 4. Push the database schema (reservations table)

```bash
npx supabase db push
```

## 5. Deploy the Foursquare proxy + set its secret

```bash
npx supabase secrets set FOURSQUARE_API_KEY=<your-foursquare-key>
npx supabase functions deploy places
```

The Foursquare key stays **server-side only** — it is never in `.env` or the
client bundle.

## 6. Local frontend env

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then:

```bash
npm run dev
```

Open the "See the plan" overlay → the map should load live Foursquare points via
the Edge Function. Submit the footer form → a row should appear in the
`reservations` table (Supabase dashboard → Table editor).

## 7. Vercel

In the Vercel project → **Settings → Environment Variables**, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(No Foursquare var here — it lives in Supabase.) Redeploy. Vercel auto-detects
Vite: build `npm run build`, output `dist`.

---

## Notes

- **Why nothing shows if it's misconfigured:** by design there is no fake sample
  data. If Supabase env is missing or the proxy fails, the map shows an honest
  "Couldn't load nearby Panda points" message.
- **Reservation privacy:** row-level security lets the anon key *insert* a
  reservation but never *read* the list. To view signups, use the Supabase
  dashboard or the service-role key from your own server — never the anon key.
- **Duplicate emails:** a second signup with the same email is treated as
  success (they're already on the list), not an error.
