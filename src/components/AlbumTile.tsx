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
  const [modalOpen, setModalOpen] = useState(false)
  const isTouch = useIsTouchDevice()

  // On touch devices, ranked tiles open a bottom-sheet modal instead of relying on hover
  const useModal = isTouch && !!onPlayMatches && !onClick

  const coverUrl = album.coverUrl
    ?? (isKnownMissing(album.id) ? null : `https://coverartarchive.org/release-group/${album.id}/front-250`)

  const handleTileClick = () => {
    if (useModal) setModalOpen(true)
    else onClick?.()
  }

  return (
    <>
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

        {/* Hover overlay — desktop only */}
        {!useModal && (
          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-between p-3 z-20">
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
        )}
      </div>

      {/* Bottom-sheet modal — mobile only, for ranked tiles */}
      {useModal && modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-surface2 rounded-t-2xl w-full max-w-sm p-5 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Album info row */}
            <div className="flex gap-4 items-start">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface shrink-0">
                {coverUrl && (
                  <img src={coverUrl} alt={album.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold text-base leading-snug">{album.title}</p>
                <p className="text-taupe text-sm mt-0.5">{album.artist}</p>
                {album.year && <p className="text-taupe/60 text-xs mt-0.5">{album.year}</p>}
                {album.comparisons > 0 && (
                  <p className="text-powder text-xs mt-2">
                    {Math.round(album.rating)} ELO · {confidence(album.comparisons)}% confidence
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            {onPlayMatches && (
              <button
                onClick={() => { setModalOpen(false); onPlayMatches() }}
                className="w-full py-3 rounded-xl bg-steel text-white text-sm font-medium active:scale-95 transition-all"
              >
                Play matches
              </button>
            )}
            <button
              onClick={() => setModalOpen(false)}
              className="w-full py-2 text-xs text-taupe/40"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
