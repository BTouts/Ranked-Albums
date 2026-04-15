import { describe, it, expect, vi, beforeEach } from "vitest"
import { searchAlbums, searchAlbumsFallback } from "./musicbrainz"

function itunesResult(overrides: Partial<{
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100: string
  releaseDate: string
  trackCount: number
}> = {}) {
  return {
    wrapperType: "collection",
    collectionType: "Album",
    collectionId: 1,
    collectionName: "Test Album",
    artistName: "Test Artist",
    artworkUrl100: "https://example.com/100x100bb.jpg",
    releaseDate: "2020-01-01",
    trackCount: 10,
    ...overrides,
  }
}

function mbResult(overrides: Partial<{
  id: string
  title: string
  "primary-type": string
  "artist-credit": any[]
  "first-release-date": string
}> = {}) {
  return {
    id: "mbid-1234-5678-abcd-efgh",
    title: "Test MB Album",
    "primary-type": "Album",
    "artist-credit": [{ artist: { name: "MB Artist" } }],
    "first-release-date": "1997-05-21",
    ...overrides,
  }
}

function mockFetch(responses: any[]) {
  let call = 0
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => responses[call++] ?? { results: [] },
  })))
}

describe("searchAlbums", () => {
  beforeEach(() => vi.unstubAllGlobals())

  it("returns mapped albums from iTunes results", async () => {
    mockFetch([
      { results: [itunesResult({ collectionId: 1, collectionName: "OK Computer", artistName: "Radiohead" })] },
      { results: [] },
    ])
    const results = await searchAlbums("radiohead")
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe("OK Computer")
    expect(results[0].artist).toBe("Radiohead")
  })

  it("deduplicates albums that appear in both general and artist results", async () => {
    const item = itunesResult({ collectionId: 42 })
    mockFetch([
      { results: [item] },
      { results: [item] }, // same album in both searches
    ])
    const results = await searchAlbums("test")
    expect(results).toHaveLength(1)
  })

  it("merges unique albums from both searches", async () => {
    mockFetch([
      { results: [itunesResult({ collectionId: 1, collectionName: "Album A" })] },
      { results: [itunesResult({ collectionId: 2, collectionName: "Album B" })] },
    ])
    const results = await searchAlbums("test")
    expect(results).toHaveLength(2)
  })

  it("filters out releases with fewer than 5 tracks", async () => {
    mockFetch([
      { results: [itunesResult({ trackCount: 3 })] },
      { results: [] },
    ])
    const results = await searchAlbums("test")
    expect(results).toHaveLength(0)
  })

  it("returns empty array on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network error") }))
    const results = await searchAlbums("test")
    expect(results).toEqual([])
  })

  it("returns empty array when aborted", async () => {
    const controller = new AbortController()
    vi.stubGlobal("fetch", vi.fn(async () => {
      const err = new Error("aborted"); err.name = "AbortError"; throw err
    }))
    controller.abort()
    const results = await searchAlbums("test", controller.signal)
    expect(results).toEqual([])
  })

  it("upgrades artwork to 600x600", async () => {
    mockFetch([
      { results: [itunesResult({ artworkUrl100: "https://example.com/100x100bb.jpg" })] },
      { results: [] },
    ])
    const results = await searchAlbums("test")
    expect(results[0].coverUrl).toContain("600x600bb")
  })

  it("extracts release year from releaseDate", async () => {
    mockFetch([
      { results: [itunesResult({ releaseDate: "1997-05-21" })] },
      { results: [] },
    ])
    const results = await searchAlbums("test")
    expect(results[0].year).toBe("1997")
  })
})

describe("searchAlbumsFallback", () => {
  beforeEach(() => vi.unstubAllGlobals())

  it("returns albums from MusicBrainz results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ "release-groups": [mbResult()] }),
    })))
    const results = await searchAlbumsFallback("test")
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe("Test MB Album")
    expect(results[0].artist).toBe("MB Artist")
    expect(results[0].year).toBe("1997")
  })

  it("filters out non-Album primary types", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        "release-groups": [
          mbResult({ "primary-type": "Album" }),
          mbResult({ "primary-type": "Single", id: "single-id" }),
          mbResult({ "primary-type": "EP", id: "ep-id" }),
        ],
      }),
    })))
    const results = await searchAlbumsFallback("test")
    expect(results).toHaveLength(1)
  })

  it("uses MusicBrainz UUID as album id", async () => {
    const uuid = "f27ec8db-af05-4f36-916e-3d57f91ecf5e"
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ "release-groups": [mbResult({ id: uuid })] }),
    })))
    const results = await searchAlbumsFallback("test")
    expect(results[0].id).toBe(uuid)
  })

  it("returns empty array on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network error") }))
    const results = await searchAlbumsFallback("test")
    expect(results).toEqual([])
  })

  it("returns empty array when release-groups is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })))
    const results = await searchAlbumsFallback("test")
    expect(results).toEqual([])
  })
})
