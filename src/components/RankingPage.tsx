import type { Album } from "../types/Album"
import RankingList from "./RankingList"

type Props = {
  albums: Album[]
  loading?: boolean
  onPlayMatches: (album: Album) => void
}

export default function RankingPage({ albums, loading, onPlayMatches }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square bg-surface2 animate-pulse" />
        ))}
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <p className="text-cream/60 text-lg font-medium">No albums ranked yet.</p>
        <p className="text-taupe text-sm">Search for an album to get started.</p>
      </div>
    )
  }

  return <RankingList albums={albums} onPlayMatches={onPlayMatches} />
}
