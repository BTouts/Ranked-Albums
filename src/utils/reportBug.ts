export async function reportBug(description: string, url?: string) {
  try {
    await fetch(`${import.meta.env.VITE_FIXIT_URL}/api/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_FIXIT_API_KEY}`,
      },
      body: JSON.stringify({
        description,
        url,
        user_agent: navigator.userAgent,
      }),
    });
  } catch {
    // never let bug reporting crash the app
  }
}
