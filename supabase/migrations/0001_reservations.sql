-- Panda Tape — reservations (email waitlist for the first run).
-- Captured by the "Reserve your Roll" form in the footer.

create table if not exists public.reservations (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text,                          -- where the signup came from (e.g. 'footer')
  created_at timestamptz not null default now()
);

-- One reservation per email, case-insensitive.
create unique index if not exists reservations_email_key
  on public.reservations (lower(email));

-- Row-level security: the public anon key may ADD a reservation but can never
-- read the list back. Reading rows requires the service role (dashboard / your
-- own server), so visitors can't scrape everyone's email.
alter table public.reservations enable row level security;

drop policy if exists "anon can insert reservations" on public.reservations;
create policy "anon can insert reservations"
  on public.reservations
  for insert
  to anon
  with check (
    -- basic shape check; the real validation is client + app side
    email like '%_@_%._%'
  );
