const CACHE_KEY = "coverArtCache"

function getCache(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

/** Returns true if we've previously confirmed this album has no cover art. */
export function isKnownMissing(albumId: string): boolean {
  return getCache()[albumId] === false
}

export function setCoverArtResult(albumId: string, hasArt: boolean) {
  const cache = getCache()
  cache[albumId] = hasArt
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}
