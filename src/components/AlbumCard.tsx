import type { Album } from "../types/Album"

type Props = {
  album: Album
  onClick?: () => void
}

export default function AlbumCard({ album, onClick }: Props) {

  const coverUrl =
    `https://coverartarchive.org/release-group/${album.id}/front`

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        gap: "10px",
        border: "1px solid #ccc",
        padding: "10px",
        marginBottom: "8px",
        cursor: onClick ? "pointer" : "default"
      }}
    >

      <img
        src={coverUrl}
        width={60}
        onError={(e)=> (e.currentTarget.style.display="none")}
      />

      <div>
        <strong>{album.title}</strong>
        <div>{album.artist}</div>
        {album.year && <div>{album.year}</div>}
      </div>

    </div>
  )
}