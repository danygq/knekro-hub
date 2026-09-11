---
module: agent-protocol
owner_area: repo-wide
last_verified_against_commit: 3b1304b
depends_on: [ agent-onboarding, architecture ]
---

# Agent Protocol: Issue Creation & Execution

This document defines a general protocol for creating and executing issues in this repository. It applies to any AI
agent or human contributor and is not tied to any specific model or tooling.

## Part 1: Issue Creation

When generating new issues, write entirely in English. Create issues that are clear for human developers while providing
machine-optimized precision so any downstream agent can execute the task without ambiguity.

### Rules

- **Strictly No Checkboxes:** Do NOT use markdown checkboxes (`[ ]` or `[x]`). Use clean bullet points (`*`) or numbered
  lists.
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

#### 3. Impacted Codebase & File Boundaries

- **Target Files:** List specific files or directories to modify or create.
- **Out of Scope:** Explicitly list adjacent features or files that must remain untouched to prevent regressions.

#### 4. Acceptance Criteria

Bulleted, testable conditions (NO checkboxes) defining complete implementation:

- Endpoint returns the expected payload format and handles invalid inputs gracefully.
- Component handles visual loading, error, and empty states.
- Shared types are exported and updated across frontend and backend boundaries.

---

## Part 2: Issue Execution & Proportional Approach

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
