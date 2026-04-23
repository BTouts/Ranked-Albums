import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed. Use GET." }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing or invalid Authorization header. Expected: Bearer <token>" }, 401)
  }

  const jwt = authHeader.slice(7)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: "Invalid or expired token. Re-authenticate and try again." }, 401)
  }

  const url = new URL(req.url)

  const limitParam = parseInt(url.searchParams.get("limit") ?? "10", 10)
  const limit = isNaN(limitParam) || limitParam < 1 ? 10 : Math.min(limitParam, 50)

  // user_id param lets callers view another user's list; falls back to the authenticated user
  const targetUserId = url.searchParams.get("user_id") ?? user.id

  const { data, error: dbError } = await supabase
    .from("rankings")
    .select(`
      rating,
      comparisons,
      placement_matches,
      albums!inner (id, title, artist, year, cover_url)
    `)
    .eq("user_id", targetUserId)
    .order("rating", { ascending: false })
    .limit(limit)

  if (dbError) {
    return json({ error: "Failed to fetch rankings.", detail: dbError.message }, 500)
  }

  const albums = (data ?? []).map((row: any, index: number) => ({
    rank: index + 1,
    id: row.albums.id,
    title: row.albums.title,
    artist: row.albums.artist,
    year: row.albums.year ?? null,
    cover_url: row.albums.cover_url ?? null,
    rating: row.rating,
    comparisons: row.comparisons,
    placement_complete: row.placement_matches === 0,
  }))

  return json({
    user_id: targetUserId,
    total_returned: albums.length,
    limit,
    albums,
    generated_at: new Date().toISOString(),
  })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}
