import { useMemo } from "react"

/**
 * Returns true on touch-primary devices (phones, tablets).
 * Uses the CSS media query `(hover: none) and (pointer: coarse)` which matches
 * devices where the primary input has no hover and is coarse (finger, not mouse).
 */
export function useIsTouchDevice(): boolean {
  return useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches,
    []
  )
}
