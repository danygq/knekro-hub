---
module: agent-protocol
owner_area: repo-wide
last_verified_against_commit: 0d27f3f
depends_on: [ agent-onboarding, architecture ]
---

# Protocol: Issues, Git Workflow & Execution

This document defines the protocol for creating issues, branch naming, commit messaging, pull requests, and executing
tasks in this repository. It applies to any AI agent or human contributor and is not tied to any specific model or
tooling.

## Part 1: Issue Creation

When generating new issues, write entirely in English. Create issues that are clear for human developers while providing
machine-optimized precision so any downstream agent can execute the task without ambiguity.

### Rules

- **Strictly No Checkboxes:** Under no circumstances use markdown checkboxes (`[ ]` or `[x]`). Use clean bullet points
  (`*` or `-`) or numbered lists across all sections. Checkboxes in issues create ambiguous completion states and visual
  noise.
- **Mandatory Implementation Details:** Every issue must contain explicit technical implementation details and an action
  plan. Detail concrete logic paths, helper/utility functions to create or adjust, state changes, error handling, and
  architectural notes rather than vague, high-level objectives.
- **Deterministic Precision:** Avoid vague descriptions (e.g., "make it responsive" or "fix styling"). Specify exact
  component names, API endpoints, schema structures, state changes, and file targets.
- **Fullstack Context:** Include clear scope boundaries for both frontend presentation and backend/data logic where
  applicable.

### Standard Issue Template

#### Title

`[type]: Direct description of the change`

Allowed types: `feat`, `fix`, `refactor`, `perf`, `docs`

#### 1. Context & Objective

A brief summary explaining the technical problem or feature request, why it is needed, and the end-state goal from a
fullstack engineering perspective.

#### 2. Technical Requirements & Specifications

- **Frontend:** UI component changes, routing, local/global state management, and user interaction logic.
- **Backend / API:** Required endpoints, query params, request/response payload structures, status codes, and
  middleware.
- **Database & Types:** Required schema updates, migration notes, and TypeScript interface definitions to add or update.

#### 3. Implementation Details

Concrete, step-by-step engineering plan and action items (NO checkboxes — use bullet points or numbered lists):

* **Task 1: [Component / Area]**
  * Specific logic to implement, state handling, and error differentiation.
* **Task 2: [Backend / Data Layer / Helper Extraction]**
  * Helpers/utilities to create or parameterize, payload mappings, and auth/cookie handling.
* **Task 3: [Refactoring & Patterns]**
  * Surrounding code cleanup, reusability enhancements, backward compatibility safeguards.

#### 4. Impacted Codebase & File Boundaries

- **Target Files:** List specific files or directories to modify or create with a brief note on expected changes.
- **Out of Scope:** Explicitly list adjacent features or files that must remain untouched to prevent regressions.

#### 5. Acceptance Criteria

Bulleted, testable conditions (NO checkboxes) defining complete implementation:

- Endpoint returns the expected payload format and handles invalid inputs gracefully.
- Component handles visual loading, error, and empty states.
- Shared types are exported and updated across frontend and backend boundaries.

---

## Part 2: Branching Strategy & Naming Conventions

All feature and fix branches diverge from `main` and merge back into `main` via Pull Request. Keep branches short-lived
and focused on a single issue or scope.

### Naming Conventions

Branch names use all lowercase, kebab-case:

- **Branches linked to an issue:** `<type>/<issue-number>-<short-description>`
  - Examples: `feat/31-refactor-twitch-auth`, `feat/29-sticky-filter-panel`, `feat/33-mobile-navigation`,
    `fix/42-session-redirect`
- **Direct / standalone branches (docs or tooling):** `<type>/<short-description>`
  - Examples: `docs/agent-protocol-update`, `chore/bump-astro-deps`

### Allowed Types

| Type        | Usage                                         |
|-------------|-----------------------------------------------|
| `feat/`     | New feature or capability                     |
| `fix/`      | Bug fix or patch                              |
| `docs/`     | Documentation additions or updates            |
| `refactor/` | Code restructuring without behavioral changes |
| `perf/`     | Performance optimizations                     |
| `chore/`    | Tooling, dependencies, or maintenance         |

### Rules

- **Do NOT use `v0/...`:** `v0/` branch prefixes are strictly prohibited.
- **Lowercase & Hyphenated:** Always use kebab-case (`feat/31-refactor-twitch-auth`, never camelCase or snake_case).
- **Issue Reference:** Include the issue number in the branch name when working on an existing issue.

---

## Part 3: Commit Message Conventions

