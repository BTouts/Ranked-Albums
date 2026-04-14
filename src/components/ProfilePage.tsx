import { useState, useEffect, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import { fetchProfile, upsertProfile, uploadAvatar, updatePassword } from "../services/profilesApi"

type Props = {
  user: User
  onSignOut: () => void
  onBack: () => void
  onAvatarChange?: (url: string | null) => void
}

export default function ProfilePage({ user, onSignOut, onBack, onAvatarChange }: Props) {
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfile(user.id).then(p => {
      if (p) {
        setDisplayName(p.displayName ?? "")
        setAvatarUrl(p.avatarUrl)
      }
    })
  }, [user.id])

  const initials = (displayName || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join("")

  const handleSaveName = async () => {
    setSavingName(true)
    setNameMsg(null)
    try {
      await upsertProfile(user.id, { displayName })
      setNameMsg({ ok: true, text: "Saved." })
    } catch {
      setNameMsg({ ok: false, text: "Failed to save." })
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) {
      setNameMsg({ ok: false, text: "Please upload a JPEG, PNG, WebP, or GIF." })
      return
    }
    setUploadingAvatar(true)
    try {
      const url = await uploadAvatar(user.id, file)
      await upsertProfile(user.id, { avatarUrl: url })
      setAvatarUrl(url)
      onAvatarChange?.(url)
    } catch (err: any) {
      console.error("Avatar upload error:", err)
      const msg = err?.message ?? err?.error_description ?? "Unknown error"
      setNameMsg({ ok: false, text: `Avatar upload failed: ${msg}` })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSavePassword = async () => {
    if (!newPassword) return
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "Passwords don't match." })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, text: "Password must be at least 6 characters." })
      return
    }
    setSavingPassword(true)
    setPasswordMsg(null)
    try {
      await updatePassword(newPassword)
      setNewPassword("")
      setConfirmPassword("")
      setPasswordMsg({ ok: true, text: "Password updated." })
    } catch (err: any) {
      setPasswordMsg({ ok: false, text: err.message ?? "Failed to update password." })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-8 py-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-taupe/60 hover:text-taupe text-sm transition-colors self-start"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => avatarInputRef.current?.click()}
          className="relative group w-20 h-20 rounded-full overflow-hidden bg-steel/20 flex items-center justify-center"
          disabled={uploadingAvatar}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-steel text-xl font-bold">{initials}</span>
          )}
          {/* Hover overlay for desktop */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs">{uploadingAvatar ? "…" : "Change"}</span>
          </div>
          {/* Camera badge — always visible, signals it's tappable on mobile */}
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-steel flex items-center justify-center border-2 border-base">
            {uploadingAvatar ? (
              <span className="text-white text-[8px]">…</span>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </div>
        </button>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <p className="text-taupe/50 text-sm">{user.email}</p>
      </div>

      {/* Display name */}
      <div className="flex flex-col gap-2">
        <label className="text-taupe/60 text-xs tracking-widest uppercase">Display Name</label>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="w-full px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/40 focus:outline-none focus:border-steel transition-colors"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveName}
            disabled={savingName}
            className="px-4 py-2 rounded-lg bg-steel text-white text-sm font-medium hover:bg-powder transition-colors disabled:opacity-40"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
          {nameMsg && (
            <span className={`text-xs ${nameMsg.ok ? "text-powder" : "text-red-400"}`}>{nameMsg.text}</span>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <label className="text-taupe/60 text-xs tracking-widest uppercase">Change Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="New password"
          className="w-full px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/40 focus:outline-none focus:border-steel transition-colors"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full px-4 py-2.5 rounded-lg bg-surface2 border border-white/10 text-base text-cream placeholder-taupe/40 focus:outline-none focus:border-steel transition-colors"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSavePassword}
            disabled={savingPassword || !newPassword}
            className="px-4 py-2 rounded-lg bg-steel text-white text-sm font-medium hover:bg-powder transition-colors disabled:opacity-40"
          >
            {savingPassword ? "Updating…" : "Update Password"}
          </button>
          {passwordMsg && (
            <span className={`text-xs ${passwordMsg.ok ? "text-powder" : "text-red-400"}`}>{passwordMsg.text}</span>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div className="pt-4 border-t border-white/5">
        <button
          onClick={onSignOut}
          className="text-sm text-taupe/50 hover:text-taupe transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
