const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-bug`

export async function reportBug(description: string, url?: string) {
  try {
    await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        url,
        user_agent: navigator.userAgent,
      }),
    })
  } catch {
    // never let bug reporting crash the app
  }
}