This repository strictly adheres to the [Conventional Commits](https://www.conventionalcommits.org/) specification.
Commit messages must be concise, written in English, and clearly convey the scope and nature of the change.

### Format

```
<type>(<scope>): <short description> (#<issue-number>)
```

The issue reference is optional for standalone changes, but encouraged when delivering an issue.

Examples:

- `feat(auth): preserve route location on login and handle expired sessions (#31)`
- `fix(auth): preserve redirect destination via cookie to prevent OAuth redirect mismatch`
- `docs(agents): update onboarding guide with skills directory and protocols`
- `feat(navigation): add responsive mobile menu and fix layout markup (#33)`
- `refactor(games): simplify GameCard code and unify formatting across components`

### Allowed Types

- `feat`: A new feature or capability.
- `fix`: A bug fix.
- `docs`: Documentation updates.
- `refactor`: Code changes that neither fix a bug nor add a feature.
- `perf`: Performance improvements.
- `style`: Markup/styling adjustments, formatting (no logic change).
- `chore`: Tooling, build config, or dependency updates.

### Scopes

Scopes align with repository modules and functional boundaries:

- `auth`: Twitch OAuth, session management, cookie handling.
- `games`: Game catalogue, filter menu, search, cards, voting.
- `goty`: GOTY awards section, voting, categories.
- `navigation`: Navbar, mobile drawer, links.
- `ui`: Shared UI primitives, Layout, styling, design tokens.
- `data-layer`: Supabase client factories, queries, db models.
- `agents`: AI instructions, onboarding docs, skills, agent protocols.
- `docs`: Repository documentation in `docs/` or ADRs.

### Commit Rules

- **Imperative Mood:** Write in imperative present tense ("add", "fix", "refactor" — not "added", "fixes",
  "refactoring").
- **Lowercase Summary:** Start the description with a lowercase letter (unless starting with a proper noun or code
  symbol).
- **No Trailing Period:** Do not end the commit subject with a period.
- **No Checkboxes in Bodies:** If a multi-line commit body is needed to explain rationale, use clean bullet points (`*`
  or `-`). Never use checkboxes.

---

## Part 4: Pull Request Protocol & Template

Pull requests merge branches back into `main`. Every PR should clearly summarize what was done, why, and how it was
verified, linking to any relevant issue.

### Rules

- **Strictly No Checkboxes:** Under no circumstances use markdown checkboxes (`[ ]` or `[x]`) in PR titles,
  descriptions, or templates. Use bullet points (`*` or `-`).
- **Atomic & Focused:** Limit PR scope to the designated issue or feature. Avoid combining unrelated fixes.
- **Link Related Issues:** Use GitHub keywords (`Closes #<id>`, `Fixes #<id>`) in the PR description to automatically
  close the issue on merge.
- **Verification First:** Always verify changes locally (`pnpm run build` and route checks) before opening or merging.

### Standard PR Template

```markdown
### Summary

A concise explanation of what this pull request introduces, fixes, or refactors, and why the change was necessary.

### Changes

- **[scope/module]:** Description of specific technical change.
- **[scope/module]:** Description of specific technical change.

### Implementation Details

Brief notes on key design choices, helper extractions, edge case handling, or architectural decisions made during
development (NO checkboxes).

### Verification

Bulleted notes on local verification performed (NO checkboxes):

- Ran `pnpm run build` — verified SSR build succeeds with zero type/bundling errors.
- Loaded affected routes (`/games`, `/auth/callback`, etc.) and confirmed expected behavior.
- Verified error handling and edge cases (e.g., expired sessions, missing params).

### Related Issues

Closes #<issue-number>
```

---

## Part 5: Issue Execution & Proportional Approach

When executing an assigned issue, approach it with a level of rigor proportional to its complexity. For simple tasks
(e.g., UI tweaks, documentation, small fixes), you can proceed directly to implementation. For complex changes (e.g.,
new features, architectural refactors, DB schema changes), follow the recommended steps below.

### Recommended Steps for Complex Changes

#### Step 1: Deep Issue & Scope Review

- Read the entire issue specification carefully before modifying files.
- Map out the end-to-end data flow (database → backend services → API contract → frontend state → rendering).
- Identify edge cases, missing error boundaries, or potential security implications.

#### Step 2: Codebase Audit & Reuse Discovery

- **Audit Existing Code First:** Search the existing codebase for pre-existing utility functions, UI primitives, hooks,
  database helpers, or API abstractions before writing new code.
- **Avoid Duplication:** If existing logic solves part of the issue, reuse or parameterize it rather than duplicating
  code.

#### Step 3: Refactoring & Architecture Assessment

- **Refactor for Reusability:** If creating a new helper function or component, design it generically so future features
  can reuse it cleanly.
- **Enhance Surrounding Patterns:** Inspect surrounding code for minor code-smells, outdated patterns, or redundant
  logic within the immediate scope. Safely refactor them to align with modern project standards.
- **Maintain Backwards Compatibility:** Ensure refactored primitives do not break existing modules or components
  elsewhere in the application.

#### Step 4: Implementation & Verification

- Implement the changes adhering to established project conventions (naming rules, type safety, directory structures).
- Verify every Acceptance Criterion listed in the issue step-by-step.
- Confirm all touched code is self-documenting and typed correctly.
