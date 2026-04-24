import { useState, useEffect, useRef } from "react"
import type { Album } from "./types/Album"
import { supabase } from "./services/supabaseClient"
import { searchAlbums } from "./services/musicbrainz"
import { fetchUserRankings, saveRanking, deleteRanking } from "./services/rankingsApi"
import { fetchProfile } from "./services/profilesApi"
import { updateRatings } from "./services/elo"
import { pickOpponent, pickRankedPlayPair } from "./services/matchmaking"

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [rankedPlayMode, setRankedPlayMode] = useState(false)

  // H1: guard against double-invocation from fast keyboard input
  const resolving = useRef(false)
  const recentPlayPairs = useRef(new Set<string>())

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

  // Load rankings + profile
  useEffect(() => {
    if (!user) return
    setLoadingRankings(true)
    fetchUserRankings(user.id)
      .then(setRanked)
      .finally(() => setLoadingRankings(false))
    fetchProfile(user.id).then(p => setAvatarUrl(p?.avatarUrl ?? null))
  }, [user])

  // H4: AbortController cancels in-flight search when query changes
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const albums = await searchAlbums(query, controller.signal)
      if (!controller.signal.aborted) setResults(albums)
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  // Add a new album — kicks off placement matches
  const startComparison = async (album: Album) => {
    if (ranked.find(a => a.id === album.id)) return
    setReturnPage("search")
    const matchCount = Math.min(6, ranked.length)
    const newAlbum: Album = { ...album, rating: 1000, comparisons: 0, placementMatches: matchCount, previousOpponents: [] }
    if (ranked.length === 0) {
      setRanked([newAlbum])
      if (user) await saveRanking(user.id, newAlbum) // L4: await so first album is persisted
      setPage("rankings")
      return
    }
    const firstOpponent = pickOpponent(newAlbum, ranked)
    if (!firstOpponent) return
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

  const startRankedPlay = () => {
    recentPlayPairs.current.clear()
    setReturnPage("rankings")
    setRankedPlayMode(true)
    const pair = pickRankedPlayPair(ranked, recentPlayPairs.current)
    if (!pair) return
    const [a, b] = pair
    setChallenger({ ...a, previousOpponents: [] })
    setOpponent(b)
  }

  const resolveMatch = async (score: number) => {
    // H1: prevent stale closure data corruption from fast double-input
    if (resolving.current) return
    resolving.current = true
    try {
      if (!challenger || !opponent) return

      // Ranked Play: endless mode — update both albums, pick next pair, never end automatically
      if (rankedPlayMode) {
        const [newA, newB] = updateRatings(challenger.rating, opponent.rating, score, challenger.comparisons, opponent.comparisons)
        const updatedA = { ...challenger, rating: newA, comparisons: challenger.comparisons + 1 }
        const updatedB = { ...opponent, rating: newB, comparisons: opponent.comparisons + 1 }

        const updatedRanked = ranked
          .map(a => a.id === updatedA.id ? updatedA : a.id === updatedB.id ? updatedB : a)
          .sort((a, b) => b.rating - a.rating)

        const pairKey = [challenger.id, opponent.id].sort().join("|")
        recentPlayPairs.current.add(pairKey)
        // Reset after covering ~half the candidate pool so sessions feel fresh
        // Pool size ≈ N * RANK_WINDOW (4); half of that keeps memory reasonable
        const resetThreshold = Math.max(updatedRanked.length * 2, 8)
        if (recentPlayPairs.current.size >= resetThreshold) {
          recentPlayPairs.current.clear()
          recentPlayPairs.current.add(pairKey)
        }

        setRanked(updatedRanked)
        if (user) {
          saveRanking(user.id, updatedA)
          saveRanking(user.id, updatedB)
        }

        const nextPair = pickRankedPlayPair(updatedRanked, recentPlayPairs.current)
        if (!nextPair) {
          setRankedPlayMode(false)
          setChallenger(null)
          setOpponent(null)
          setPage("rankings")
          return
        }
        const [nextA, nextB] = nextPair
        setChallenger({ ...nextA, previousOpponents: [] })
        setOpponent(nextB)
        return
      }

      const [newA, newB] = updateRatings(challenger.rating, opponent.rating, score, challenger.comparisons, opponent.comparisons)
      const updatedChallenger = {
        ...challenger,
        rating: newA,
        comparisons: challenger.comparisons + 1,
        placementMatches: challenger.placementMatches - 1,
        previousOpponents: [...challenger.previousOpponents, opponent.id],
      }
      const updatedOpponent = { ...opponent, rating: newB, comparisons: opponent.comparisons + 1 }

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

      // H2: if no eligible opponent remains, end placement early rather than leaving zombie state
      if (!nextOpponent) {
        setOpponent(null)
        setChallenger(null)
        setPage(returnPage)
      } else {
        setOpponent(nextOpponent)
      }

      if (user) {
        await saveRanking(user.id, updatedChallenger)
        await saveRanking(user.id, updatedOpponent)
      }
    } finally {
      resolving.current = false
    }
  }

  const deleteAlbum = async (album: Album) => {
    if (!user) return
    await deleteRanking(user.id, album.id)
    setRanked(prev => prev.filter(a => a.id !== album.id))
  }

  const cancelComparison = () => {
    if (rankedPlayMode) {
      recentPlayPairs.current.clear()
      setRankedPlayMode(false)
    } else if (challenger && returnPage === "search") {
      // Always remove and delete an album that was added from search but never fully placed
      setRanked(prev => prev.filter(a => a.id !== challenger.id))
      if (user) deleteRanking(user.id, challenger.id)
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
        mode={rankedPlayMode ? "ranked-play" : "placement"}
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
              className="ml-2 sm:ml-4 w-9 h-9 rounded-full bg-steel/20 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-steel/50 transition-all shrink-0"
              title="Profile"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                : <span className="text-steel text-xs font-bold">{user.email?.[0].toUpperCase()}</span>
              }
            </button>
          </nav>
        </div>
      </header>

      {/* Content — key triggers fade-in animation on every page switch */}
      <main key={page} className="page-transition max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {page === "rankings" && (
          <RankingPage albums={ranked} loading={loadingRankings} onPlayMatches={startRefinement} onDelete={deleteAlbum} onStartRankedPlay={startRankedPlay} />
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
            onAvatarChange={setAvatarUrl}
          />
        )}
      </main>
    </div>
  )
}

export default App
