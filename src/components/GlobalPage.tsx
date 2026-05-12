import { useEffect, useState } from "react"
import { fetchGlobalRankings, type GlobalAlbum } from "../services/rankingsApi"
import AlbumTile from "./AlbumTile"

type Props = {
  onAddAlbum?: (album: GlobalAlbum) => void
  rankedIds?: Set<string>
}

export default function GlobalPage({ onAddAlbum, rankedIds }: Props) {
  const [albums, setAlbums] = useState<GlobalAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchGlobalRankings()
      .then(setAlbums)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-cream font-bold text-lg">Community Charts</h2>
        <p className="text-taupe/50 text-sm">Albums ranked by 2+ users, sorted by percentile.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-square bg-surface2 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-taupe/40 text-sm text-center py-20">Failed to load community rankings.</p>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 gap-2 text-center">
          <p className="text-cream/50 text-sm">No community data yet.</p>
          <p className="text-taupe/40 text-xs">Rankings appear once at least 2 users have ranked the same album.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
          {albums.map((album, i) => (
            <div key={album.id} className="relative">
              <AlbumTile
                album={album}
                rank={i + 1}
                onClick={rankedIds?.has(album.id) ? undefined : onAddAlbum ? () => onAddAlbum(album) : undefined}
                isAdded={rankedIds?.has(album.id)}
              />
              <div className="absolute bottom-1 left-1 bg-black/60 text-taupe/70 text-[9px] px-1 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                {album.rankedBy} {album.rankedBy === 1 ? "user" : "users"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
