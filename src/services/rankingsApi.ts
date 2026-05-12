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
      { onConflict: "id", ignoreDuplicates: true }
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

export type GlobalAlbum = Album & { rankedBy: number }

export async function fetchGlobalRankings(): Promise<GlobalAlbum[]> {
  const { data, error } = await supabase
    .from("rankings")
    .select(`
      user_id,
      album_id,
      rating,
      albums!inner (id, title, artist, year, cover_url)
    `)

  if (error) throw error
  if (!data) return []

  // Group each user's albums so we can compute rank-within-user
  const byUser = new Map<string, { album_id: string; rating: number; meta: any }[]>()
  for (const row of data as any[]) {
    const list = byUser.get(row.user_id) ?? []
    list.push({ album_id: row.album_id, rating: row.rating, meta: row.albums })
    byUser.set(row.user_id, list)
  }

  // For each user sort by rating desc, assign percentile 1.0 (top) → 0.0 (bottom)
  const albumPercentiles = new Map<string, { percentiles: number[]; meta: any }>()
  for (const userAlbums of byUser.values()) {
    const sorted = [...userAlbums].sort((a, b) => b.rating - a.rating)
    const n = sorted.length
    sorted.forEach((item, index) => {
      const percentile = n === 1 ? 1.0 : 1 - index / (n - 1)
      const entry = albumPercentiles.get(item.album_id)
      if (entry) {
        entry.percentiles.push(percentile)
      } else {
        albumPercentiles.set(item.album_id, { percentiles: [percentile], meta: item.meta })
      }
    })
  }

  return Array.from(albumPercentiles.entries())
    .filter(([, v]) => v.percentiles.length >= 2)
    .map(([albumId, v]) => {
      const avg = v.percentiles.reduce((a, b) => a + b, 0) / v.percentiles.length
      return {
        id: albumId,
        title: v.meta?.title ?? "Unknown",
        artist: v.meta?.artist ?? "Unknown",
        year: v.meta?.year,
        coverUrl: v.meta?.cover_url ?? undefined,
        rating: avg,
        comparisons: 0,
        placementMatches: 0,
        previousOpponents: [],
        rankedBy: v.percentiles.length,
      }
    })
    .sort((a, b) => b.rating - a.rating)
}

export async function deleteAllRankings(userId: string) {
  const { error } = await supabase
    .from("rankings")
    .delete()
    .eq("user_id", userId)
  if (error) throw error
}

export async function deleteRanking(userId: string, albumId: string) {
  const { error } = await supabase
    .from("rankings")
    .delete()
    .eq("user_id", userId)
    .eq("album_id", albumId)
  if (error) throw error
}
