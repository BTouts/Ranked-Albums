import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  albums: Album[]
  onPlayMatches?: (album: Album) => void
}

export default function RankingList({ albums, onPlayMatches }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
      {albums.map((album, i) => (
        <AlbumTile
          key={album.id}
          album={album}
          rank={i + 1}
          onPlayMatches={onPlayMatches ? () => onPlayMatches(album) : undefined}
        />
      ))}
    </div>
  )
}
