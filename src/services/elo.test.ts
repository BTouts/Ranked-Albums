import { describe, it, expect } from "vitest"
import { updateRatings } from "./elo"

describe("updateRatings", () => {
  it("winner gains rating, loser loses rating", () => {
    const [newA, newB] = updateRatings(1000, 1000, 1, 0, 0)
    expect(newA).toBeGreaterThan(1000)
    expect(newB).toBeLessThan(1000)
  })

  it("loser loses rating, winner gains rating", () => {
    const [newA, newB] = updateRatings(1000, 1000, 0, 0, 0)
    expect(newA).toBeLessThan(1000)
    expect(newB).toBeGreaterThan(1000)
  })

  it("tie between equal players results in no change", () => {
    const [newA, newB] = updateRatings(1000, 1000, 0.5, 0, 0)
    expect(newA).toBe(1000)
    expect(newB).toBe(1000)
  })

  it("new albums (K=48) gain/lose more than stable albums (K=16)", () => {
    const [newA1] = updateRatings(1000, 1000, 1, 0, 0)   // K=48
    const [newA2] = updateRatings(1000, 1000, 1, 30, 30) // K=16
    expect(newA1 - 1000).toBeGreaterThan(newA2 - 1000)
  })

  it("upset win (low vs high rating) earns more than expected", () => {
    const [newA] = updateRatings(800, 1200, 1, 0, 0)
    // Expected win probability for 800 vs 1200 is low, so gain should be large
    expect(newA).toBeGreaterThan(800 + 24)
  })

  it("heavy favorite winning gains very little", () => {
    const [newA] = updateRatings(1200, 800, 1, 0, 0)
    expect(newA - 1200).toBeLessThan(10)
  })

  it("ratings are whole numbers", () => {
    const [newA, newB] = updateRatings(1000, 1050, 1, 5, 5)
    expect(Number.isInteger(newA)).toBe(true)
    expect(Number.isInteger(newB)).toBe(true)
  })
})
