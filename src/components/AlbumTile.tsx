import { useState } from "react"
import type { Album } from "../types/Album"
import { isKnownMissing, setCoverArtResult } from "../utils/coverArtCache"
import { useIsTouchDevice } from "../utils/useIsTouchDevice"

type Props = {
  album: Album
  rank?: number
  onClick?: () => void
  onPlayMatches?: () => void
  onDelete?: () => void
}

function confidence(comparisons: number) {
  return Math.round(Math.min(comparisons / 30, 1) * 100)
}

function streamingUrls(album: Album) {
  const q = encodeURIComponent(`${album.artist} ${album.title}`)
  return {
    appleMusic: `https://music.apple.com/search?term=${q}`,
    spotify: `https://open.spotify.com/search/${q}`,
  }
}

export default function AlbumTile({ album, rank, onClick, onPlayMatches, onDelete }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isTouch = useIsTouchDevice()

  const useModal = isTouch && !!onPlayMatches && !onClick

  const coverUrl = album.coverUrl
    ?? (isKnownMissing(album.id) ? null : `https://coverartarchive.org/release-group/${album.id}/front-250`)

  const { appleMusic, spotify } = streamingUrls(album)

  const handleTileClick = () => {
    if (useModal) { setModalOpen(true); setConfirmDelete(false) }
    else onClick?.()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDelete(true)
  }

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setModalOpen(false)
    setConfirmDelete(false)
    onDelete?.()
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDelete(false)
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
            {confirmDelete ? (
              /* Inline delete confirmation */
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <p className="text-cream text-xs text-center font-medium">Remove this album?</p>
                <div className="flex gap-2">
                  <button onClick={handleConfirmDelete}
                    className="px-3 py-1.5 text-xs rounded bg-red-500/80 text-white hover:bg-red-500 transition-colors">
                    Remove
                  </button>
                  <button onClick={handleCancelDelete}
                    className="px-3 py-1.5 text-xs rounded bg-white/10 text-taupe hover:bg-white/20 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-cream font-semibold text-sm leading-snug line-clamp-2">{album.title}</p>
                  <p className="text-taupe text-xs mt-0.5 truncate">{album.artist}</p>
                  {album.year && <p className="text-taupe/60 text-xs">{album.year}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {album.comparisons > 0 && (
                    <p className="text-powder text-xs">
                      {Math.round(album.rating)} ELO · {confidence(album.comparisons)}% confidence
                    </p>
                  )}
                  <div className="flex gap-2 text-[10px] text-taupe/50">
                    <a href={appleMusic} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="hover:text-cream transition-colors">Apple Music</a>
                    <span>·</span>
                    <a href={spotify} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="hover:text-cream transition-colors">Spotify</a>
                  </div>
                  <div className="flex gap-2">
                    {onPlayMatches && (
                      <button
                        onClick={e => { e.stopPropagation(); onPlayMatches() }}
                        className="flex-1 py-1.5 text-xs font-medium rounded bg-steel/80 text-white hover:bg-steel active:scale-95 transition-all"
                      >
                        Play matches
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={handleDelete}
                        className="py-1.5 px-2 text-xs rounded bg-white/5 text-taupe/50 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        title="Remove album"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Centered modal — mobile only */}
      {useModal && modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6 backdrop-enter"
          onClick={() => { setModalOpen(false); setConfirmDelete(false) }}
        >
          <div
            className="bg-surface2 rounded-2xl w-full max-w-sm p-5 flex flex-col gap-4 modal-enter"
            onClick={e => e.stopPropagation()}
          >
            {confirmDelete ? (
              /* Full-modal delete confirmation */
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-cream text-base font-semibold">Remove this album?</p>
                <p className="text-taupe text-sm text-center">
                  {album.title} will be removed from your rankings.
                </p>
                <button onClick={handleConfirmDelete}
                  className="w-full py-3 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-95 transition-all">
                  Yes, remove it
                </button>
                <button onClick={handleCancelDelete}
                  className="w-full py-2 text-sm text-taupe/50">
                  Cancel
                </button>
              </div>
            ) : (
              <>
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

                {onPlayMatches && (
                  <button
                    onClick={() => { setModalOpen(false); onPlayMatches() }}
                    className="w-full py-3 rounded-xl bg-steel text-white text-sm font-medium active:scale-95 transition-all"
                  >
                    Play matches
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <a href={appleMusic} target="_blank" rel="noopener noreferrer"
                    className="py-2.5 rounded-xl border border-white/10 text-xs text-taupe text-center hover:text-cream hover:border-white/20 active:scale-95 transition-all">
                    Apple Music
                  </a>
                  <a href={spotify} target="_blank" rel="noopener noreferrer"
                    className="py-2.5 rounded-xl border border-white/10 text-xs text-taupe text-center hover:text-cream hover:border-white/20 active:scale-95 transition-all">
                    Spotify
                  </a>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 text-xs text-taupe/40"
                  >
                    Close
                  </button>
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="py-2 px-4 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
