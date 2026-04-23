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
| API | Supabase Edge Functions (Deno) |
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

---

## Public API

Album Ranker exposes a read-only REST API built on [Supabase Edge Functions](https://supabase.com/docs/guides/functions). It uses standard Bearer token auth and returns JSON.

**Base URL:** `https://xeiygyromiabfiroykba.supabase.co/functions/v1`

### Authentication

The API uses a two-step token flow:

**Step 1 — Exchange credentials for an access token**

```http
POST https://xeiygyromiabfiroykba.supabase.co/auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "yourpassword"
}
```

Copy the `access_token` from the response. Tokens expire after 1 hour.

**Step 2 — Call the API with the token**

```http
GET /functions/v1/top-albums
Authorization: Bearer <access_token>
```

---

### `GET /functions/v1/top-albums`

Returns a user's albums sorted by ELO rating, highest first.

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `10` | Number of albums to return (1–50) |
| `user_id` | UUID | *(authenticated user)* | View a specific user's list. Omit to get your own. |

#### Example request

```bash
curl -X GET \
  "https://xeiygyromiabfiroykba.supabase.co/functions/v1/top-albums?limit=5" \
  -H "Authorization: Bearer <your_access_token>"
```

#### Example response

```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "total_returned": 5,
  "limit": 5,
  "albums": [
    {
      "rank": 1,
      "id": "1440935467",
      "title": "Rumours",
      "artist": "Fleetwood Mac",
      "year": "1977",
      "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/.../600x600bb.jpg",
      "rating": 1247,
      "comparisons": 18,
      "placement_complete": true
    },
    {
      "rank": 2,
      "id": "1474915965",
      "title": "Purple Rain",
      "artist": "Prince",
      "year": "1984",
      "cover_url": "https://is1-ssl.mzstatic.com/image/thumb/.../600x600bb.jpg",
      "rating": 1198,
      "comparisons": 12,
      "placement_complete": true
    }
  ],
  "generated_at": "2026-04-22T17:00:00.000Z"
}
```

#### Response fields

| Field | Description |
|-------|-------------|
| `rank` | Position in the list (1 = highest rated) |
| `id` | Album ID (iTunes numeric ID or MusicBrainz UUID) |
| `rating` | ELO rating. Starts at 1000; higher means better ranked |
| `comparisons` | Total head-to-head matches completed for this album |
| `placement_complete` | `true` once the album has finished its initial 6 placement matches |

#### Error responses

| Status | Body | Meaning |
|--------|------|---------|
| `401` | `{ "error": "Missing or invalid Authorization header..." }` | No token, or token is expired |
| `405` | `{ "error": "Method not allowed. Use GET." }` | Wrong HTTP method |
| `500` | `{ "error": "Failed to fetch rankings.", "detail": "..." }` | Database error |

---

### Using with Postman

1. Create a new collection — **Album Ranker API**
2. Add a collection variable: `token` (leave value empty for now)
3. **Auth request** — Add a POST request:
   - URL: `https://xeiygyromiabfiroykba.supabase.co/auth/v1/token?grant_type=password`
   - Body (raw JSON): `{ "email": "you@example.com", "password": "yourpassword" }`
   - Tests tab: `pm.collectionVariables.set("token", pm.response.json().access_token);`
4. **Albums request** — Add a GET request:
   - URL: `https://xeiygyromiabfiroykba.supabase.co/functions/v1/top-albums?limit=10`
   - Authorization tab: Type = **Bearer Token**, Token = `{{token}}`
5. Run the auth request first — the token saves automatically, then fire the albums request.

---

### Implementation

The API is implemented as a Supabase Edge Function (Deno/TypeScript) at `supabase/functions/top-albums/index.ts`. It validates the JWT server-side, queries the `rankings` and `albums` tables with a join, and returns the result shaped as the response above. CORS headers are included so the endpoint is callable from browsers as well.
