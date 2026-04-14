// src/types/User.ts

export type User = {
    id: string        // Supabase user UUID
    email: string
    createdAt: string
    // optional extra fields if you store profiles
    username?: string
  };