import { useState, useMemo, useCallback } from "react"
import type { Album } from "../types/Album"
import RankingList from "./RankingList"

type Props = {
  albums: Album[]
  loading?: boolean
  onPlayMatches: (album: Album) => void
  onDelete?: (album: Album) => void
  onStartRankedPlay?: () => void
  onGoToSearch?: () => void
}

export default function RankingPage({ albums, loading, onPlayMatches, onDelete, onStartRankedPlay, onGoToSearch }: Props) {
  const [decadeFilter, setDecadeFilter] = useState("All")
  const [yearFilter, setYearFilter] = useState("All")

  const decades = useMemo(() => {
    const set = new Set<string>()
    albums.forEach(a => {
      if (a.year) set.add(`${Math.floor(parseInt(a.year) / 10) * 10}s`)
    })
    return Array.from(set).sort().reverse()
  }, [albums])

  const yearsInDecade = useMemo(() => {
    if (decadeFilter === "All") return []
    const start = parseInt(decadeFilter)
    const set = new Set<string>()
    albums.forEach(a => {
      if (a.year) {
        const y = parseInt(a.year)
        if (y >= start && y < start + 10) set.add(a.year)
      }
    })
    return Array.from(set).sort().reverse()
  }, [albums, decadeFilter])

  const handleDecadeClick = (d: string) => {
    setDecadeFilter(d)
    setYearFilter("All")
  }

  const rankMap = useMemo(() => new Map(albums.map((a, i) => [a.id, i + 1])), [albums])
  const getRank = useCallback((albumId: string) => rankMap.get(albumId) ?? 0, [rankMap])

  const filtered = useMemo(() => {
    if (decadeFilter === "All") return albums
    if (yearFilter !== "All") return albums.filter(a => a.year === yearFilter)
    return albums.filter(a => {
      if (!a.year) return false
      return `${Math.floor(parseInt(a.year) / 10) * 10}s` === decadeFilter
    })
  }, [albums, decadeFilter, yearFilter])

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-px bg-surface">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square bg-surface2 animate-pulse" />
        ))}
      </div>
    )
  }

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <p className="text-cream/50 text-sm">No albums ranked yet.</p>
        {onGoToSearch && (
          <button
            onClick={onGoToSearch}
            className="flex items-center gap-2 px-4 py-2 rounded border border-white/15 text-taupe/70 text-sm hover:border-white/30 hover:text-cream transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search for albums
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-4">
        {/* Text-tab decade filter */}
        <div className="flex items-center gap-5 overflow-x-auto scrollbar-none">
          {["All", ...decades].map(d => (
            <button
              key={d}
              onClick={() => handleDecadeClick(d)}
              className={`text-sm whitespace-nowrap pb-0.5 transition-colors border-b ${
                decadeFilter === d
                  ? "text-cream border-cream/40"
                  : "text-taupe/50 border-transparent hover:text-taupe"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Ghost Ranked Play button */}
        {albums.length >= 2 && onStartRankedPlay && (
          <button
            onClick={onStartRankedPlay}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/15 text-taupe/70 text-xs font-medium hover:border-white/30 hover:text-cream transition-colors"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <polygon points="1,0 9,4.5 1,9" />
            </svg>
            Ranked Play
          </button>
        )}
      </div>

      {/* Year sub-filter — same text-tab style */}
      {decadeFilter !== "All" && yearsInDecade.length > 1 && (
        <div className="flex items-center gap-5 overflow-x-auto scrollbar-none">
          {[`All ${decadeFilter}`, ...yearsInDecade].map((y, i) => {
            const value = i === 0 ? "All" : y
            return (
              <button
                key={y}
                onClick={() => setYearFilter(value)}
                className={`text-xs whitespace-nowrap pb-0.5 transition-colors border-b ${
                  yearFilter === value
                    ? "text-cream border-cream/30"
                    : "text-taupe/40 border-transparent hover:text-taupe"
                }`}
              >
                {y}
              </button>
            )
          })}
        </div>
      )}

      <RankingList albums={filtered} getRank={getRank} onPlayMatches={onPlayMatches} onDelete={onDelete} />
    </div>
  )
}
