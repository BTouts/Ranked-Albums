import { useState, useMemo, useCallback } from "react"
import type { Album } from "../types/Album"
import RankingList from "./RankingList"

type Props = {
  albums: Album[]
  loading?: boolean
  onPlayMatches: (album: Album) => void
  onDelete?: (album: Album) => void
}

export default function RankingPage({ albums, loading, onPlayMatches, onDelete }: Props) {
  const [decadeFilter, setDecadeFilter] = useState("All")
  const [yearFilter, setYearFilter] = useState("All")

  const decades = useMemo(() => {
    const set = new Set<string>()
    albums.forEach(a => {
      if (a.year) set.add(`${Math.floor(parseInt(a.year) / 10) * 10}s`)
    })
    return Array.from(set).sort().reverse()
  }, [albums])

  // Years within the selected decade
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

  // Global rank map — preserves actual rank position when a filter is active
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
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <p className="text-cream/60 text-lg font-medium">No albums ranked yet.</p>
        <p className="text-taupe text-sm">Search for an album to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Decade filter */}
      {decades.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...decades].map(d => (
            <button
              key={d}
              onClick={() => handleDecadeClick(d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                decadeFilter === d
                  ? "bg-steel text-white"
                  : "text-taupe/60 border border-white/10 hover:text-cream hover:border-white/20"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Year filter — shown when a decade is selected and has multiple years */}
      {decadeFilter !== "All" && yearsInDecade.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[`All ${decadeFilter}`, ...yearsInDecade].map((y, i) => {
            const value = i === 0 ? "All" : y
            return (
              <button
                key={y}
                onClick={() => setYearFilter(value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  yearFilter === value
                    ? "bg-powder/20 text-powder border border-powder/30"
                    : "text-taupe/40 border border-white/8 hover:text-cream hover:border-white/20"
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
