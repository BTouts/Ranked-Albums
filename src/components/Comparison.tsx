import { useEffect, useState } from "react"
import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  newAlbum: Album
  existingAlbum: Album
  onBetter: () => void
  onWorse: () => void
  onTie: () => void
  onCancel: () => void
  mode?: "placement" | "ranked-play"
}

export default function Comparison({ newAlbum, existingAlbum, onBetter, onWorse, onTie, onCancel, mode = "placement" }: Props) {
  const [coversReady, setCoversReady] = useState(false)

  useEffect(() => {
    setCoversReady(false)
    const urls = [newAlbum.coverUrl, existingAlbum.coverUrl].filter(Boolean) as string[]
    if (urls.length === 0) { setCoversReady(true); return }
    let loaded = 0
    const onDone = () => { if (++loaded === urls.length) setCoversReady(true) }
    urls.forEach(url => { const img = new Image(); img.onload = onDone; img.onerror = onDone; img.src = url })
    const fallback = setTimeout(() => setCoversReady(true), 5000)
    return () => clearTimeout(fallback)
  }, [newAlbum.id, existingAlbum.id, newAlbum.coverUrl, existingAlbum.coverUrl])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!coversReady) return
      if (e.key === "ArrowLeft")  { e.preventDefault(); onBetter() }
      if (e.key === "ArrowRight") { e.preventDefault(); onWorse() }
      if (e.key === " ")          { e.preventDefault(); onTie() }
      if (e.key === "Escape")     { e.preventDefault(); onCancel() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onBetter, onWorse, onTie, onCancel, coversReady])

  const remaining = newAlbum.placementMatches
  const isRankedPlay = mode === "ranked-play"

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4 py-10 gap-6 font-sans comparison-enter">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-cream text-xl sm:text-2xl font-bold">Which do you prefer?</h2>
        <p className="text-taupe text-xs mt-1">
          {isRankedPlay
            ? "Ranked Play · keep going as long as you like"
            : `${remaining} match${remaining !== 1 ? "es" : ""} remaining`}
          <span className="hidden sm:inline">
            {" "}&nbsp;·&nbsp; ← → keys &nbsp;·&nbsp; Space = tie &nbsp;·&nbsp; Esc = {isRankedPlay ? "stop" : "cancel"}
          </span>
        </p>
      </div>

      {/* Albums — always side by side */}
      <div className="flex items-start gap-3 sm:gap-6 w-full max-w-md sm:max-w-2xl">
        {/* Left album */}
        <div className="flex-1 flex flex-col gap-2">
          <AlbumTile album={newAlbum} onClick={coversReady ? onBetter : undefined} />
          <button
            onClick={onBetter}
            disabled={!coversReady}
            className="w-full py-3 rounded-xl text-base sm:text-xl font-light text-cream bg-white/5 border border-white/10 hover:bg-steel/60 hover:border-steel active:scale-95 transition-all disabled:opacity-40 disabled:cursor-wait"
          >
            ←
          </button>
        </div>

        {/* vs divider */}
        <div className="shrink-0 self-center">
          <span className="text-taupe/50 font-semibold text-sm sm:text-lg">vs</span>
        </div>

        {/* Right album */}
        <div className="flex-1 flex flex-col gap-2">
          <AlbumTile album={existingAlbum} onClick={coversReady ? onWorse : undefined} />
          <button
            onClick={onWorse}
            disabled={!coversReady}
            className="w-full py-3 rounded-xl text-base sm:text-xl font-light text-cream bg-white/5 border border-white/10 hover:bg-steel/60 hover:border-steel active:scale-95 transition-all disabled:opacity-40 disabled:cursor-wait"
          >
            →
          </button>
        </div>
      </div>

      {/* Tie + Cancel */}
      <div className="flex items-center gap-5">
        <button
          onClick={onTie}
          disabled={!coversReady}
          className="px-5 py-2 text-sm text-taupe border border-white/10 rounded-lg hover:text-cream hover:border-taupe active:scale-95 transition-all disabled:opacity-40 disabled:cursor-wait"
        >
          Tie
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-white/20 hover:text-white/50 transition-colors"
        >
          {isRankedPlay ? "stop" : "cancel"}
        </button>
      </div>
    </div>
  )
}
