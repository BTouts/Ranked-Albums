import { supabase } from "./supabaseClient"
import type { Album } from "../types/Album"

/**
 * Attempts to find cover art for albums that have no cover_url (typically MusicBrainz albums).
 * Runs in the background — never blocks the UI.
 * Only tries MusicBrainz UUIDs; iTunes numeric IDs aren't in Cover Art Archive.
 * If art is found, updates the shared albums table so all users benefit.
 */
async function tryBackfillCoverArt(albumId: string): Promise<void> {
  const isMusicBrainzId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(albumId)
  if (!isMusicBrainzId) return

  try {
    const url = `https://coverartarchive.org/release-group/${albumId}/front-500`
    // Follow redirects so we store the final archive.org URL — no redirect overhead on future loads
    const res = await fetch(url, { method: "HEAD" })
    if (!res.ok) return
    const resolvedUrl = res.url || url
    await supabase
      .from("albums")
      .update({ cover_url: resolvedUrl })
      .eq("id", albumId)
      .is("cover_url", null)
  } catch {
    // Cover art is nice-to-have — fail silently
  }
}

export async function fetchUserRankings(userId: string): Promise<Album[]> {
  const { data, error } = await supabase
    .from("rankings")
    .select(`
      album_id,
      rating,
      comparisons,
      placement_matches,
      albums!inner (id, title, artist, year, cover_url)
    `)
    .eq("user_id", userId)
    .order("rating", { ascending: false })

  if (error) {
    console.error("Error fetching rankings:", error)
    throw error
  }

  if (!data) return []

  const result: Album[] = data.map((r: any) => {
    const album = r.albums
    return {
      id: r.album_id,
      title: album?.title ?? "Unknown",
      artist: album?.artist ?? "Unknown",
      year: album?.year,
      coverUrl: album?.cover_url ?? undefined,
      rating: r.rating,
      comparisons: r.comparisons,
      placementMatches: r.placement_matches,
      previousOpponents: [],
    }
  })

  // Background: try to fill in cover art for albums that are missing it.
  // Caps at 5 per load to avoid hammering Cover Art Archive.
  result.filter(a => !a.coverUrl).slice(0, 5).forEach(a => tryBackfillCoverArt(a.id))

  return result
}

export async function saveRanking(userId: string, album: Album) {
  if (!userId) return

  const { error: albumError } = await supabase
    .from("albums")
    .upsert(
      {
        id: album.id,
        title: album.title,
        artist: album.artist,
        year: album.year,
        cover_url: album.coverUrl ?? null,
      },
      { onConflict: "id" }
    )

  if (albumError) console.error("Album upsert error:", albumError)

  // Background: if no cover URL was stored, try to find one from Cover Art Archive
  if (!album.coverUrl) tryBackfillCoverArt(album.id)

  const { error: rankingError } = await supabase
    .from("rankings")
    .upsert(
      {
        user_id: userId,
        album_id: album.id,
        rating: album.rating,
        comparisons: album.comparisons,
        placement_matches: album.placementMatches,
      },
      { onConflict: "user_id,album_id" }
    )

  if (rankingError) console.error("Ranking upsert error:", rankingError)
}

export async function deleteRanking(userId: string, albumId: string) {
  const { error } = await supabase
    .from("rankings")
    .delete()
    .eq("user_id", userId)
    .eq("album_id", albumId)
  if (error) throw error
}
