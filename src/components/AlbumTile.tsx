import { useState } from "react"
import type { Album } from "../types/Album"
import { isKnownMissing, setCoverArtResult } from "../utils/coverArtCache"
import { useIsTouchDevice } from "../utils/useIsTouchDevice"

type Props = {
  album: Album
  rank?: number
  onClick?: () => void
  onPlayMatches?: () => void
}

function confidence(comparisons: number) {
  return Math.round(Math.min(comparisons / 30, 1) * 100)
}

export default function AlbumTile({ album, rank, onClick, onPlayMatches }: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const isTouch = useIsTouchDevice()

  // On touch devices, ranked tiles (onPlayMatches, no onClick) use a tap-to-toggle overlay
  // instead of hover — otherwise the Play Matches button is unreachable on mobile.
  const stickyOverlay = isTouch && !!onPlayMatches && !onClick

  const handleTileClick = () => {
    if (stickyOverlay) {
      setOverlayOpen(o => !o)
    } else {
      onClick?.()
    }
  }

  const coverUrl = album.coverUrl
    ?? (isKnownMissing(album.id) ? null : `https://coverartarchive.org/release-group/${album.id}/front-250`)

  const overlayClass = stickyOverlay
    ? `absolute inset-0 bg-black/80 transition-opacity duration-150 flex flex-col justify-between p-3 z-20 ${overlayOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`
    : "absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-3 z-20"

  return (
    <div
      onClick={handleTileClick}
      className="relative group aspect-square overflow-hidden bg-surface2 cursor-pointer"
    >
      {/* Cover art */}
      {coverUrl && (
        <img
          src={coverUrl}
          alt={album.title}
          loading="lazy"
          className="w-full h-full object-cover block"
          onError={e => {
            e.currentTarget.style.display = "none"
            if (!album.coverUrl) setCoverArtResult(album.id, false)
          }}
        />
      )}

      {/* Rank badge — always visible */}
      {rank !== undefined && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded-sm backdrop-blur-sm z-10">
          {rank}
        </div>
      )}

      {/* Overlay — hover on desktop, tap-toggle on mobile */}
      <div className={overlayClass}>
        <div>
          <p className="text-cream font-semibold text-sm leading-snug line-clamp-2">{album.title}</p>
          <p className="text-taupe text-xs mt-0.5 truncate">{album.artist}</p>
          {album.year && <p className="text-taupe/60 text-xs">{album.year}</p>}
        </div>

        <div className="flex flex-col gap-2">
          {album.comparisons > 0 && (
            <p className="text-powder text-xs">
              {Math.round(album.rating)} ELO · {confidence(album.comparisons)}% confidence
            </p>
          )}
          {onPlayMatches && (
            <button
              onClick={e => { e.stopPropagation(); onPlayMatches() }}
              className="w-full py-1.5 text-xs font-medium rounded bg-steel/80 text-white hover:bg-steel active:scale-95 transition-all"
            >
              Play matches
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
