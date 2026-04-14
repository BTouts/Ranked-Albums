export function updateRatings(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  comparisonsA = 0,
  comparisonsB = 0
): [number, number] {

  function getK(comparisons: number) {

    if (comparisons < 10) return 48   // very new
    if (comparisons < 30) return 32   // stabilizing
    return 16                         // stable

  }

  const expectedA =
    1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))

  const expectedB =
    1 / (1 + Math.pow(10, (ratingA - ratingB) / 400))

  const kA = getK(comparisonsA)
  const kB = getK(comparisonsB)

  const newA = ratingA + kA * (scoreA - expectedA)
  const newB = ratingB + kB * ((1 - scoreA) - expectedB)

  return [Math.round(newA), Math.round(newB)]
}