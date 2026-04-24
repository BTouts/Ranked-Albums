import type { Album } from "../types/Album"

export function pickOpponent(
  challenger: Album,
  ranked: Album[]
): Album | null { // Return null if no opponent is found
  const sorted = [...ranked].sort(
    (a, b) => Math.abs(a.rating - challenger.rating) - Math.abs(b.rating - challenger.rating)
  )

  const eligibleOpponents = sorted.filter(
    a => a.id !== challenger.id && !challenger.previousOpponents.includes(a.id)
  )

  return eligibleOpponents.length > 0 ? eligibleOpponents[0] : null
}

// Picks a pair for Ranked Play mode.
// Candidates are albums within ±4 rank positions of each other (wider than adjacent-only,
// so high-rated albums don't monopolize). Each pair is scored:
//   60% — confidence deficit: albums with fewer comparisons are surfaced first
//   40% — ELO closeness: prefer evenly matched albums
// Picks randomly from the top-5 scored pairs for variety.
// Avoids recently played pairs; falls back to full pool if all have been played.
const CONFIDENCE_THRESHOLD = 30  // comparisons at which an album is considered "fully confident"
const RANK_WINDOW = 4             // how many rank positions away a valid opponent can be

export function pickRankedPlayPair(
  ranked: Album[],
  recentPairs: Set<string>
): [Album, Album] | null {
  if (ranked.length < 2) return null

  const sorted = [...ranked].sort((a, b) => b.rating - a.rating)

  const candidates: [Album, Album][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j <= Math.min(i + RANK_WINDOW, sorted.length - 1); j++) {
      candidates.push([sorted[i], sorted[j]])
    }
  }

  const eligible = candidates.filter(
    ([a, b]) => !recentPairs.has([a.id, b.id].sort().join("|"))
  )
  const pool = eligible.length > 0 ? eligible : candidates

  const maxEloDiff = Math.max(...pool.map(([a, b]) => Math.abs(a.rating - b.rating)), 1)

  const scored = pool.map(([a, b]) => {
    const eloDiff = Math.abs(a.rating - b.rating)
    const minComparisons = Math.min(a.comparisons, b.comparisons)
    const confidenceFactor = Math.min(minComparisons / CONFIDENCE_THRESHOLD, 1) // 0 = raw, 1 = confident
    const eloCloseness = 1 - eloDiff / maxEloDiff                               // 1 = identical ELO
    const score = (1 - confidenceFactor) * 0.6 + eloCloseness * 0.4
    return { pair: [a, b] as [Album, Album], score }
  })

  scored.sort((a, b) => b.score - a.score)

  const topN = Math.min(5, scored.length)
  return scored[Math.floor(Math.random() * topN)].pair
}