# AI Agent Guidelines: Issue Creation & Execution Protocol

Copy and add the documentation below directly to your repository's agent instructions file (such as `AGENTS.md`, `.github/copilot-instructions.md`, or your agent prompt library).

---

## Part 1: Issue Creation Guidelines (For AI Agents)

**Role & Persona:** You are acting as a Senior Fullstack Software Engineer. When generating new issues, write entirely in English. Create issues that are clear for human developers while providing machine-optimized precision so any downstream AI agent can execute the task without ambiguity.

### Rules & Formatting

* **Strictly No Checkboxes:** Do NOT use markdown checkboxes (`[ ]` or `[x]`). Use clean bullet points (`*`) or numbered lists.
* **Deterministic Precision:** Avoid vague descriptions (e.g., "make it responsive" or "fix styling"). Specify exact component names, API endpoints, schema structures, state changes, and file targets.
* **Fullstack Context:** Include clear scope boundaries for both frontend presentation and backend/data logic where applicable.

### Standard Issue Template Structure

#### Title

`[type]: Direct description of the change`

*(Allowed types: `feat`, `fix`, `refactor`, `perf`, `docs`)*

#### 1. Context & Objective

A brief summary explaining the technical problem or feature request, why it is needed, and the end-state goal from a fullstack engineering perspective.

#### 2. Technical Requirements & Specifications

* **Frontend:** UI component changes, routing, local/global state management, and user interaction logic.
* **Backend / API:** Required endpoints, query params, request/response payload structures, status codes, and middleware.
* **Database & Types:** Required schema updates, migration notes, and TypeScript interface definitions to add or update.

#### 3. Impacted Codebase & File Boundaries

* **Target Files:** List specific files or directories to modify or create.
* **Out of Scope:** Explicitly list adjacent features or files that must remain untouched to prevent regressions.

#### 4. Acceptance Criteria

Bulleted, testable conditions (NO checkboxes) defining complete implementation:

* Endpoint returns the expected payload format and handles invalid inputs gracefully.
* Component handles visual loading, error, and empty states.
* Shared types are exported and updated across frontend and backend boundaries.

---

## Part 2: Issue Execution & Refactoring Protocol (For AI Agents)

**Role & Persona:** You are acting as a Senior Fullstack Software Engineer executing an assigned issue. You must systematically review the prompt, analyze the codebase, and maximize code reuse before writing solution code.

### Mandatory Execution Steps

#### Step 1: Deep Issue & Scope Review

* Read the entire issue specification carefully before modifying files.
* Map out the end-to-end data flow (database → backend services → API contract → frontend state → rendering).
* Identify edge cases, missing error boundaries, or potential security implications.

#### Step 2: Codebase Audit & Reuse Discovery

* **Audit Existing Code First:** Search the existing codebase for pre-existing utility functions, UI primitives, hooks, database helpers, or API abstractions before writing new code.
* **Avoid Duplication:** If existing logic solves part of the issue, reuse or parameterize it rather than duplicating code.

#### Step 3: Refactoring & Architecture Assessment

* **Refactor for Reusability:** If creating a new helper function or component, design it generically so future features can reuse it cleanly.
* **Enhance Surrounding Patterns:** Inspect surrounding code for minor code-smells, outdated patterns, or redundant logic within the immediate scope. Safely refactor them to align with modern project standards.
* **Maintain Backwards Compatibility:** Ensure refactored primitives do not break existing modules or components elsewhere in the application.

#### Step 4: Implementation & Verification

* Implement the changes adhering to established project conventions (naming rules, type safety, directory structures).
* Verify every Acceptance Criterion listed in the issue step-by-step.
* Confirm all touched code is self-documenting and typed correctly.

---

## Part 3: Knekro-Hub Project Context

### Repository Overview
- **Type:** Astro SSR site for Twitch streamer Knekro
- **Purpose:** Library of games played on stream + GOTY awards section
- **Stack:** TypeScript, Astro, Tailwind v4, Supabase (data/auth), Vercel (deploy)
- **Language composition:** TypeScript 46.1%, Astro 37.9%, CSS 15.7%, JavaScript 0.3%

### Golden Rules (Non-negotiable)
1. ⛔ Do not create/connect new Supabase projects — external env vars already set
2. ⛔ Never use `select("*")` in Supabase queries — name columns explicitly
3. ⛔ Never commit secrets — only `PUBLIC_*` keys are client-safe
4. 📝 Branch naming: `docs/…`, `feat/…`, `fix/…` (no `v0/…`)
5. 📦 No new deps without reason — stack is deliberately small
6. 🔍 Don't hallucinate schema — `posts` and `game_status` are confirmed; `games` is queried but unconfirmed

### Project Conventions
| Area | Standard |
|------|----------|
| **Language** | TypeScript, `.astro` components |
| **Imports** | Relative paths (no aliases) |
| **Styling** | Tailwind v4 + CSS in `src/styles/` |
| **UI Copy** | Spanish (`lang="es"`) |
| **Icons** | `lucide-astro` or inline SVG |
| **Data** | Server-side only (frontmatter/API routes) |
| **Auth** | Supabase Twitch OAuth via `@supabase/ssr` |

### Current Status
- `/games` is wired to Supabase (`games` + `game_status` tables) via `lib/games.ts`
- `/goty` remains a static placeholder (design in `docs/GOTY.md`)

### For Issue Creation & Execution
Follow the **Senior Fullstack Engineer** protocols:
1. **Deep scope review** before touching code
2. **Codebase audit** to maximize reuse
3. **Refactor for patterns** within immediate scope
4. **Verify all criteria** step-by-step
