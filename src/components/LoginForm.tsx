import { supabase } from "../services/supabaseClient"
import { useState } from "react"

export default function LoginForm({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError("")
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    onLogin(data.user)
  }

  return (
    <div className="flex flex-col gap-3 w-72">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/50 focus:outline-none focus:border-steel transition-colors"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleLogin()}
        className="px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/50 focus:outline-none focus:border-steel transition-colors"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="py-2.5 rounded-lg bg-steel text-white font-medium hover:bg-powder transition-colors disabled:opacity-40"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </div>
  )
}
