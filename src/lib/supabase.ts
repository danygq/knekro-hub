// Supabase client initialization
// Uses the PUBLIC_* environment variables exposed to the browser by Astro/Vite.
// For server-only operations (migrations, signed admin actions) use SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Warning here helps catch misconfigured deployments early.
  // Do NOT expose your SERVICE_ROLE key to the client — use server-only routes for privileged operations.
  console.warn('[supabase] PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY is not set. Supabase client may fail.');
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '');

// Optional helper: create a server-side client with the service role key when running in a secure server environment
export function createServerSupabase(serviceRoleKey: string | undefined) {
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side client');
  return createClient(SUPABASE_URL ?? '', serviceRoleKey);
}
