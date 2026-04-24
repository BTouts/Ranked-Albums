import type { Friendship } from "../services/friendsApi"
import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  friendship: Friendship
  albums: Album[] | undefined // top-5, undefined = still loading
  onView: () => void
  onRemove: () => void
}

export default function FriendCard({ friendship, albums, onView, onRemove }: Props) {
  const { friend } = friendship
  const displayName = friend.displayName ?? friend.email ?? "Friend"
  const initials = displayName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("")
  const loading = albums === undefined
  const preview = albums?.slice(0, 5) ?? []

  return (
    <div className="bg-surface2 rounded-xl overflow-hidden">
      {/* Friend header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-steel/20 overflow-hidden flex items-center justify-center shrink-0">
          {friend.avatarUrl
            ? <img src={friend.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            : <span className="text-steel text-[11px] font-bold">{initials}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-cream text-sm font-medium truncate">{displayName}</p>
          {friend.email && friend.displayName && (
            <p className="text-taupe/40 text-xs truncate">{friend.email}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="text-taupe/30 hover:text-red-400 text-xs transition-colors shrink-0 px-2 py-1 rounded"
          title="Remove friend"
        >
          Remove
        </button>
      </div>

      {/* Album preview — clicking opens full list */}
      <button
        onClick={onView}
        className="w-full text-left"
        aria-label={`View ${displayName}'s full rankings`}
      >
        {loading ? (
          <div className="grid grid-cols-5 gap-px bg-surface">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="aspect-square bg-surface2 animate-pulse" />
            ))}
          </div>
        ) : preview.length === 0 ? (
          <div className="flex items-center justify-center py-6 bg-surface">
            <p className="text-taupe/30 text-xs">No albums ranked yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-px bg-surface">
            {preview.map((album, i) => (
              <AlbumTile
                key={album.id}
                album={album}
                rank={i + 1}
              />
            ))}
            {/* Filler slots so the row always looks complete */}
            {preview.length < 5 && Array.from({ length: 5 - preview.length }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square bg-surface2" />
            ))}
          </div>
        )}

        {/* Footer: album count + view prompt */}
        {!loading && albums && albums.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
            <span className="text-taupe/40 text-xs">{albums.length} album{albums.length !== 1 ? "s" : ""} ranked</span>
            <span className="text-steel text-xs font-medium">View all →</span>
          </div>
        )}
      </button>
    </div>
  )
}
