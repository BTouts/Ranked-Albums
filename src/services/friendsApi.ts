import { supabase } from "./supabaseClient"
import type { Album } from "../types/Album"

export type FriendProfile = {
  id: string
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

export type Friendship = {
  id: string
  requesterId: string
  addresseeId: string
  friend: FriendProfile
}

export type PendingRequest = {
  id: string
  requesterId: string
  requester: FriendProfile
}

function toFriendProfile(row: any): FriendProfile {
  return {
    id: row.id,
    displayName: row.display_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    email: row.email ?? null,
  }
}

export async function searchProfiles(query: string, excludeId: string): Promise<FriendProfile[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
    .neq("id", excludeId)
    .limit(10)
  if (error) throw error
  return (data ?? []).map(toFriendProfile)
}

export async function fetchFriends(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) throw error
  if (!data || data.length === 0) return []

  const friendIds = data.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id)
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .in("id", friendIds)
  if (pErr) throw pErr

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  return data.map(f => {
    const friendId = f.requester_id === userId ? f.addressee_id : f.requester_id
    const p = profileMap.get(friendId)
    return {
      id: f.id,
      requesterId: f.requester_id,
      addresseeId: f.addressee_id,
      friend: p ? toFriendProfile(p) : { id: friendId, displayName: null, avatarUrl: null, email: null },
    }
  })
}

export async function fetchPendingRequests(userId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id")
    .eq("addressee_id", userId)
    .eq("status", "pending")
  if (error) throw error
  if (!data || data.length === 0) return []

  const requesterIds = data.map(f => f.requester_id)
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .in("id", requesterIds)
  if (pErr) throw pErr

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  return data.map(f => {
    const p = profileMap.get(f.requester_id)
    return {
      id: f.id,
      requesterId: f.requester_id,
      requester: p ? toFriendProfile(p) : { id: f.requester_id, displayName: null, avatarUrl: null, email: null },
    }
  })
}

// Returns IDs that the current user has sent pending requests to (outgoing).
export async function fetchSentRequestIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("friendships")
    .select("addressee_id")
    .eq("requester_id", userId)
    .eq("status", "pending")
  if (error) throw error
  return new Set((data ?? []).map(f => f.addressee_id))
}

// Sends a friend request. If the other person already sent one to us, accept it instead.
export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { data: incoming } = await supabase
    .from("friendships")
    .select("id, status")
    .eq("requester_id", addresseeId)
    .eq("addressee_id", requesterId)
    .maybeSingle()

  if (incoming?.status === "pending") {
    await acceptFriendRequest(incoming.id)
    return
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId })
  if (error) throw error
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
  if (error) throw error
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
  if (error) throw error
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
  if (error) throw error
}

export async function fetchFriendAlbums(friendUserId: string, limit = 50): Promise<Album[]> {
  const { data, error } = await supabase
    .from("rankings")
    .select(`
      album_id,
      rating,
      comparisons,
      placement_matches,
      albums!inner (id, title, artist, year, cover_url)
    `)
    .eq("user_id", friendUserId)
    .order("rating", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.album_id,
    title: r.albums?.title ?? "Unknown",
    artist: r.albums?.artist ?? "Unknown",
    year: r.albums?.year,
    coverUrl: r.albums?.cover_url ?? undefined,
    rating: r.rating,
    comparisons: r.comparisons,
    placementMatches: r.placement_matches,
    previousOpponents: [],
  }))
}
