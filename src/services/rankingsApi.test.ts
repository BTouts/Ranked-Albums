import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Supabase client before importing the module under test
vi.mock("./supabaseClient", () => {
  const chain: any = {}
  const methods = ["select", "eq", "order", "is", "update", "upsert", "delete"]
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  chain.then = undefined // not a thenable by default
  return { supabase: { from: vi.fn(() => chain) } }
})

import { fetchUserRankings, deleteRanking, fetchGlobalRankings } from "./rankingsApi"
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

// Helper: build a mock chain where .select() resolves immediately
function makeSelectChain(resolved: any) {
  const chain: any = {}
  const methods = ["eq", "order", "is", "update", "upsert", "delete"]
  methods.forEach(m => { chain[m] = vi.fn(() => chain) })
  chain.select = vi.fn(() => Promise.resolve(resolved))
  return chain
}

function rankingRow(
  userId: string,
  albumId: string,
  rating: number,
  albumMeta?: Partial<{ title: string; artist: string; year: string; cover_url: string | null }>
) {
  return {
    user_id: userId,
    album_id: albumId,
    rating,
    albums: { id: albumId, title: "Album " + albumId, artist: "Artist", year: "2020", cover_url: null, ...albumMeta },
  }
}

describe("fetchGlobalRankings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns empty array when data is null", async () => {
    const chain = makeSelectChain({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result).toEqual([])
  })

  it("excludes albums ranked by only one user", async () => {
    // u1 has only album a1 — single user, should be filtered out
    const chain = makeSelectChain({ data: [rankingRow("u1", "a1", 1200)], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result).toHaveLength(0)
  })

  it("includes albums ranked by exactly two users", async () => {
    const chain = makeSelectChain({
      data: [rankingRow("u1", "a1", 1000), rankingRow("u2", "a1", 1200)],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result).toHaveLength(1)
    expect(result[0].rankedBy).toBe(2)
  })

  it("ranks by percentile within each user's list, not absolute ELO", async () => {
    // u1 list: a1=1200 (#1 of 2 → 100%), a2=800 (#2 of 2 → 0%)
    // u2 list: a2=1100 (#1 of 2 → 100%), a1=900 (#2 of 2 → 0%)
    // a1 avg percentile: (1.0 + 0.0) / 2 = 0.5
    // a2 avg percentile: (0.0 + 1.0) / 2 = 0.5  → tied
    // Both have higher absolute ELO on average for the one who rated it higher,
    // but percentile correctly treats them symmetrically
    const chain = makeSelectChain({
      data: [
        rankingRow("u1", "a1", 1200), rankingRow("u1", "a2", 800),
        rankingRow("u2", "a2", 1100), rankingRow("u2", "a1", 900),
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result).toHaveLength(2)
    expect(result[0].rating).toBeCloseTo(0.5)
    expect(result[1].rating).toBeCloseTo(0.5)
  })

  it("correctly averages percentiles across users", async () => {
    // u1 list: a=1000 (#1 of 3 → 100%), b=800 (#2 → 50%), c=600 (#3 → 0%)
    // u2 list: a=1100 (#1 of 3 → 100%), b=900 (#2 → 50%), c=700 (#3 → 0%)
    // avg: a=1.0, b=0.5, c=0.0
    const chain = makeSelectChain({
      data: [
        rankingRow("u1", "a", 1000), rankingRow("u1", "b", 800), rankingRow("u1", "c", 600),
        rankingRow("u2", "a", 1100), rankingRow("u2", "b", 900), rankingRow("u2", "c", 700),
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    const a = result.find(r => r.id === "a")!
    const b = result.find(r => r.id === "b")!
    const c = result.find(r => r.id === "c")!
    expect(a.rating).toBeCloseTo(1.0)
    expect(b.rating).toBeCloseTo(0.5)
    expect(c.rating).toBeCloseTo(0.0)
  })

  it("sorts results by average percentile descending", async () => {
    // Same setup as above — a > b > c by percentile
    const chain = makeSelectChain({
      data: [
        rankingRow("u1", "a", 1000), rankingRow("u1", "b", 800), rankingRow("u1", "c", 600),
        rankingRow("u2", "a", 1100), rankingRow("u2", "b", 900), rankingRow("u2", "c", 700),
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result.map(r => r.id)).toEqual(["a", "b", "c"])
  })

  it("assigns 100th percentile to an album when a user has only one album", async () => {
    // u1 has only a1 → percentile = 1.0 (sole album)
    // u2 has a1 and a2, a1 is #1 → 1.0
    const chain = makeSelectChain({
      data: [
        rankingRow("u1", "a1", 1000),
        rankingRow("u2", "a1", 1100), rankingRow("u2", "a2", 900),
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    const a1 = result.find(r => r.id === "a1")!
    expect(a1.rating).toBeCloseTo(1.0)
  })

  it("maps album metadata fields correctly", async () => {
    const chain = makeSelectChain({
      data: [
        rankingRow("u1", "a1", 1000, { title: "OK Computer", artist: "Radiohead", year: "1997", cover_url: "https://example.com/art.jpg" }),
        rankingRow("u2", "a1", 1100, { title: "OK Computer", artist: "Radiohead", year: "1997", cover_url: "https://example.com/art.jpg" }),
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result[0]).toMatchObject({
      id: "a1",
      title: "OK Computer",
      artist: "Radiohead",
      year: "1997",
      coverUrl: "https://example.com/art.jpg",
      rankedBy: 2,
    })
  })

  it("handles missing album metadata gracefully", async () => {
    const chain = makeSelectChain({
      data: [
        { user_id: "u1", album_id: "x", rating: 1000, albums: null },
        { user_id: "u2", album_id: "x", rating: 1100, albums: null },
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result[0].title).toBe("Unknown")
    expect(result[0].artist).toBe("Unknown")
  })

  it("tracks rankedBy count correctly across multiple albums", async () => {
    const chain = makeSelectChain({
      data: [
        rankingRow("u1", "a1", 1000), rankingRow("u1", "a2", 900),
        rankingRow("u2", "a1", 1100), rankingRow("u2", "a2", 950),
        rankingRow("u3", "a1", 1050), rankingRow("u3", "a2", 980),
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValue(chain)
    const result = await fetchGlobalRankings()
    expect(result.find(r => r.id === "a1")!.rankedBy).toBe(3)
    expect(result.find(r => r.id === "a2")!.rankedBy).toBe(3)
  })

  it("throws when Supabase returns an error", async () => {
    const chain = makeSelectChain({ data: null, error: new Error("DB error") })
    vi.mocked(supabase.from).mockReturnValue(chain)
    await expect(fetchGlobalRankings()).rejects.toThrow("DB error")
  })
})
