/**
 * Profile service — display name, avatar, password change.
 *
 * Requires this table in Supabase (run once in SQL editor):
 *
 *   create table profiles (
 *     id uuid references auth.users(id) on delete cascade primary key,
 *     display_name text,
 *     avatar_url text,
 *     updated_at timestamptz default now()
 *   );
 *   alter table profiles enable row level security;
 *   create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
 *
 * For avatar uploads, create a public Storage bucket named "avatars" in the Supabase dashboard.
 */

import { supabase } from "./supabaseClient"

export type Profile = {
  id: string
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("id", userId)
    .maybeSingle()

  if (error) { console.error("fetchProfile error:", error); return null }
  if (!data) return null

  return { id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url, email: data.email ?? null }
}

export async function upsertProfile(userId: string, updates: { displayName?: string; avatarUrl?: string; email?: string }) {
  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      ...(updates.displayName !== undefined && { display_name: updates.displayName }),
      ...(updates.avatarUrl   !== undefined && { avatar_url: updates.avatarUrl }),
      ...(updates.email       !== undefined && { email: updates.email }),
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${userId}/avatar.${ext}`

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  // Bust cache so the new avatar shows immediately
  return `${data.publicUrl}?t=${Date.now()}`
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
