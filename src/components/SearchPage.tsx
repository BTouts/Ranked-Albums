import { useState, useEffect } from "react"
import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"
import { searchAlbumsFallback } from "../services/musicbrainz"

type Props = {
  query: string
  onQueryChange: (q: string) => void
  results: Album[]
  onCompare: (album: Album) => void
  onAddMultiple?: (albums: Album[]) => void
  rankedIds?: Set<string>
}

export default function SearchPage({ query, onQueryChange, results, onCompare, onAddMultiple, rankedIds }: Props) {
  const [mbResults, setMbResults] = useState<Album[]>([])
  const [mbLoading, setMbLoading] = useState(false)
  const [mbSearched, setMbSearched] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Reset fallback state and selection whenever the query changes
  useEffect(() => {
    setMbResults([])
    setMbSearched(false)
    setSelected(new Set())
  }, [query])

  const toggleSelect = (album: Album) => {
    if (rankedIds?.has(album.id)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(album.id)) next.delete(album.id)
      else next.add(album.id)
      return next
    })
  }

  const allResults = [...results, ...mbResults]

  const handleAddSelected = () => {
    const toAdd = allResults.filter(a => selected.has(a.id))
    if (toAdd.length > 0) {
      onAddMultiple?.(toAdd)
      setSelectMode(false)
      setSelected(new Set())
    }
  }

  const handleFallbackSearch = async () => {
    setMbLoading(true)
    setMbSearched(true)
    try {
      const res = await searchAlbumsFallback(query)
      setMbResults(res)
    } finally {
      setMbLoading(false)
    }
  }

  const hasItunesResults = query.length >= 2 && results.length > 0
  const showFallbackButton = query.length >= 2 && !mbSearched

  return (
    <div className="flex flex-col gap-8">
      {/* Search bar — centered hero */}
      <div className="flex flex-col items-center gap-3 pt-6">
        <p className="text-taupe/60 text-xs tracking-widest uppercase">Search by album or artist</p>
        <div className="relative w-full max-w-2xl">
          {/* Search icon */}
          <svg
            className="absolute left-5 top-1/2 -translate-y-1/2 text-taupe/50 pointer-events-none"
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Kendrick Lamar, Abbey Road, Radiohead…"
            className="w-full pl-13 pr-12 py-4 rounded-2xl bg-surface2 border border-white/8 text-cream text-lg placeholder-taupe/40 focus:outline-none focus:border-steel/60 focus:bg-surface transition-colors shadow-lg"
          />

          {/* Clear button */}
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-taupe/40 hover:text-taupe transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* iTunes results */}
      {query.length < 2 ? (
        <p className="text-taupe/30 text-sm text-center mt-8">Start typing to search…</p>
      ) : results.length === 0 ? (
        <p className="text-taupe/30 text-sm text-center mt-8">No results found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Select multiple toggle */}
          {onAddMultiple && (
            <div className="flex items-center justify-end">
              <button
                onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectMode
                    ? "border-steel text-steel bg-steel/10"
                    : "border-white/10 text-taupe/50 hover:border-white/20 hover:text-taupe"
                }`}
              >
                {selectMode ? "Cancel" : "Select multiple"}
              </button>
            </div>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-px bg-surface">
            {results.map(album => {
              const added = rankedIds?.has(album.id)
              const isSelected = selected.has(album.id)
              return (
                <div key={album.id} className="relative">
                  <AlbumTile
                    album={album}
                    onClick={added ? undefined : selectMode ? () => toggleSelect(album) : () => onCompare(album)}
                    isAdded={added}
                  />
                  {selectMode && !added && isSelected && (
                    <div className="absolute inset-0 bg-steel/30 pointer-events-none flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-steel flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fallback search trigger */}
      {showFallbackButton && (
        <div className="flex justify-center">
          <button
            onClick={handleFallbackSearch}
            className="text-xs text-taupe/50 hover:text-taupe border border-white/8 hover:border-white/20 px-4 py-2 rounded-full transition-colors"
          >
            {hasItunesResults ? "Not finding it? Search extended catalog" : "Try extended catalog search"}
          </button>
        </div>
      )}

      {/* MusicBrainz fallback results */}
      {mbSearched && (
        <div className="flex flex-col gap-3">
          <p className="text-taupe/40 text-xs tracking-widest uppercase text-center">Extended results</p>
          {mbLoading ? (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-px bg-surface">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-surface2 animate-pulse" />
              ))}
            </div>
          ) : mbResults.length === 0 ? (
            <p className="text-taupe/30 text-sm text-center">No extended results found.</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-px bg-surface">
              {mbResults.map(album => {
                const added = rankedIds?.has(album.id)
                const isSelected = selected.has(album.id)
                return (
                  <div key={album.id} className="relative">
                    <AlbumTile
                      album={album}
                      onClick={added ? undefined : selectMode ? () => toggleSelect(album) : () => onCompare(album)}
                      isAdded={added}
                    />
                    {selectMode && !added && isSelected && (
                      <div className="absolute inset-0 bg-steel/30 pointer-events-none flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-steel flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Select mode sticky add bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleAddSelected}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-steel text-white text-sm font-medium shadow-lg hover:bg-powder active:scale-95 transition-all"
          >
            Add {selected.size} album{selected.size !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  )
}
