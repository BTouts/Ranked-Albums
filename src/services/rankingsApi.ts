import { supabase } from "./supabaseClient"
import type { Album } from "../types/Album"

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

  return data.map((r: any) => {
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
