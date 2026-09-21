// Server-side helpers for role-based access control (RBAC).
// Import this from .astro frontmatter or API routes (SSR). Keep it free of
// `window`/`document` so it never touches the browser.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types";

/**
 * Loads all roles assigned to a user by joining `user_roles` with `roles`.
 */
export async function loadUserRoles(
  client: SupabaseClient,
  userId: string,
): Promise<Role[]> {
  const { data, error } = await client
    .from("user_roles")
    .select("role:roles!role_id(id, name, created_at)")
    .eq("user_id", userId);

  if (error) {
    console.error(`Error loading roles for user ${userId}:`, error);
    return [];
  }

  return (data ?? [])
    .map((row) => (row as unknown as { role: Role | null }).role)
    .filter((r): r is Role => Boolean(r));
}

/**
 * Loads the names of all roles assigned to a given user.
 */
export async function loadUserRoleNames(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("user_roles")
    .select("role:roles!role_id(name)")
    .eq("user_id", userId);

  if (error) {
    console.error(`Error loading role names for user ${userId}:`, error);
    return [];
  }

  return (data ?? [])
    .map(
      (row) => (row as unknown as { role: { name: string } | null }).role?.name,
    )
    .filter((name): name is string => typeof name === "string");
}

/**
 * Checks if a user has a specific role assigned.
 */
export async function userHasRole(
  client: SupabaseClient,
  userId: string,
  roleName: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("user_roles")
    .select("role_id, role:roles!inner(name)")
    .eq("user_id", userId)
    .eq("role.name", roleName)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `Error checking role "${roleName}" for user ${userId}:`,
      error,
    );
    return false;
  }

  return Boolean(data);
}

/**
 * Checks if a user has any of the specified roles assigned.
 */
export async function userHasAnyRole(
  client: SupabaseClient,
  userId: string,
  roleNames: string[],
): Promise<boolean> {
  if (!roleNames.length) return false;

  const { data, error } = await client
    .from("user_roles")
    .select("role_id, role:roles!inner(name)")
    .eq("user_id", userId)
    .in("role.name", roleNames)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `Error checking roles [${roleNames.join(", ")}] for user ${userId}:`,
      error,
    );
    return false;
  }

  return Boolean(data);
}

/**
 * Checks if a user has a specific role ID assigned.
 */
export async function userHasRoleId(
  client: SupabaseClient,
  userId: string,
  roleId: number,
): Promise<boolean> {
  const { data, error } = await client
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .eq("role_id", roleId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `Error checking role ID ${roleId} for user ${userId}:`,
      error,
    );
    return false;
  }

  return Boolean(data);
}

/**
 * Loads all defined system roles.
 */
export async function loadAllRoles(client: SupabaseClient): Promise<Role[]> {
  const { data, error } = await client
    .from("roles")
    .select("id, name, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading all roles:", error);
    return [];
  }

  return data as Role[];
}
