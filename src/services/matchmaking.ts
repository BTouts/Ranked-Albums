import type { Album } from "../types/Album"

export function pickOpponent(
  challenger: Album,
  ranked: Album[]
): Album | null { // Return null if no opponent is found
  const sorted = [...ranked].sort(
    (a, b) => Math.abs(a.rating - challenger.rating) - Math.abs(b.rating - challenger.rating)
  )

  const eligibleOpponents = sorted.filter(
    a => a.id !== challenger.id && !challenger.previousOpponents.includes(a.id)
  )

  return eligibleOpponents.length > 0 ? eligibleOpponents[0] : null
}