import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client initialized with the service role key.
 * Used exclusively for administrative operations (such as webhook event processing)
 * where Row Level Security bypass is required.
 *
 * NEVER expose this client or its credentials to browser-facing code.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.PUBLIC_SUPABASE_URL) ||
    process.env.PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    (typeof import.meta !== "undefined" &&
      import.meta.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin environment variables: PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
