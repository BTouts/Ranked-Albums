import { useEffect } from "react"
import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  newAlbum: Album
  existingAlbum: Album
  onBetter: () => void
  onWorse: () => void
  onTie: () => void
  onCancel: () => void
}

export default function Comparison({ newAlbum, existingAlbum, onBetter, onWorse, onTie, onCancel }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  { e.preventDefault(); onBetter() }
      if (e.key === "ArrowRight") { e.preventDefault(); onWorse() }
      if (e.key === " ")          { e.preventDefault(); onTie() }
      if (e.key === "Escape")     { e.preventDefault(); onCancel() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onBetter, onWorse, onTie, onCancel])

  const remaining = newAlbum.placementMatches

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4 sm:px-6 py-10 font-sans">
      <h2 className="text-cream text-xl sm:text-2xl font-bold mb-1">Which do you prefer?</h2>
      <p className="text-taupe text-xs mb-8 text-center">
        {remaining} match{remaining !== 1 ? "es" : ""} remaining
        <span className="hidden sm:inline">&nbsp;·&nbsp; ← → keys &nbsp;·&nbsp; Space = tie &nbsp;·&nbsp; Esc = cancel</span>
      </p>

      {/* Albums: side-by-side on desktop, stacked on mobile */}
      <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 w-full max-w-2xl">
        {/* Left / Top album */}
        <div className="flex-1 w-full flex flex-col gap-3">
          <AlbumTile album={newAlbum} onClick={onBetter} />
          <button
            onClick={onBetter}
            className="w-full py-3 sm:py-4 rounded-xl text-xl font-light text-cream bg-white/5 border border-white/10 hover:bg-steel/60 hover:border-steel active:scale-95 transition-all"
          >
            ←
          </button>
        </div>

        {/* Middle controls */}
        <div className="flex md:flex-col flex-row items-center gap-3 sm:gap-4 shrink-0">
          <span className="text-taupe font-semibold text-lg hidden md:block">vs</span>
          <button
            onClick={onTie}
            className="px-4 py-2 text-xs text-taupe border border-white/10 rounded-lg hover:text-cream hover:border-taupe active:scale-95 transition-all"
          >
            Tie
          </button>
          <button
            onClick={onCancel}
            className="text-xs text-white/20 hover:text-white/50 transition-colors"
          >
            cancel
          </button>
        </div>

        {/* Right / Bottom album */}
        <div className="flex-1 w-full flex flex-col gap-3">
          <AlbumTile album={existingAlbum} onClick={onWorse} />
          <button
            onClick={onWorse}
            className="w-full py-3 sm:py-4 rounded-xl text-xl font-light text-cream bg-white/5 border border-white/10 hover:bg-steel/60 hover:border-steel active:scale-95 transition-all"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
