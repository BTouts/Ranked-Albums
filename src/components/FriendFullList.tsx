import { useEffect, useState } from "react"
import type { FriendProfile } from "../services/friendsApi"
import { fetchFriendAlbums } from "../services/friendsApi"
import type { Album } from "../types/Album"
import RankingList from "./RankingList"

type Props = {
  friend: FriendProfile
  onClose: () => void
}

export default function FriendFullList({ friend, onClose }: Props) {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchFriendAlbums(friend.id)
      .then(setAlbums)
      .finally(() => setLoading(false))
  }, [friend.id])

  const rankMap = new Map(albums.map((a, i) => [a.id, i + 1]))
  const displayName = friend.displayName ?? friend.email ?? "Friend"
  const initials = displayName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("")

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-enter"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden modal-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 shrink-0">
          <div className="w-9 h-9 rounded-full bg-steel/20 overflow-hidden flex items-center justify-center shrink-0">
            {friend.avatarUrl
              ? <img src={friend.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <span className="text-steel text-xs font-bold">{initials}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-cream font-semibold text-sm truncate">{displayName}'s Rankings</p>
            {!loading && (
              <p className="text-taupe/50 text-xs">{albums.length} album{albums.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-taupe/50 hover:text-cream hover:bg-white/15 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        {/* Album grid */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square bg-surface animate-pulse" />
              ))}
            </div>
          ) : albums.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-taupe/50 text-sm">No albums ranked yet.</p>
            </div>
          ) : (
            <RankingList albums={albums} getRank={id => rankMap.get(id) ?? 0} />
          )}
        </div>
      </div>
    </div>
  )
}
