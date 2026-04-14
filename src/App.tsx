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
import ProfilePage from "./components/ProfilePage"
import type { User } from "@supabase/supabase-js"

type Page = "rankings" | "search" | "profile"

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
    // Cap placement matches to number of available opponents (can't play more than you have)
    const matchCount = Math.min(6, ranked.length)
    const newAlbum: Album = { ...album, rating: 1000, comparisons: 0, placementMatches: matchCount, previousOpponents: [] }
    if (ranked.length === 0) {
      setRanked([newAlbum])
      if (user) saveRanking(user.id, newAlbum)
      setPage("rankings")
      return
    }
    const firstOpponent = pickOpponent(newAlbum, ranked)
    if (!firstOpponent) return
    // Add to ranked immediately so it shows up on My Albums during placement
    setRanked(prev => [...prev, newAlbum])
    if (user) saveRanking(user.id, newAlbum)
    setChallenger(newAlbum)
    setOpponent(firstOpponent)
  }

  // Re-rank an already-placed album
  const startRefinement = (album: Album) => {
    setReturnPage("rankings")
    const matchCount = Math.min(5, ranked.filter(a => a.id !== album.id).length)
    const refreshed: Album = { ...album, placementMatches: matchCount, previousOpponents: [] }
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

    // Update both albums in ranked (challenger is already in the list)
    let updatedRanked = ranked.map(a =>
      a.id === updatedChallenger.id ? updatedChallenger :
      a.id === updatedOpponent.id  ? updatedOpponent :
      a
    )

    if (updatedChallenger.placementMatches <= 0) {
      updatedRanked = updatedRanked.sort((a, b) => b.rating - a.rating)
      setRanked(updatedRanked)
      setChallenger(null)
      setOpponent(null)
      setPage("rankings")
      if (user) {
        await saveRanking(user.id, updatedChallenger)
        await saveRanking(user.id, updatedOpponent)
      }
      return
    }

    const nextOpponent = pickOpponent(updatedChallenger, updatedRanked)
    setRanked(updatedRanked)
    setChallenger(updatedChallenger)
    setOpponent(nextOpponent)
    if (user) {
      await saveRanking(user.id, updatedChallenger)
      await saveRanking(user.id, updatedOpponent)
    }
  }

  const cancelComparison = () => {
    // If no matches were played yet, remove the album we just added to ranked
    if (challenger && challenger.comparisons === 0 && returnPage === "search") {
      setRanked(prev => prev.filter(a => a.id !== challenger.id))
    }
    setChallenger(null)
    setOpponent(null)
    setPage(returnPage)
  }

  // --- Login screen ---
  if (!user) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cream tracking-tight">Album Ranker</h1>
          <p className="text-taupe mt-2 text-sm">Rank your music, one comparison at a time.</p>
        </div>
        <LoginForm onLogin={(u) => { setUser(u); setPage("rankings") }} />
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
              onClick={() => { setPage("rankings"); setQuery(""); setResults([]) }}
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
              onClick={() => setPage("profile")}
              className="ml-2 sm:ml-4 w-9 h-9 rounded-full bg-steel/20 text-steel text-xs font-bold flex items-center justify-center hover:bg-steel/30 transition-colors shrink-0"
              title="Profile"
            >
              {user.email?.[0].toUpperCase()}
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
        {page === "profile" && (
          <ProfilePage
            user={user}
            onBack={() => setPage("rankings")}
            onSignOut={async () => { await supabase.auth.signOut(); setUser(null) }}
          />
        )}
      </main>
    </div>
  )
}

export default App
