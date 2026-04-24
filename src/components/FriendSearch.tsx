import { useState, useEffect, useRef } from "react"
import type { FriendProfile } from "../services/friendsApi"
import { searchProfiles, sendFriendRequest } from "../services/friendsApi"

type Props = {
  currentUserId: string
  friendIds: Set<string>           // accepted friends
  pendingIncomingIds: Set<string>  // people who sent me requests
  pendingSentIds: Set<string>      // people I've sent requests to
  onClose: () => void
  onRequestSent: () => void        // so parent can refresh sent IDs
}

type ResultStatus = "none" | "friends" | "pending_sent" | "pending_received"

export default function FriendSearch({
  currentUserId,
  friendIds,
  pendingIncomingIds,
  pendingSentIds,
  onClose,
  onRequestSent,
}: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FriendProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const profiles = await searchProfiles(query, currentUserId)
        setResults(profiles)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, currentUserId])

  const statusFor = (profile: FriendProfile): ResultStatus => {
    if (friendIds.has(profile.id)) return "friends"
    if (pendingIncomingIds.has(profile.id)) return "pending_received"
    if (pendingSentIds.has(profile.id) || sent.has(profile.id)) return "pending_sent"
    return "none"
  }

  const handleSend = async (profile: FriendProfile) => {
    setSending(prev => new Set(prev).add(profile.id))
    try {
      await sendFriendRequest(currentUserId, profile.id)
      setSent(prev => new Set(prev).add(profile.id))
      onRequestSent()
    } catch {
      // swallow — user will see the button is still available to retry
    } finally {
      setSending(prev => { const s = new Set(prev); s.delete(profile.id); return s })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-20 px-4 backdrop-enter"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-md rounded-2xl overflow-hidden modal-enter"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <svg className="text-taupe/40 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 bg-transparent text-cream text-sm placeholder-taupe/40 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-taupe/40 hover:text-taupe transition-colors text-xs">
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {searching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 rounded-full border-2 border-steel border-t-transparent animate-spin" />
            </div>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-taupe/40 text-sm text-center py-8">No users found.</p>
          )}

          {!searching && results.length > 0 && (
            <ul className="divide-y divide-white/5">
              {results.map(profile => {
                const status = statusFor(profile)
                const displayName = profile.displayName ?? profile.email ?? "User"
                const initials = displayName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("")
                return (
                  <li key={profile.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-steel/20 overflow-hidden flex items-center justify-center shrink-0">
                      {profile.avatarUrl
                        ? <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        : <span className="text-steel text-[11px] font-bold">{initials}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-cream text-sm truncate">{displayName}</p>
                      {profile.email && profile.displayName && (
                        <p className="text-taupe/40 text-xs truncate">{profile.email}</p>
                      )}
                    </div>
                    {status === "friends" && (
                      <span className="text-powder text-xs">Friends</span>
                    )}
                    {status === "pending_sent" && (
                      <span className="text-taupe/50 text-xs">Request sent</span>
                    )}
                    {status === "pending_received" && (
                      <span className="text-steel text-xs">Sent you a request</span>
                    )}
                    {status === "none" && (
                      <button
                        onClick={() => handleSend(profile)}
                        disabled={sending.has(profile.id)}
                        className="px-3 py-1.5 rounded-lg bg-steel/20 text-steel text-xs font-medium hover:bg-steel/30 active:scale-95 transition-all disabled:opacity-40"
                      >
                        {sending.has(profile.id) ? "…" : "Add Friend"}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {!searching && query.length < 2 && (
            <p className="text-taupe/30 text-xs text-center py-8">
              Type a name or email to search.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
