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

async function itunesFetch(term: string, attribute?: string): Promise<ItunesResult[]> {
  const params = new URLSearchParams({ term, entity: "album", limit: "50" })
  if (attribute) params.set("attribute", attribute)

  const res = await fetch(`https://itunes.apple.com/search?${params}`)
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

export async function searchAlbums(query: string): Promise<Album[]> {
  try {
    // Run both searches in parallel:
    //   general  — best for album title queries ("good kid maad city", "abbey road")
    //   byArtist — best for artist name queries ("kendrick lamar", "radiohead")
    const [general, byArtist] = await Promise.all([
      itunesFetch(query),
      itunesFetch(query, "artistTerm"),
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
    console.error("iTunes search failed:", err)
    return []
  }
}
