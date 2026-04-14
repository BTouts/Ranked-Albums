import type { Album } from "../types/Album"
import AlbumTile from "./AlbumTile"

type Props = {
  query: string
  onQueryChange: (q: string) => void
  results: Album[]
  onCompare: (album: Album) => void
}

export default function SearchPage({ query, onQueryChange, results, onCompare }: Props) {
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
            autoFocus
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

      {/* Results */}
      {query.length < 2 ? (
        <p className="text-taupe/30 text-sm text-center mt-8">Start typing to search…</p>
      ) : results.length === 0 ? (
        <p className="text-taupe/30 text-sm text-center mt-8">No results found.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-px bg-surface2">
          {results.map(album => (
            <AlbumTile key={album.id} album={album} onClick={() => onCompare(album)} />
          ))}
        </div>
      )}
    </div>
  )
}
