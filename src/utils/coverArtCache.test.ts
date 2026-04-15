import { describe, it, expect, beforeEach } from "vitest"
import { isKnownMissing, setCoverArtResult } from "./coverArtCache"

// Stub localStorage for the Node test environment
const store: Record<string, string> = {}
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  },
  writable: true,
})

describe("coverArtCache", () => {
  beforeEach(() => localStorage.clear())

  it("returns false for an unknown album", () => {
    expect(isKnownMissing("unknown-id")).toBe(false)
  })

  it("marks an album as missing after setCoverArtResult(id, false)", () => {
    setCoverArtResult("abc", false)
    expect(isKnownMissing("abc")).toBe(true)
  })

  it("does not mark an album as missing after setCoverArtResult(id, true)", () => {
    setCoverArtResult("abc", true)
    expect(isKnownMissing("abc")).toBe(false)
  })

  it("overwriting false with true clears the missing flag", () => {
    setCoverArtResult("abc", false)
    setCoverArtResult("abc", true)
    expect(isKnownMissing("abc")).toBe(false)
  })

  it("persists multiple albums independently", () => {
    setCoverArtResult("has-art", true)
    setCoverArtResult("no-art", false)
    expect(isKnownMissing("has-art")).toBe(false)
    expect(isKnownMissing("no-art")).toBe(true)
  })
})
