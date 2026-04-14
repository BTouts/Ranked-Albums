import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  albums: Album[]
  getRank?: (albumId: string) => number
  onPlayMatches?: (album: Album) => void
  onDelete?: (album: Album) => void
}

export default function RankingList({ albums, getRank, onPlayMatches, onDelete }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
      {albums.map((album, i) => (
        <AlbumTile
          key={album.id}
          album={album}
          rank={getRank ? getRank(album.id) : i + 1}
          onPlayMatches={onPlayMatches ? () => onPlayMatches(album) : undefined}
          onDelete={onDelete ? () => onDelete(album) : undefined}
        />
      ))}
    </div>
  )
}
