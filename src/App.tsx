import { useState, useEffect } from "react"
import type { Album } from "./types/Album"
import { supabase } from "./services/supabaseClient"
import { searchAlbums } from "./services/musicbrainz"
import { fetchUserRankings, saveRanking } from "./services/rankingsApi"
import { updateRatings } from "./services/elo"
import { pickOpponent } from "./services/matchmaking"

import RankingPage from "./components/RankingPage"
import SearchPage from "./components/SearchPage"
import Comparison from "./components/Comparison"
import LoginForm from "./components/LoginForm"
import type { User } from "@supabase/supabase-js"

type Page = "rankings" | "search"

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>("rankings")
  const [returnPage, setReturnPage] = useState<Page>("search") // where to go after cancel
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Album[]>([])
  const [ranked, setRanked] = useState<Album[]>([])
  const [loadingRankings, setLoadingRankings] = useState(true)
  const [challenger, setChallenger] = useState<Album | null>(null)
  const [opponent, setOpponent] = useState<Album | null>(null)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Load rankings
  useEffect(() => {
    if (!user) return
    setLoadingRankings(true)
    fetchUserRankings(user.id)
      .then(setRanked)
      .finally(() => setLoadingRankings(false))
  }, [user])

  // Search albums
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) return setResults([])
      const albums = await searchAlbums(query)
      setResults(albums)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Add a new album — kicks off placement matches
  const startComparison = (album: Album) => {
    if (ranked.find(a => a.id === album.id)) return
    setReturnPage("search")
    const newAlbum: Album = { ...album, rating: 1000, comparisons: 0, placementMatches: 6, previousOpponents: [] }
    if (ranked.length === 0) {
      setRanked([newAlbum])
      if (user) saveRanking(user.id, newAlbum)
      setPage("rankings")
      return
    }
    const firstOpponent = pickOpponent(newAlbum, ranked)
    if (!firstOpponent) return
    setChallenger(newAlbum)
    setOpponent(firstOpponent)
  }

  // Re-rank an already-placed album
  const startRefinement = (album: Album) => {
    setReturnPage("rankings")
    const refreshed: Album = { ...album, placementMatches: 5, previousOpponents: [] }
    const firstOpponent = pickOpponent(refreshed, ranked.filter(a => a.id !== album.id))
    if (!firstOpponent) return
    setChallenger(refreshed)
    setOpponent(firstOpponent)
  }

  const resolveMatch = async (score: number) => {
    if (!challenger || !opponent) return
    const [newA, newB] = updateRatings(challenger.rating, opponent.rating, score, challenger.comparisons, opponent.comparisons)
    const updatedChallenger = {
      ...challenger,
      rating: newA,
      comparisons: challenger.comparisons + 1,
      placementMatches: challenger.placementMatches - 1,
      previousOpponents: [...challenger.previousOpponents, opponent.id],
    }
    const updatedOpponent = { ...opponent, rating: newB, comparisons: opponent.comparisons + 1 }

    let updatedRanked = ranked.map(a => a.id === opponent.id ? updatedOpponent : a)

    if (updatedChallenger.placementMatches <= 0) {
      updatedRanked = [...updatedRanked.filter(a => a.id !== updatedChallenger.id), updatedChallenger]
        .sort((a, b) => b.rating - a.rating)
      setRanked(updatedRanked)
      setChallenger(null)
      setOpponent(null)
      setPage("rankings")  // always land on My Albums after ranking completes
      if (user) {
        await saveRanking(user.id, updatedChallenger)
        await saveRanking(user.id, updatedOpponent)
      }
      return
    }

    const nextOpponent = pickOpponent(updatedChallenger, updatedRanked)
    setRanked([...updatedRanked])
    setChallenger(updatedChallenger)
    setOpponent(nextOpponent)
    if (user) {
      await saveRanking(user.id, updatedChallenger)
      await saveRanking(user.id, updatedOpponent)
    }
  }

  const cancelComparison = () => {
    setChallenger(null)
    setOpponent(null)
    setPage(returnPage)  // back to wherever they came from
  }

  // --- Login screen ---
  if (!user) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cream tracking-tight">Album Ranker</h1>
          <p className="text-taupe mt-2 text-sm">Rank your music, one comparison at a time.</p>
        </div>
        <LoginForm onLogin={setUser} />
      </div>
    )
  }

  // --- Comparison screen ---
  if (challenger && opponent) {
    return (
      <Comparison
        newAlbum={challenger}
        existingAlbum={opponent}
        onBetter={() => resolveMatch(1)}
        onWorse={() => resolveMatch(0)}
        onTie={() => resolveMatch(0.5)}
        onCancel={cancelComparison}
      />
    )
  }

  // --- Main app ---
  return (
    <div className="min-h-screen bg-base font-sans text-cream">
      {/* Nav */}
      <header className="bg-surface border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-bold text-cream tracking-wide shrink-0">Album Ranker</h1>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setPage("rankings")}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                page === "rankings" ? "bg-steel text-white" : "text-taupe hover:text-cream"
              }`}
            >
              My Albums
            </button>
            <button
              onClick={() => setPage("search")}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                page === "search" ? "bg-steel text-white" : "text-taupe hover:text-cream"
              }`}
            >
              Search
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); setUser(null) }}
              className="ml-2 sm:ml-4 text-xs text-taupe/50 hover:text-taupe transition-colors"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      {/* Content — key triggers fade-in animation on every page switch */}
      <main key={page} className="page-transition max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {page === "rankings" && (
          <RankingPage albums={ranked} loading={loadingRankings} onPlayMatches={startRefinement} />
        )}
        {page === "search" && (
          <SearchPage
            query={query}
            onQueryChange={setQuery}
            results={results}
            onCompare={startComparison}
          />
        )}
      </main>
    </div>
  )
}

export default App
