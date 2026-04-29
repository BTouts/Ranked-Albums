import "@supabase/functions-js/edge-runtime.d.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS })
  }

  const fixitUrl = Deno.env.get("FIXIT_URL")
  const fixitKey = Deno.env.get("FIXIT_API_KEY")

  if (!fixitUrl || !fixitKey) {
    return new Response(null, { status: 503, headers: CORS_HEADERS })
  }

  let body: { description?: string; url?: string; user_agent?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(null, { status: 400, headers: CORS_HEADERS })
  }

  if (!body.description?.trim()) {
    return new Response(null, { status: 400, headers: CORS_HEADERS })
  }

  try {
    await fetch(`${fixitUrl}/api/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fixitKey}`,
      },
      body: JSON.stringify({
        description: body.description.slice(0, 2000),
        url: body.url,
        user_agent: body.user_agent,
      }),
    })
  } catch {
    // best-effort — don't surface FixIt errors to the client
  }

  return new Response(null, { status: 200, headers: CORS_HEADERS })
})
