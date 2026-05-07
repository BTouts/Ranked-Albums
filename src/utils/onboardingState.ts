const KEY = "onboarding_seen"

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(KEY) === "true"
  } catch {
    return false
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(KEY, "true")
  } catch {
    // ignore
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
