import { supabase } from "../services/supabaseClient"
import { useState, useRef } from "react"
import { Turnstile } from "@marsidev/react-turnstile"
import type { TurnstileInstance } from "@marsidev/react-turnstile"

type Mode = "signin" | "signup" | "forgot" | "check-email"
type CheckEmailVariant = "signup" | "reset"

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export default function LoginForm({ onLogin }: { onLogin: (user: any) => void }) {
  const [mode, setMode] = useState<Mode>("signin")
  const [checkEmailVariant, setCheckEmailVariant] = useState<CheckEmailVariant>("signup")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const turnstileRef = useRef<TurnstileInstance>(null)

  const resetCaptcha = () => {
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }

  const clearFields = () => {
    setPassword("")
    setConfirmPassword("")
    setError("")
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    clearFields()
    resetCaptcha()
  }

  // When SITE_KEY isn't configured (e.g. local dev without the env var), skip captcha gating
  const captchaReady = !SITE_KEY || !!captchaToken

  async function handleSignIn() {
    if (!captchaReady) return
    setError("")
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: SITE_KEY && captchaToken ? { captchaToken } : undefined,
    })
    setLoading(false)
    if (error) { resetCaptcha(); return setError(error.message) }
    onLogin(data.user)
  }

  async function handleSignUp() {
    if (!captchaReady) return
    setError("")
    if (password.length < 8) return setError("Password must be at least 8 characters.")
    if (password !== confirmPassword) return setError("Passwords don't match.")
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: SITE_KEY && captchaToken ? { captchaToken } : undefined,
    })
    setLoading(false)
    if (error) { resetCaptcha(); return setError(error.message) }
    setCheckEmailVariant("signup")
    setMode("check-email")
  }

  async function handleForgot() {
    if (!captchaReady) return
    setError("")
    if (!email) return setError("Please enter your email address.")
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
      ...(SITE_KEY && captchaToken ? { captchaToken } : {}),
    })
    setLoading(false)
    if (error) { resetCaptcha(); return setError(error.message) }
    setCheckEmailVariant("reset")
    setMode("check-email")
  }

  const inputClass =
    "px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/50 focus:outline-none focus:border-steel transition-colors"

  // Turnstile widget — only rendered when SITE_KEY is configured
  const captchaWidget = SITE_KEY ? (
    <Turnstile
      ref={turnstileRef}
      siteKey={SITE_KEY}
      onSuccess={setCaptchaToken}
      onExpire={resetCaptcha}
      options={{ theme: "dark", size: "flexible" }}
    />
  ) : null

  if (mode === "check-email") {
    return (
      <div className="flex flex-col gap-4 w-72 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-steel/20 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#81A6C6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2 className="text-cream font-semibold">Check your email</h2>
          <p className="text-taupe text-sm">
            {checkEmailVariant === "signup"
              ? "We sent a confirmation link to "
              : "We sent a password reset link to "}
            <span className="text-cream">{email}</span>
          </p>
        </div>
        <button
          onClick={() => switchMode("signin")}
          className="text-sm text-taupe/60 hover:text-taupe transition-colors"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  if (mode === "forgot") {
    return (
      <div className="flex flex-col gap-3 w-72">
        <div className="flex flex-col gap-1 mb-1">
          <p className="text-cream text-sm font-medium">Forgot your password?</p>
          <p className="text-taupe/60 text-xs">Enter your email and we'll send you a reset link.</p>
        </div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleForgot()}
          className={inputClass}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {captchaWidget}
        <button
          onClick={handleForgot}
          disabled={loading || !captchaReady}
          className="py-2.5 rounded-lg bg-steel text-white font-medium hover:bg-powder transition-colors disabled:opacity-40"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <button
          onClick={() => switchMode("signin")}
          className="text-sm text-taupe/60 hover:text-taupe transition-colors"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  if (mode === "signup") {
    return (
      <div className="flex flex-col gap-3 w-72">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSignUp()}
          className={inputClass}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {captchaWidget}
        <button
          onClick={handleSignUp}
          disabled={loading || !captchaReady}
          className="py-2.5 rounded-lg bg-steel text-white font-medium hover:bg-powder transition-colors disabled:opacity-40"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className="text-taupe/50 text-xs text-center">
          Already have an account?{" "}
          <button
            onClick={() => switchMode("signin")}
            className="text-steel hover:text-powder transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    )
  }

  // Sign in (default)
  return (
    <div className="flex flex-col gap-3 w-72">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className={inputClass}
      />
      <div className="flex flex-col gap-1">
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSignIn()}
          className={inputClass}
        />
        <button
          onClick={() => switchMode("forgot")}
          className="text-xs text-taupe/50 hover:text-taupe self-end transition-colors"
        >
          Forgot password?
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {captchaWidget}
      <button
        onClick={handleSignIn}
        disabled={loading || !captchaReady}
        className="py-2.5 rounded-lg bg-steel text-white font-medium hover:bg-powder transition-colors disabled:opacity-40"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-taupe/50 text-xs text-center">
        Don't have an account?{" "}
        <button
          onClick={() => switchMode("signup")}
          className="text-steel hover:text-powder transition-colors"
        >
          Sign up
        </button>
      </p>
    </div>
  )
}
