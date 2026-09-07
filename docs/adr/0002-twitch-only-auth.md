---
module: adr-0002
owner_area: backend
last_verified_against_commit: 56bdfc6
depends_on: [auth]
---

# 0002 — Twitch-only OAuth

**Status:** accepted (inferred from `api/auth/signin.ts`).

**Context:** The user base is Knekro's Twitch community; identity + avatar + display name come from Twitch.

**Decision:** Single provider `signInWithOAuth({ provider: "twitch" })` via Supabase Auth, SSR cookie sessions
(`@supabase/ssr`). No email/password, magic links, or other providers.

**Consequences:** Simple, on-brand login; `user_metadata` (avatar/name) is Twitch-shaped. Adding providers is a
deliberate future decision, not a default — supersede this ADR if that changes.
