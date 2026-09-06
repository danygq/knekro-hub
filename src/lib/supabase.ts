import { createClient } from "@supabase/supabase-js";

// Client-exposed values: prefer NEXT_PUBLIC_* (Vercel/Supabase integration).
// Fall back to server-side process.env names when running on the server.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY (or server fallbacks) is not set. Supabase client may fail.",
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");
