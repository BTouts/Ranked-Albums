# Album Ranker — Technical Design Document

## Overview

Album Ranker is a personal music ranking app built as a single-page application. Users search for albums, then rank them through head-to-head comparisons powered by an ELO rating system. Rankings are stored per-user in a Postgres database (Supabase). Access is invite-only — accounts are created manually in the Supabase dashboard.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | React 19 + TypeScript | Mature ecosystem; concurrent features (automatic batching) help here |
| Build tool | Vite 7 | Sub-second HMR, native ESM, near-zero config |
| Styling | Tailwind CSS v4 | Utility-first; v4 uses a Vite plugin with no PostCSS config, CSS-native `@theme` tokens |
| Backend / DB | Supabase (Postgres) | Managed Postgres with a JS client, auth, storage, and row-level security out of the box |
| Auth | Supabase `signInWithPassword` | Email/password; no OAuth needed for a whitelist app |
| Album search | iTunes Search API | Popularity-ranked results, reliable CDN artwork, no API key, CORS-enabled |
| Fallback search | MusicBrainz API | Broader catalog (indie, international) for albums not in iTunes |
| Cover art fallback | Cover Art Archive | For MusicBrainz UUIDs that have no iTunes artwork |
| Testing | Vitest + Playwright | Vitest for unit tests on pure logic (ELO, matchmaking); Playwright for e2e |

---

## Architecture

### No State Management Library

All state lives in `App.tsx`. This was a deliberate choice: the app has one authenticated user, one active comparison at a time, and a flat list of albums. A library like Redux or Zustand would add boilerplate with no architectural benefit at this scale. The cost is that `App.tsx` is the orchestration hub and passes a lot of props — a trade-off accepted in exchange for simplicity.

### Module Boundaries

The codebase is divided into four layers:

- **`types/`** — pure TypeScript type definitions, no imports
- **`services/`** — all I/O (Supabase queries, API calls, ELO computation, matchmaking)
- **`utils/`** — stateless helpers (cover art cache, device detection)
- **`components/`** — React rendering, no direct DB calls

This means every service is independently testable without mounting a component.

### Routing

There is no router library. Page state is a TypeScript union type (`"rankings" | "search" | "friends" | "profile"`) held in `useState`. Navigation is just `setPage(...)`. This is intentional — the app has four pages and no deep-linking requirement. Adding React Router would create complexity without benefit.

---

## Database Schema

```
albums    (id, title, artist, year, cover_url)
rankings  (user_id, album_id, rating, comparisons, placement_matches)
profiles  (id, display_name, avatar_url, email)
friendships (id, requester_id, addressee_id, status)
```

**Key design decisions:**

- `albums` is a **shared global table** — album metadata is stored once, referenced by all users. If two users rank the same album, the `albums` row is shared and only one network request is needed to backfill cover art.
- `rankings` uses a **composite primary key** `(user_id, album_id)` so every upsert is idempotent — saving after every comparison never risks creating duplicate rows.
- `placement_matches` is persisted so users can close the browser mid-placement and resume. `previousOpponents` is intentionally **not** persisted — it resets on reload to keep the schema simple.

### Row-Level Security

All tables use Supabase RLS policies. Users can only read/write their own rankings and profile. Friends system uses a policy on `friendships` that allows reads where the user is the requester or addressee.

---

## ELO Rating System

The ELO algorithm is implemented in `services/elo.ts` as a pure function — given two ratings and an outcome, it returns the new ratings. No side effects.

### Formula

```
E_A = 1 / (1 + 10^((R_B - R_A) / 400))
new_R_A = R_A + K * (S_A - E_A)
```

`E_A` is the expected probability that A wins, based on the rating gap. `S_A` is the actual score (1 for win, 0 for loss, 0.5 for tie).

### Dynamic K-Factor

| Comparisons | K | Rationale |
|---|---|---|
| < 10 | 48 | High volatility — new albums need to find their level quickly |
| 10–29 | 32 | Stabilizing — still adjustable but not as jumpy |
| ≥ 30 | 16 | Stable — small corrections only |

This mirrors how real ELO systems handle provisional vs. established ratings (e.g., FIDE chess). Each album has its own K-factor based on its own comparison count, so a new album paired against a veteran causes a large swing for the new album but a small adjustment for the veteran.

### Placement Matches

New albums start at rating 1000 with `placementMatches: 6`. Each comparison decrements this counter. The album is "placed" when it hits 0. This provides a structured onboarding window where the high K-factor applies, then the album transitions to stable mode. Re-ranking ("Play Matches") resets to 5 matches and clears `previousOpponents`.

---

## Matchmaking

`services/matchmaking.ts` has two modes:

### Placement Matchmaking (`pickOpponent`)

For placing a new album: sort the ranked list by absolute ELO difference to the challenger, then return the closest opponent that hasn't been played this session. This converges quickly — you face opponents near your true skill level rather than random ones.

### Ranked Play (`pickRankedPlayPair`)

