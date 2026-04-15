import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Supabase client before importing the module under test
vi.mock("./supabaseClient", () => {
  const chain: any = {}
  const methods = ["select", "eq", "order", "is", "update", "upsert", "delete"]
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  chain.then = undefined // not a thenable by default
  return { supabase: { from: vi.fn(() => chain) } }
})

import { fetchUserRankings, deleteRanking } from "./rankingsApi"
import { supabase } from "./supabaseClient"

function makeChain(resolved: any) {
  const chain: any = {}
  const methods = ["select", "eq", "order", "is", "update", "upsert", "delete"]
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  // Make the last call in the chain resolve
  chain.order = vi.fn(() => Promise.resolve(resolved))
  chain.delete = vi.fn(() => Promise.resolve({ error: null }))
  chain.upsert = vi.fn(() => Promise.resolve({ error: null }))
  return chain
}

describe("fetchUserRankings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty array when data is null", async () => {
    const chain = makeChain({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchUserRankings("user-1")
    expect(result).toEqual([])
  })

  it("maps supabase rows to Album objects", async () => {
    const row = {
      album_id: "123",
      rating: 1200,
      comparisons: 15,
      placement_matches: 0,
      albums: { id: "123", title: "OK Computer", artist: "Radiohead", year: "1997", cover_url: null },
    }
    const chain = makeChain({ data: [row], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await fetchUserRankings("user-1")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: "123",
      title: "OK Computer",
      artist: "Radiohead",
      year: "1997",
      rating: 1200,
      comparisons: 15,
      placementMatches: 0,
    })
  })

  it("falls back to 'Unknown' when album metadata is missing", async () => {
    const row = { album_id: "x", rating: 1000, comparisons: 0, placement_matches: 0, albums: null }
    const chain = makeChain({ data: [row], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)

    const result = await fetchUserRankings("user-1")
    expect(result[0].title).toBe("Unknown")
    expect(result[0].artist).toBe("Unknown")
  })

  it("throws when Supabase returns an error", async () => {
    const chain = makeChain({ data: null, error: new Error("DB error") })
    vi.mocked(supabase.from).mockReturnValue(chain)
    await expect(fetchUserRankings("user-1")).rejects.toThrow("DB error")
  })
})

describe("deleteRanking", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls supabase delete with correct user and album id", async () => {
    const chain: any = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    chain.eq = vi.fn((col: string) => col === "album_id" ? Promise.resolve({ error: null }) : chain)
    vi.mocked(supabase.from).mockReturnValue(chain)

    await deleteRanking("user-1", "album-42")
    expect(supabase.from).toHaveBeenCalledWith("rankings")
    expect(chain.delete).toHaveBeenCalled()
  })

  it("throws when Supabase returns an error", async () => {
    const chain: any = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn((col: string) => col === "album_id" ? Promise.resolve({ error: new Error("delete failed") }) : chain),
    }
    vi.mocked(supabase.from).mockReturnValue(chain)
    await expect(deleteRanking("user-1", "album-42")).rejects.toThrow("delete failed")
  })
})
