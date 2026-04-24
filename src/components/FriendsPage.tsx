import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import type { Friendship, PendingRequest } from "../services/friendsApi"
import {
  fetchFriends,
  fetchPendingRequests,
  fetchSentRequestIds,
  fetchFriendAlbums,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "../services/friendsApi"
import type { Album } from "../types/Album"
import FriendCard from "./FriendCard"
import FriendSearch from "./FriendSearch"
import FriendFullList from "./FriendFullList"

type Props = {
  user: User
  onPendingCountChange: (n: number) => void
}

export default function FriendsPage({ user, onPendingCountChange }: Props) {
  const [friends, setFriends] = useState<Friendship[]>([])
  const [pendingIncoming, setPendingIncoming] = useState<PendingRequest[]>([])
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [friendAlbums, setFriendAlbums] = useState<Map<string, Album[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [viewing, setViewing] = useState<Friendship | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [friendsData, pendingData, sentData] = await Promise.all([
        fetchFriends(user.id),
        fetchPendingRequests(user.id),
        fetchSentRequestIds(user.id),
      ])
      setFriends(friendsData)
      setPendingIncoming(pendingData)
      setSentIds(sentData)
      onPendingCountChange(pendingData.length)

      // Load top-5 albums for each friend in parallel
      const entries = await Promise.all(
        friendsData.map(async f => {
          const albums = await fetchFriendAlbums(f.friend.id, 5).catch(() => [])
          return [f.friend.id, albums] as [string, Album[]]
        })
      )
      setFriendAlbums(new Map(entries))
    } finally {
      setLoading(false)
    }
  }, [user.id, onPendingCountChange])

  useEffect(() => { loadData() }, [loadData])

  const handleAccept = async (req: PendingRequest) => {
    await acceptFriendRequest(req.id)
    await loadData()
  }

  const handleDecline = async (req: PendingRequest) => {
    await declineFriendRequest(req.id)
    setPendingIncoming(prev => prev.filter(r => r.id !== req.id))
    onPendingCountChange(pendingIncoming.length - 1)
  }

  const handleRemove = async (f: Friendship) => {
    await removeFriend(f.id)
    setFriends(prev => prev.filter(fr => fr.id !== f.id))
    setFriendAlbums(prev => { const m = new Map(prev); m.delete(f.friend.id); return m })
  }

  const friendIds = new Set(friends.map(f => f.friend.id))
  const pendingIncomingIds = new Set(pendingIncoming.map(r => r.requesterId))

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-cream font-bold text-lg">Friends</h2>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-steel text-white text-sm font-medium hover:bg-steel/80 active:scale-95 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Find Friends
        </button>
      </div>

      {/* Pending invites */}
      {pendingIncoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-taupe/60 text-xs tracking-widest uppercase">
            Pending Invites ({pendingIncoming.length})
          </p>
          <div className="flex flex-col gap-2">
            {pendingIncoming.map(req => {
              const name = req.requester.displayName ?? req.requester.email ?? "Someone"
              const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("")
              return (
                <div key={req.id} className="flex items-center gap-3 bg-surface2 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-steel/20 overflow-hidden flex items-center justify-center shrink-0">
                    {req.requester.avatarUrl
                      ? <img src={req.requester.avatarUrl} alt={name} className="w-full h-full object-cover" />
                      : <span className="text-steel text-[11px] font-bold">{initials}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-cream text-sm truncate">{name}</p>
                    <p className="text-taupe/40 text-xs">wants to be your friend</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAccept(req)}
                      className="px-3 py-1.5 rounded-lg bg-steel text-white text-xs font-medium hover:bg-steel/80 active:scale-95 transition-all"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(req)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-taupe/60 text-xs hover:bg-white/10 active:scale-95 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Friends list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface2 rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : friends.length === 0 && pendingIncoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
          <p className="text-cream/60 text-lg font-medium">No friends yet.</p>
          <p className="text-taupe text-sm">Find people by their name or email address.</p>
          <button
            onClick={() => setSearchOpen(true)}
            className="mt-2 px-5 py-2.5 rounded-lg bg-steel text-white text-sm font-medium hover:bg-steel/80 active:scale-95 transition-all"
          >
            Find Friends
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {friends.length > 0 && (
            <p className="text-taupe/60 text-xs tracking-widest uppercase">
              Your Friends ({friends.length})
            </p>
          )}
          {friends.map(f => (
            <FriendCard
              key={f.id}
              friendship={f}
              albums={friendAlbums.get(f.friend.id)}
              onView={() => setViewing(f)}
              onRemove={() => handleRemove(f)}
            />
          ))}
        </div>
      )}

      {/* Search modal */}
      {searchOpen && (
        <FriendSearch
          currentUserId={user.id}
          friendIds={friendIds}
          pendingIncomingIds={pendingIncomingIds}
          pendingSentIds={sentIds}
          onClose={() => setSearchOpen(false)}
          onRequestSent={() => fetchSentRequestIds(user.id).then(setSentIds)}
        />
      )}

      {/* Full list modal */}
      {viewing && (
        <FriendFullList
          friend={viewing.friend}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