An open-ended mode for refining the whole list. Candidate pairs are generated within a ±4 rank window to keep matchups meaningful. Each pair is scored:

```
score = (1 - confidenceFactor) * 0.6 + eloCloseness * 0.4
```

- **Confidence deficit (60%)** — albums with fewer than 30 comparisons are prioritized. This surfaces under-ranked albums first.
- **ELO closeness (40%)** — evenly matched albums produce more informative comparisons.

A random pick from the top 5 scored pairs prevents the same matchup repeating back-to-back. Recently played pairs are tracked in a `useRef` Set and avoided when possible, falling back to the full pool if all candidates have been played.

---

## Album Search

### Primary: iTunes Search API

Two parallel requests are fired for every query — one general search and one scoped to `artistTerm`. Results are merged with deduplication; general results take priority since they're ranked by Apple's popularity algorithm.

**Why iTunes over MusicBrainz as primary?** MusicBrainz's relevance score is pure text matching with no popularity signal. A query for "Kendrick Lamar" returns all Kendrick Lamar albums with identical scores — no way to surface *GKMC* ahead of a mixtape. iTunes solves this natively.

Results are capped at 25 after merging. The iTunes `artworkUrl100` is rewritten to `artworkUrl600` (`100x100bb` → `600x600bb`) — the iTunes CDN supports this parameter and always returns high-quality artwork.

Albums with fewer than 5 tracks are filtered out to exclude singles and EPs.

### Fallback: MusicBrainz

A separate search button hits the MusicBrainz API for albums not in the iTunes catalog (indie, international, obscure). MusicBrainz returns UUIDs (not numeric IDs), which are used to look up artwork from Cover Art Archive.

### Search UX

A debounced `useEffect` (300ms) fires the search. An `AbortController` cancels the in-flight request when the query changes, preventing stale results from appearing out of order. Searches are only triggered for queries ≥ 2 characters.

---

## Cover Art Strategy

Three tiers:

1. **iTunes CDN** — primary source for iTunes-sourced albums. Reliable, fast, always 600×600.
2. **Cover Art Archive** — fallback for MusicBrainz UUIDs. Fetched with a `HEAD` request (follows redirects) to resolve the final `archive.org` URL, which is then stored in the `albums` table so all users benefit. Capped at 5 backfills per page load.
3. **localStorage cache** — `utils/coverArtCache.ts` records whether an album's cover art request succeeded or failed. A cached `false` skips the Cover Art Archive request entirely on future loads.

The `Comparison` component preloads both cover images before enabling interaction. If covers take more than 5 seconds, it enables buttons anyway to avoid a broken state.

---

## Friends System

Friendships are stored in a `friendships` table with `requester_id`, `addressee_id`, and `status` (`pending` | `accepted`).

**Automatic mutual acceptance:** when sending a friend request, the app first checks for an incoming pending request from the other user. If one exists, it calls `acceptFriendRequest` instead of inserting a new row. This prevents duplicate pending requests and handles the "we both added each other" race gracefully.

Friend search queries the `profiles` table by `display_name` or `email` using `ilike` (case-insensitive substring match).

The `profiles.email` field is populated on login via a silent `upsertProfile` call — this is what makes users discoverable by email without exposing auth internals.

---

## Authentication

Standard Supabase `signInWithPassword`. The app listens to `onAuthStateChange` to sync the `user` state, which handles token refresh transparently. The entire app renders behind a login gate — if `user` is null, only `LoginForm` is shown.

Whitelist enforcement is handled at the database layer: accounts are created manually in the Supabase dashboard, so there's no self-registration surface to lock down in the frontend.

---

## Performance Notes

- **Rankings are loaded once** on login and kept in memory. Comparisons update local state immediately and fire `saveRanking` to Supabase in the background — the UI is never blocked waiting for a DB write.
- **No re-renders from unrelated state** — each page component receives only the props it needs. There is no global context or subscription that would cause the entire tree to re-render on every comparison.
- **Cover art is lazy** — `AlbumTile` loads images via the browser's native lazy loading. Cover Art Archive fetches are background fire-and-forget, never in the critical path.
- **The `resolving` ref** in `App.tsx` guards against double-invocation from fast keyboard input — if the user holds down an arrow key, only the first keydown resolves the comparison.

---

## Key Trade-offs

| Decision | What was gained | What was given up |
|---|---|---|
| All state in `App.tsx` | Simplicity, easy to trace data flow | `App.tsx` is large; prop drilling to deep components |
| No router | Zero config, no URL management complexity | No deep-linking, no back-button support |
| Shared `albums` table | Cover art backfills benefit all users | Album metadata can't be user-specific |
| `previousOpponents` not persisted | Simpler schema, no migration needed | Resets on refresh; could re-show the same matchup |
| iTunes as primary search | Popularity-ranked, reliable art | Some albums (indie, international) not in iTunes catalog |
| Upsert-based writes | Idempotent — safe to retry | Can't detect if a write was a create vs. update |
