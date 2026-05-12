import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  albums: Album[]
  getRank?: (albumId: string) => number
  onPlayMatches?: (album: Album) => void
  onDelete?: (album: Album) => void
  onAddAlbum?: (album: Album) => void
  rankedIds?: Set<string>
  infoOnly?: boolean
  playMatchesDisabled?: boolean
}

export default function RankingList({ albums, getRank, onPlayMatches, onDelete, onAddAlbum, rankedIds, infoOnly, playMatchesDisabled }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
      {albums.map((album, i) => {
        const added = rankedIds?.has(album.id) ?? false
        return (
          <AlbumTile
            key={album.id}
            album={album}
            rank={getRank ? getRank(album.id) : i + 1}
            onPlayMatches={onPlayMatches ? () => onPlayMatches(album) : undefined}
            onDelete={onDelete ? () => onDelete(album) : undefined}
            onClick={onAddAlbum && !added ? () => onAddAlbum(album) : undefined}
            infoOnly={infoOnly && !onAddAlbum}
            isAdded={added && !!onAddAlbum}
            playMatchesDisabled={playMatchesDisabled}
          />
        )
      })}
    </div>
  )
}
