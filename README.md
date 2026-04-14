# Ranked Albums

A personal music ranking app. Add albums, rank them through head-to-head comparisons, and watch your taste take shape over time.

Rankings are powered by an ELO rating system — the same algorithm used in chess. Each comparison updates both albums' ratings, so your list continuously refines itself the more you use it.

---

## Features

- **Head-to-head comparisons** — Pick between two albums. Ratings update after every match using ELO with a dynamic K-factor (new albums move faster than established ones).
- **Placement matches** — New albums play 6 matches to find their place. Already-ranked albums can be re-evaluated with 5 re-rank matches.
- **Album search** — Powered by the iTunes Search API for popularity-ranked results. An extended search fallback hits MusicBrainz for albums not in the iTunes catalog.
- **My Albums grid** — Your full ranked list with ELO, confidence %, and decade/year filters.
- **Open in streaming** — Jump to any album in Apple Music or Spotify directly from the hover overlay or mobile modal.
- **Mobile-first** — Tap modals on mobile, responsive grids, no iOS zoom on inputs, side-by-side comparison layout at all screen sizes.
- **Profile page** — Set a display name, change your password, and upload a profile picture.
- **Whitelist auth** — Accounts are created manually via Supabase. No public sign-up.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 (custom theme tokens) |
| Auth + DB | Supabase (Postgres + Row Level Security) |
| Album search | iTunes Search API + MusicBrainz fallback |
| Cover art | iTunes CDN (600×600), Cover Art Archive fallback |
| Hosting | Vercel |
| Tests | Vitest |

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/BTouts/Ranked-Albums.git
cd Ranked-Albums
npm install

# 2. Set environment variables
cp .env.example .env   # or create .env manually
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start dev server
npm run dev

# 4. Run tests
npm test
```

### Environment variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Supabase Setup

Run the following SQL in your Supabase project's SQL editor:

```sql
-- Albums (global metadata, shared across users)
create table albums (
  id text primary key,
  title text not null,
  artist text not null,
  year text,
  cover_url text
);

-- Rankings (per-user ELO data)
create table rankings (
  user_id uuid references auth.users(id) on delete cascade,
  album_id text references albums(id),
  rating integer not null default 1000,
  comparisons integer not null default 0,
  placement_matches integer not null default 0,
  primary key (user_id, album_id)
);

-- Profiles (display name, avatar)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Row Level Security
alter table rankings enable row level security;
alter table profiles enable row level security;

create policy "Users manage own rankings"
  on rankings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own profile"
  on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
```

For avatar uploads, create a **public** Storage bucket named `avatars` in the Supabase dashboard.

### Adding users (whitelist)

This app has no sign-up flow. Add users manually:

**Supabase Dashboard → Authentication → Users → Add user → Create new user**

---

## Deployment (Vercel)

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com) — framework preset auto-detects Vite
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy

Every push to `main` triggers an automatic redeploy. Pull requests get preview URLs.

After deploying, update your Supabase allowed URLs:

**Authentication → URL Configuration → Site URL** → set to your Vercel URL

---

## Project Structure

```
src/
  App.tsx                  — root state, routing, comparison logic
  index.css                — Tailwind theme tokens, page/modal animations
  types/Album.ts           — Album type
  services/
    supabaseClient.ts      — Supabase client
    musicbrainz.ts         — iTunes search + MusicBrainz fallback
    rankingsApi.ts         — fetch/save rankings
    profilesApi.ts         — profile CRUD + avatar upload
    elo.ts                 — ELO rating math
    matchmaking.ts         — opponent selection
    elo.test.ts            — ELO unit tests
    matchmaking.test.ts    — matchmaking unit tests
  utils/
    coverArtCache.ts       — localStorage cache for missing cover art
    useIsTouchDevice.ts    — touch device detection hook
  components/
    LoginForm.tsx          — email/password login
    SearchPage.tsx         — album search UI
    RankingPage.tsx        — My Albums grid with decade/year filters
    RankingList.tsx        — album grid renderer
    AlbumTile.tsx          — tile with hover overlay + mobile modal
    Comparison.tsx         — head-to-head comparison screen
    ProfilePage.tsx        — profile settings
```

---

## ELO & Placement System

- New albums start at **1000 ELO**, **6 placement matches**
- Already-ranked albums use **5 re-rank matches** when replayed
- Match count is capped to the number of available opponents
- Opponent selection: closest ELO rating, never a repeat from the current session
- K-factor: **48** (< 10 comparisons) → **32** (< 30) → **16** (≥ 30, stable)
- `previousOpponents` is session-only and resets on page reload
