import { createClient } from "@supabase/supabase-js";
import {
  type CookieStore,
  createSupabaseServerClient,
  isSessionExpiredError,
} from "./createSupabaseServerClient";

export { createSupabaseServerClient, isSessionExpiredError, type CookieStore };

/**
 * Re-export createDbClient as alias for createSupabaseServerClient for backwards compatibility.
 *
 * Use this single client for both auth and data queries so that every
 * request carries the user's JWT and respects Row Level Security policies.
 *
 * @param request - Astro.request (pages) or the `request` param (API routes)
 * @param cookieStore - Astro.cookies (pages) or the `cookies` param (API routes)
 */
export const createDbClient = createSupabaseServerClient;

/**
 * Browser-side Supabase client for direct DB operations from client <script>
 * blocks. Uses the publishable key — safe for the browser when RLS policies
 * are in place.
 *
 * For writes, the caller must first sync the SSR auth session via
 * `supabaseClient.auth.setSession(session)` so the user's JWT is attached
 * and RLS policies apply.
 */
export const supabaseClient = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-anon-key",
);
