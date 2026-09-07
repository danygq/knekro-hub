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

// createClient throws synchronously on an invalid URL, which would crash every
// page at import time while the integration env vars are still provisioning.
// Fall back to a syntactically valid placeholder so the app can render; real
// queries against it will simply fail (and are already handled defensively
// by callers) until the real credentials are available.
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
);
