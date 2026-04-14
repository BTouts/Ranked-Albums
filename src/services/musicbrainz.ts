/**
 * Album search via iTunes Search API.
 *
 * Why iTunes instead of MusicBrainz:
 *   - iTunes results are ranked by Apple's popularity algorithm — exactly what
 *     "show the most relevant album first" means to a user.
 *   - MusicBrainz score is a pure text-match signal with no popularity weighting,
 *     so all Kendrick Lamar albums score identically for the query "Kendrick Lamar".
 *   - iTunes also returns reliable CDN artwork URLs, eliminating Cover Art Archive
 *     misses.
 *
 * Strategy: two parallel requests — one general (good for album title searches like
 * "good kid maad city") and one artist-scoped (good for artist name searches like
 * "kendrick lamar"). Results are merged, deduplicated by collectionId, and returned
 * in order — general results first since they're the most directly relevant.
 */

import type { Album } from "../types/Album"

type ItunesResult = {
  wrapperType: string
  collectionType: string
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100?: string
  releaseDate?: string
  trackCount?: number
}

async function itunesFetch(term: string, attribute?: string, signal?: AbortSignal): Promise<ItunesResult[]> {
  const params = new URLSearchParams({ term, entity: "album", limit: "50" })
  if (attribute) params.set("attribute", attribute)

  const res = await fetch(`https://itunes.apple.com/search?${params}`, { signal })
  const data = await res.json()

  return (data.results ?? []).filter(
    (r: ItunesResult) =>
      r.wrapperType === "collection" &&
      r.collectionType === "Album" &&
      (r.trackCount ?? 0) >= 5   // exclude singles and EPs
  )
}

function toAlbum(item: ItunesResult): Album {
  // Replace 100x100 thumbnail with 600x600 for display quality
  const coverUrl = item.artworkUrl100?.replace("100x100bb", "600x600bb")

  return {
    id: String(item.collectionId),
    title: item.collectionName,
    artist: item.artistName,
    year: item.releaseDate?.slice(0, 4),
    coverUrl,
    rating: 0,
    comparisons: 0,
    placementMatches: 0,
    previousOpponents: [],
  }
}

export async function searchAlbums(query: string, signal?: AbortSignal): Promise<Album[]> {
  try {
    // Run both searches in parallel:
    //   general  — best for album title queries ("good kid maad city", "abbey road")
    //   byArtist — best for artist name queries ("kendrick lamar", "radiohead")
    const [general, byArtist] = await Promise.all([
      itunesFetch(query, undefined, signal),
      itunesFetch(query, "artistTerm", signal),
    ])

    // Merge: general results take priority (already ranked by relevance).
    // Artist results fill in anything not already present.
    const seen = new Set<number>()
    const merged: ItunesResult[] = []

    for (const item of [...general, ...byArtist]) {
      if (!seen.has(item.collectionId)) {
        seen.add(item.collectionId)
        merged.push(item)
      }
    }

    return merged.slice(0, 25).map(toAlbum)
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return []
    console.error("iTunes search failed:", err)
    return []
  }
}

/**
 * Fallback search via MusicBrainz for albums not in the iTunes catalog.
 * MusicBrainz has a much broader database (indie, underground, international)
 * but no popularity signal and no reliable artwork. Cover art falls back to
 * Cover Art Archive using the MusicBrainz release-group UUID.
 */
export async function searchAlbumsFallback(query: string): Promise<Album[]> {
  try {
    const params = new URLSearchParams({ query, fmt: "json", limit: "25" })
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release-group?${params}`,
      { headers: { "User-Agent": "AlbumRanker/1.0 (album-ranker-app)" } }
    )
    const data = await res.json()

    return (data["release-groups"] ?? [])
      .filter((rg: any) => rg["primary-type"] === "Album")
      .slice(0, 20)
      .map((rg: any): Album => ({
        id: rg.id,
        title: rg.title,
        artist: rg["artist-credit"]?.[0]?.artist?.name ?? "Unknown",
        year: rg["first-release-date"]?.slice(0, 4),
        coverUrl: undefined,  // will use Cover Art Archive fallback in AlbumTile
        rating: 0,
        comparisons: 0,
        placementMatches: 0,
        previousOpponents: [],
      }))
  } catch (err) {
    console.error("MusicBrainz fallback search failed:", err)
    return []
  }
}
