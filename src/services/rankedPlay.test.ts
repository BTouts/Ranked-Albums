import { describe, it, expect } from "vitest"
import { pickRankedPlayPair } from "./matchmaking"
import type { Album } from "../types/Album"

function album(id: string, rating: number, comparisons = 10): Album {
  return { id, title: id, artist: "test", rating, comparisons, placementMatches: 0, previousOpponents: [] }
}

// Run pickRankedPlayPair many times and collect all unique pair keys seen
function samplePairs(ranked: Album[], recent: Set<string>, trials = 200): Set<string> {
  const seen = new Set<string>()
  for (let i = 0; i < trials; i++) {
    const pair = pickRankedPlayPair(ranked, recent)
    if (pair) seen.add([pair[0].id, pair[1].id].sort().join("|"))
  }
  return seen
}

describe("pickRankedPlayPair", () => {
  describe("basic correctness", () => {
    it("returns null for an empty list", () => {
      expect(pickRankedPlayPair([], new Set())).toBeNull()
    })

    it("returns null when only one album exists", () => {
      expect(pickRankedPlayPair([album("a", 1000)], new Set())).toBeNull()
    })

    it("returns a pair of exactly 2 distinct albums", () => {
      const ranked = [album("a", 1000), album("b", 950), album("c", 900)]
      const result = pickRankedPlayPair(ranked, new Set())
      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0].id).not.toBe(result![1].id)
    })

    it("both albums in the returned pair exist in the input list", () => {
      const ranked = [album("a", 1000), album("b", 950), album("c", 900)]
      const ids = new Set(ranked.map(a => a.id))
      const result = pickRankedPlayPair(ranked, new Set())!
      expect(ids.has(result[0].id)).toBe(true)
      expect(ids.has(result[1].id)).toBe(true)
    })

    it("works with exactly 2 albums", () => {
      const result = pickRankedPlayPair([album("a", 1000), album("b", 950)], new Set())
      expect(result).not.toBeNull()
      expect(result![0].id).not.toBe(result![1].id)
    })

    it("higher-rated album is always first in the pair", () => {
      const ranked = [album("low", 900), album("high", 1100)]
      for (let i = 0; i < 50; i++) {
        const result = pickRankedPlayPair(ranked, new Set())!
        expect(result[0].rating).toBeGreaterThanOrEqual(result[1].rating)
      }
    })
  })

  describe("rank window constraint", () => {
    // RANK_WINDOW = 4: album at rank i can only face ranks i+1 through i+4
    it("never pairs albums more than 4 rank positions apart", () => {
      const ranked = [
        album("r0", 1050),
        album("r1", 1000),
        album("r2", 950),
        album("r3", 900),
        album("r4", 850),
        album("r5", 800), // 5 positions from r0 — must never be paired with r0
      ]
      const seen = samplePairs(ranked, new Set(), 300)
      expect(seen.has("r0|r5")).toBe(false)
    })

    it("surfaces a low-confidence album even when it is not immediately adjacent", () => {
      // c is the only low-confidence album; its closest-ELO neighbors (b, d) are high-confidence.
      // The rank window lets c be paired with a or e (2+ positions away).
      // All top-scored pairs should involve c because confidence weighs heavily.
      const ranked = [
        album("a", 1000, 30),
        album("b", 990,  30),
        album("c", 980,   0), // only low-confidence album
        album("d", 970,  30),
        album("e", 960,  30),
      ]
      let cCount = 0
      const trials = 300
      for (let i = 0; i < trials; i++) {
        const pair = pickRankedPlayPair(ranked, new Set())!
        if (pair[0].id === "c" || pair[1].id === "c") cCount++
      }
      // c should dominate picks (≥70%) since all top-5 scored pairs involve c
      expect(cCount / trials).toBeGreaterThan(0.7)
    })
  })

  describe("confidence weighting", () => {
    it("strongly prefers pairing low-confidence albums over high-confidence ones", () => {
      // All adjacent pairs have similar ELO diffs, but "raw" has 0 comparisons
      // vs the others at 30 (fully confident). It should appear in the majority of picks.
      const ranked = [
        album("high1", 1050, 30),
        album("high2", 1000, 30),
        album("raw",   950,  0),  // under-played — should be prioritized
        album("high3", 900, 30),
      ]
      let rawCount = 0
      const trials = 400
      for (let i = 0; i < trials; i++) {
        const pair = pickRankedPlayPair(ranked, new Set())!
        if (pair[0].id === "raw" || pair[1].id === "raw") rawCount++
      }
      // "raw" is 1 of 4 albums but should appear in well over 50% of pairs
      expect(rawCount / trials).toBeGreaterThan(0.5)
    })

    it("excludes the fully-confident-only pair when low-confidence pairs are available", () => {
      // conf1|conf2 is the only pair with no low-confidence album involved.
      // It scores lowest (both at full confidence) and should never be in the top-5.
      const ranked = [
        album("raw1",  1050, 0),  // low confidence
        album("raw2",  1000, 0),  // low confidence
        album("conf1", 950,  30), // high confidence
        album("conf2", 900,  30), // high confidence
      ]
      const seen = samplePairs(ranked, new Set(), 500)
      expect(seen.has("conf1|conf2")).toBe(false)
    })
  })

  describe("recent pair avoidance", () => {
    it("avoids pairs that were recently played", () => {
      const ranked = [album("a", 1000), album("b", 990), album("c", 980), album("d", 970)]
      const recent = new Set(["a|b"])
      const seen = samplePairs(ranked, recent, 200)
      expect(seen.has("a|b")).toBe(false)
    })

    it("avoids multiple recent pairs simultaneously", () => {
      const ranked = [album("a", 1000), album("b", 990), album("c", 980), album("d", 970), album("e", 960)]
      const recent = new Set(["a|b", "b|c"])
      const seen = samplePairs(ranked, recent, 200)
      expect(seen.has("a|b")).toBe(false)
      expect(seen.has("b|c")).toBe(false)
    })

    it("falls back to full pool when all candidate pairs are recent", () => {
      // With 2 albums there's only 1 possible pair — must fall back rather than return null
      const ranked = [album("a", 1000), album("b", 950)]
      const recent = new Set(["a|b"])
      const result = pickRankedPlayPair(ranked, recent)
      expect(result).not.toBeNull()
    })

    it("still returns a result when most pairs are recent", () => {
      const ranked = [album("a", 1000), album("b", 990), album("c", 980)]
      const recent = new Set(["a|b", "a|c", "b|c"])
      const result = pickRankedPlayPair(ranked, recent)
      expect(result).not.toBeNull()
    })
  })

  describe("variety", () => {
    it("produces varied matchups over multiple calls (not always the same pair)", () => {
      const ranked = [
        album("a", 1000), album("b", 990), album("c", 980),
        album("d", 970),  album("e", 960),
      ]
      const seen = samplePairs(ranked, new Set(), 300)
      // With 5 albums there are 8 valid pairs (within window=4).
      // We should see at least 3 different pairs over 300 trials.
      expect(seen.size).toBeGreaterThanOrEqual(3)
    })
  })
})
