import { createClient } from "@supabase/supabase-js";

// Client-exposed values: prefer NEXT_PUBLIC_* (Vercel/Supabase integration).
// Fall back to server-side process.env names when running on the server.
const SUPABASE_URL =
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ??
  (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined);
const SUPABASE_ANON_KEY =
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
  (typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (or server fallbacks) is not set. Supabase client may fail.",
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");

// Server-side helper: create a Supabase client with the secret key (do NOT expose the secret to the client).
// This function reads SUPABASE_SECRET_KEY from process.env at call-time to avoid accidental bundling.
export function createServerSupabase(supabaseSecretKey?: string) {
  const secret = supabaseSecretKey ?? (typeof process !== "undefined" ? process.env.SUPABASE_SECRET_KEY : undefined);
  const url = (typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined) ?? SUPABASE_URL;

  if (!secret) throw new Error("SUPABASE_SECRET_KEY is required for server-side client");
  if (!url) throw new Error("SUPABASE_URL is required to create a server-side Supabase client");

  return createClient(url, secret);
}
