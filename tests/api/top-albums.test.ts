import { describe, it, expect, beforeAll } from "vitest"

const BASE_URL = process.env.VITE_SUPABASE_URL ?? "https://xeiygyromiabfiroykba.supabase.co"
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ""
const AUTH_URL = `${BASE_URL}/auth/v1/token?grant_type=password`
const API_URL = `${BASE_URL}/functions/v1/top-albums`

const TEST_EMAIL = process.env.E2E_USER_EMAIL ?? "user@test.com"
const TEST_PASSWORD = process.env.E2E_USER_PASSWORD ?? "test1234"

async function authenticate(): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Authentication failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return data.access_token
}

describe("Top Albums API", () => {
  let token: string

  beforeAll(async () => {
    token = await authenticate()
  }, 15_000)

  // --- Authentication ---

  describe("authentication", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await fetch(API_URL)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body).toHaveProperty("error")
    })

    it("returns 401 for an invalid token", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: "Bearer not-a-real-token" },
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body).toHaveProperty("error")
    })

    it("returns 401 for a non-Bearer scheme", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      })
      expect(res.status).toBe(401)
    })
  })

  // --- Method validation ---

  describe("method validation", () => {
    it("returns 405 for POST", async () => {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(405)
      const body = await res.json()
      expect(body).toHaveProperty("error")
    })

    it("returns 405 for PUT", async () => {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(405)
    })

    it("returns 405 for DELETE", async () => {
      const res = await fetch(API_URL, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(405)
    })
  })

  // --- Successful responses ---

  describe("GET /top-albums", () => {
    it("returns 200 with a valid token", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
    })

    it("returns Content-Type: application/json", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.headers.get("content-type")).toContain("application/json")
    })

    it("response body has all top-level fields", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body).toHaveProperty("user_id")
      expect(body).toHaveProperty("albums")
      expect(body).toHaveProperty("total_returned")
      expect(body).toHaveProperty("limit")
      expect(body).toHaveProperty("generated_at")
      expect(Array.isArray(body.albums)).toBe(true)
    })

    it("generated_at is a valid ISO 8601 timestamp", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { generated_at } = await res.json()
      expect(new Date(generated_at).toISOString()).toBe(generated_at)
    })

    it("each album has the required fields", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      for (const album of body.albums) {
        expect(album).toHaveProperty("rank")
        expect(album).toHaveProperty("id")
        expect(album).toHaveProperty("title")
        expect(album).toHaveProperty("artist")
        expect(album).toHaveProperty("rating")
        expect(album).toHaveProperty("comparisons")
        expect(album).toHaveProperty("placement_complete")
        expect(typeof album.placement_complete).toBe("boolean")
      }
    })

    it("albums are sorted by rating descending", async () => {
      const res = await fetch(`${API_URL}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      const ratings: number[] = body.albums.map((a: any) => a.rating)
      for (let i = 1; i < ratings.length; i++) {
        expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1])
      }
    })

    it("rank values are sequential starting at 1", async () => {
      const res = await fetch(`${API_URL}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      body.albums.forEach((album: any, i: number) => {
        expect(album.rank).toBe(i + 1)
      })
    })

    it("total_returned matches the length of the albums array", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.total_returned).toBe(body.albums.length)
    })
  })

  // --- limit param ---

  describe("limit parameter", () => {
    it("defaults to 10", async () => {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.limit).toBe(10)
      expect(body.albums.length).toBeLessThanOrEqual(10)
    })

    it("respects limit=3", async () => {
      const res = await fetch(`${API_URL}?limit=3`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.limit).toBe(3)
      expect(body.albums.length).toBeLessThanOrEqual(3)
    })

    it("limit=1 returns exactly one album", async () => {
      const res = await fetch(`${API_URL}?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.limit).toBe(1)
      expect(body.albums).toHaveLength(1)
      expect(body.total_returned).toBe(1)
    })

    it("caps limit at 50 for values above the max", async () => {
      const res = await fetch(`${API_URL}?limit=999`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.limit).toBe(50)
    })

    it("falls back to limit=10 for a non-numeric value", async () => {
      const res = await fetch(`${API_URL}?limit=banana`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.limit).toBe(10)
    })

    it("falls back to limit=10 for limit=0", async () => {
      const res = await fetch(`${API_URL}?limit=0`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      expect(body.limit).toBe(10)
    })
  })
})
