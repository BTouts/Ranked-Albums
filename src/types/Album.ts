export type Album = {
  id: string
  title: string
  artist: string
  year?: string
  coverUrl?: string   // iTunes CDN artwork URL

  rating: number
  comparisons: number
  placementMatches: number

  previousOpponents: string[] // frontend only
}