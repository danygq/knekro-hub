import { createClient } from "@supabase/supabase-js";

function getEnv(
  key: "PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY",
): string | undefined {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  try {
    if (key === "PUBLIC_SUPABASE_URL") {
      return import.meta.env.PUBLIC_SUPABASE_URL;
    }
    if (key === "SUPABASE_SERVICE_ROLE_KEY") {
      return import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  } catch {
    // In pure Node.js environments import.meta.env is undefined
  }
  return undefined;
}

/**
 * Server-only Supabase client initialized with the service role key.
 * Used exclusively for administrative operations (such as webhook event processing)
 * where Row Level Security bypass is required.
 *
 * NEVER expose this client or its credentials to browser-facing code.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = getEnv("PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

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
