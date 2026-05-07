import { useState } from "react"
import { GENRES, fetchGenreAlbums } from "../services/musicbrainz"
import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  onGetStarted: () => void
  onDismiss: () => void
  onAddAlbums: (albums: Album[]) => void
}

export default function OnboardingModal({ onGetStarted, onDismiss, onAddAlbums }: Props) {
  const [step, setStep] = useState<"welcome" | "genres" | "albums">("welcome")
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [genreAlbums, setGenreAlbums] = useState<Album[]>([])
  const [selectedAlbums, setSelectedAlbums] = useState<Set<string>>(new Set())
  const [loadingAlbums, setLoadingAlbums] = useState(false)

  const toggleGenre = (term: string) => {
    setSelectedGenres(prev =>
      prev.includes(term) ? prev.filter(g => g !== term) : [...prev, term]
    )
  }

  const toggleAlbum = (album: Album) => {
    setSelectedAlbums(prev => {
      const next = new Set(prev)
      if (next.has(album.id)) next.delete(album.id)
      else next.add(album.id)
      return next
    })
  }

  const handleGenreNext = async () => {
    if (selectedGenres.length === 0) { onGetStarted(); return }
    setLoadingAlbums(true)
    setStep("albums")
    try {
      const results = await Promise.all(selectedGenres.map(term => fetchGenreAlbums(term)))
      const seen = new Set<string>()
      const merged: Album[] = []
      for (const list of results) {
        for (const album of list) {
          if (!seen.has(album.id)) { seen.add(album.id); merged.push(album) }
        }
      }
      setGenreAlbums(merged.slice(0, 30))
    } finally {
      setLoadingAlbums(false)
    }
  }

  const handleAddSelected = () => {
    const toAdd = genreAlbums.filter(a => selectedAlbums.has(a.id))
    if (toAdd.length > 0) onAddAlbums(toAdd)
    else onGetStarted()
  }

  if (step === "welcome") {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-enter"
        onClick={onDismiss}
      >
        <div
          className="bg-surface w-full max-w-sm rounded-2xl p-6 flex flex-col gap-6 modal-enter"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-cream text-lg font-semibold">Welcome to Album Ranker</h2>
            <p className="text-taupe/60 text-sm">Rank your favorite albums head-to-head and build your personal list.</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("genres")}
              className="w-full py-2.5 rounded-xl bg-steel text-white text-sm font-medium hover:bg-powder active:scale-95 transition-all"
            >
              Pick my genres
            </button>
            <button
              onClick={onGetStarted}
              className="text-xs text-taupe/40 hover:text-taupe/60 transition-colors text-center py-1"
            >
              I'll search manually
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "genres") {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6 backdrop-enter"
        onClick={onDismiss}
      >
        <div
          className="bg-surface w-full max-w-sm rounded-2xl p-6 flex flex-col gap-6 modal-enter"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-cream text-lg font-semibold">What do you listen to?</h2>
            <p className="text-taupe/60 text-sm">Pick genres to see popular albums you might know.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button
                key={g.term}
                onClick={() => toggleGenre(g.term)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedGenres.includes(g.term)
                    ? "bg-steel text-white border-steel"
                    : "border-white/15 text-taupe/70 hover:border-white/30 hover:text-cream"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleGenreNext}
              className="w-full py-2.5 rounded-xl bg-steel text-white text-sm font-medium hover:bg-powder active:scale-95 transition-all"
            >
              {selectedGenres.length === 0 ? "Skip" : "See albums →"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // step === "albums"
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-enter"
      onClick={onDismiss}
    >
      <div
        className="bg-surface w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden modal-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/5 shrink-0">
          <h2 className="text-cream font-semibold text-base">Recognize any of these?</h2>
          <p className="text-taupe/50 text-xs mt-0.5">Tap albums you've listened to — they'll be added to your list.</p>
        </div>

        <div className="overflow-y-auto flex-1">
          {loadingAlbums ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-px bg-surface2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="aspect-square bg-surface animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-px bg-surface2">
              {genreAlbums.map(album => (
                <div key={album.id} className="relative">
                  <AlbumTile
                    album={album}
                    onClick={() => toggleAlbum(album)}
                  />
                  {selectedAlbums.has(album.id) && (
                    <div className="absolute inset-0 bg-steel/30 pointer-events-none flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-steel flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/5 shrink-0 flex gap-3">
          <button
            onClick={handleAddSelected}
            className="flex-1 py-2.5 rounded-xl bg-steel text-white text-sm font-medium hover:bg-powder active:scale-95 transition-all"
          >
            {selectedAlbums.size > 0 ? `Add ${selectedAlbums.size} album${selectedAlbums.size !== 1 ? "s" : ""}` : "Skip"}
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-taupe text-sm hover:text-cream hover:border-white/20 transition-colors"
          >
            Search manually
          </button>
        </div>
      </div>
    </div>
  )
}
