import { useState, useEffect, useRef } from "react"
import type { Album } from "./types/Album"
import { supabase } from "./services/supabaseClient"
import { searchAlbums } from "./services/musicbrainz"
import { fetchUserRankings, saveRanking, deleteRanking } from "./services/rankingsApi"
import { fetchProfile, upsertProfile } from "./services/profilesApi"
import { updateRatings } from "./services/elo"
import { pickOpponent, pickRankedPlayPair } from "./services/matchmaking"

import RankingPage from "./components/RankingPage"
import SearchPage from "./components/SearchPage"
import Comparison from "./components/Comparison"
import LoginForm from "./components/LoginForm"
import ProfilePage from "./components/ProfilePage"
import FriendsPage from "./components/FriendsPage"
import type { User } from "@supabase/supabase-js"
import { fetchPendingRequests } from "./services/friendsApi"

type Page = "rankings" | "search" | "friends" | "profile"

function ResetPasswordForm({ onDone }: { onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const inputClass =
    "px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/50 focus:outline-none focus:border-steel transition-colors"

  async function handleReset() {
    setError("")
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.")
    if (newPassword !== confirmPassword) return setError("Passwords don't match.")
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) return setError(error.message)
    setSuccess(true)
    setTimeout(onDone, 1500)
  }

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-cream tracking-tight">Album Ranker</h1>
        <p className="text-taupe mt-2 text-sm">Set your new password</p>
      </div>
      <div className="flex flex-col gap-3 w-72">
        {success ? (
          <p className="text-powder text-sm text-center">Password updated. Signing you in…</p>
        ) : (
          <>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReset()}
              className={inputClass}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleReset}
              disabled={loading}
              className="py-2.5 rounded-lg bg-steel text-white font-medium hover:bg-powder transition-colors disabled:opacity-40"
            >
              {loading ? "Updating…" : "Set new password"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>("rankings")
  const [returnPage, setReturnPage] = useState<Page>("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Album[]>([])
  const [ranked, setRanked] = useState<Album[]>([])
  const [loadingRankings, setLoadingRankings] = useState(true)
  const [challenger, setChallenger] = useState<Album | null>(null)
  const [opponent, setOpponent] = useState<Album | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [rankedPlayMode, setRankedPlayMode] = useState(false)
  const [pendingFriendCount, setPendingFriendCount] = useState(0)
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false)

  const resolving = useRef(false)
  const recentPlayPairs = useRef(new Set<string>())

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (_e === "PASSWORD_RECOVERY") {
        setPasswordRecoveryMode(true)
        setUser(session?.user ?? null)
      } else {
        setUser(session?.user ?? null)
      }
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
    if (user.email) upsertProfile(user.id, { email: user.email })
    fetchPendingRequests(user.id).then(reqs => setPendingFriendCount(reqs.length))
  }, [user])

  // Search with debounce + abort
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const albums = await searchAlbums(query, controller.signal)
      if (!controller.signal.aborted) setResults(albums)
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const goToSearch = () => setPage("search")

  // Add a new album — kicks off placement matches
  const startComparison = async (album: Album) => {
    if (ranked.find(a => a.id === album.id)) return
    setReturnPage("search")
    const matchCount = Math.min(6, ranked.length)
    const newAlbum: Album = { ...album, rating: 1000, comparisons: 0, placementMatches: matchCount, previousOpponents: [] }
    if (ranked.length === 0) {
      setRanked([newAlbum])
      if (user) await saveRanking(user.id, newAlbum)
      setPage("rankings")
      setQuery("")
      setResults([])
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
    if (resolving.current) return
    resolving.current = true
    try {
      if (!challenger || !opponent) return

      if (rankedPlayMode) {
        const [newA, newB] = updateRatings(challenger.rating, opponent.rating, score, challenger.comparisons, opponent.comparisons)
        const updatedA = { ...challenger, rating: newA, comparisons: challenger.comparisons + 1 }
        const updatedB = { ...opponent, rating: newB, comparisons: opponent.comparisons + 1 }

        const updatedRanked = ranked
          .map(a => a.id === updatedA.id ? updatedA : a.id === updatedB.id ? updatedB : a)
          .sort((a, b) => b.rating - a.rating)

        const pairKey = [challenger.id, opponent.id].sort().join("|")
        recentPlayPairs.current.add(pairKey)
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
        if (returnPage === "search") { setQuery(""); setResults([]) }
        if (user) {
          await saveRanking(user.id, updatedChallenger)
          await saveRanking(user.id, updatedOpponent)
        }
        return
      }

      const nextOpponent = pickOpponent(updatedChallenger, updatedRanked)
      setRanked(updatedRanked)
      setChallenger(updatedChallenger)

      if (!nextOpponent) {
        setOpponent(null)
        setChallenger(null)
        setPage(returnPage)
        if (returnPage === "search") { setQuery(""); setResults([]) }
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
      setRanked(prev => prev.filter(a => a.id !== challenger.id))
      if (user) deleteRanking(user.id, challenger.id)
    }
    setChallenger(null)
    setOpponent(null)
    setPage(returnPage)
  }

  // --- Password recovery screen ---
  if (passwordRecoveryMode) {
    return <ResetPasswordForm onDone={() => setPasswordRecoveryMode(false)} />
  }

  // --- Login screen ---
  if (!user) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-cream tracking-tight">Album Ranker</h1>
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
      {/* Top nav */}
      <header className="bg-surface border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-bold text-cream tracking-wide">Album Ranker</h1>

          {/* Desktop nav — text tabs with underline active state */}
          <nav className="hidden sm:flex items-center gap-6">
            {(["rankings", "search", "friends"] as Page[]).map(p => {
              const labels: Record<string, string> = { rankings: "My Albums", search: "Search", friends: "Friends" }
              return (
                <button
                  key={p}
                  onClick={() => {
                    if (p === "rankings") { setQuery(""); setResults([]) }
                    setPage(p)
                  }}
                  className={`relative text-sm font-medium pb-0.5 transition-colors border-b ${
                    page === p ? "text-cream border-cream/40" : "text-taupe/60 border-transparent hover:text-cream"
                  }`}
                >
                  {labels[p]}
                  {p === "friends" && pendingFriendCount > 0 && (
                    <span className="absolute -top-1 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-steel text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {pendingFriendCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Profile avatar — desktop only */}
          <button
            onClick={() => setPage("profile")}
            className="hidden sm:flex w-9 h-9 rounded-full bg-steel/20 overflow-hidden items-center justify-center hover:ring-2 hover:ring-steel/40 transition-all shrink-0"
            title="Profile"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              : <span className="text-steel text-xs font-bold">{user.email?.[0].toUpperCase()}</span>
            }
          </button>
        </div>
      </header>

      {/* Content — pb-20 on mobile to clear the bottom tab bar */}
      <main key={page} className="page-transition max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        {page === "rankings" && (
          <RankingPage
            albums={ranked}
            loading={loadingRankings}
            onPlayMatches={startRefinement}
            onDelete={deleteAlbum}
            onStartRankedPlay={startRankedPlay}
            onGoToSearch={goToSearch}
          />
        )}
        {page === "search" && (
          <SearchPage
            query={query}
            onQueryChange={setQuery}
            results={results}
            onCompare={startComparison}
          />
        )}
        {page === "friends" && (
          <FriendsPage
            user={user}
            onPendingCountChange={setPendingFriendCount}
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

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-white/8 flex">
        {/* My Albums */}
        <button
          onClick={() => { setQuery(""); setResults([]); setPage("rankings") }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${page === "rankings" ? "text-cream" : "text-taupe/40"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-[10px] font-medium">My Albums</span>
        </button>

        {/* Search */}
        <button
          onClick={() => setPage("search")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${page === "search" ? "text-cream" : "text-taupe/40"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-[10px] font-medium">Search</span>
        </button>

        {/* Friends */}
        <button
          onClick={() => setPage("friends")}
          className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${page === "friends" ? "text-cream" : "text-taupe/40"}`}
        >
          {pendingFriendCount > 0 && (
            <span className="absolute top-2 right-[calc(50%-14px)] w-2 h-2 rounded-full bg-steel" />
          )}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="text-[10px] font-medium">Friends</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => setPage("profile")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${page === "profile" ? "text-cream" : "text-taupe/40"}`}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
            : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )
          }
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </nav>
    </div>
  )
}

export default App
