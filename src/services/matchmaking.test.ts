import { describe, it, expect } from "vitest"
import { pickOpponent } from "./matchmaking"
import type { Album } from "../types/Album"

function album(id: string, rating: number, previousOpponents: string[] = []): Album {
  return { id, title: id, artist: "test", rating, comparisons: 0, placementMatches: 0, previousOpponents }
}

describe("pickOpponent", () => {
  it("picks the closest rated album", () => {
    const challenger = album("new", 1000)
    const ranked = [album("a", 950), album("b", 1100), album("c", 500)]
    expect(pickOpponent(challenger, ranked)?.id).toBe("a") // 50 away vs 100 away
  })

  it("excludes previous opponents", () => {
    const challenger = album("new", 1000, ["a"])
    const ranked = [album("a", 950), album("b", 1100)]
    expect(pickOpponent(challenger, ranked)?.id).toBe("b")
  })

  it("excludes the challenger itself from candidates", () => {
    const challenger = album("new", 1000)
    const ranked = [album("new", 1000), album("b", 1100)]
    expect(pickOpponent(challenger, ranked)?.id).toBe("b")
  })

  it("returns null when all opponents are previous opponents", () => {
    const challenger = album("new", 1000, ["a", "b"])
    const ranked = [album("a", 950), album("b", 1100)]
    expect(pickOpponent(challenger, ranked)).toBeNull()
  })

  it("returns null for empty ranked list", () => {
    expect(pickOpponent(album("new", 1000), [])).toBeNull()
  })

  it("handles multiple eligible opponents and picks closest", () => {
    const challenger = album("new", 1000)
    const ranked = [album("a", 800), album("b", 990), album("c", 1010), album("d", 1200)]
    const result = pickOpponent(challenger, ranked)
    expect(["b", "c"]).toContain(result?.id) // both 10 away, either is valid
  })
})
