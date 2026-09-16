/// <reference path="../.astro/types.d.ts" />

type SupabaseServerClient = ReturnType<
  typeof import("./lib/createSupabaseServerClient").createSupabaseServerClient
>;

declare namespace App {
  interface Locals {
    supabase: SupabaseServerClient;
    user: import("@supabase/supabase-js").User | null;
  }
}

declare module "*.astro" {
  const component: any;
  export default component;
}

