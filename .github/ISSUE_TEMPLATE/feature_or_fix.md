---
name: Feature or Fix
about: Propose a new feature, improvement, or bug fix with technical specifications
title: '[type]: Direct description of the change'
labels: ''
assignees: ''
---

## Objective

A brief summary explaining the technical problem or feature request, why it is needed, and the end-state goal from a
fullstack engineering perspective.

## Technical Requirements & Specifications

- **Frontend:** UI component changes, routing, local/global state management, and user interaction logic.
- **Backend / API:** Required endpoints, query params, request/response payload structures, status codes, and
  middleware.
- **Database & Types:** Required schema updates, migration notes, and TypeScript interface definitions to add or update.

## Implementation Details

Concrete, step-by-step engineering plan and action items (NO checkboxes — use bullet points or numbered lists):

* **Task 1: [Component / Area]**
    * Specific logic to implement, state handling, and error differentiation.
* **Task 2: [Backend / Data Layer / Helper Extraction]**
    * Helpers/utilities to create or parameterize, payload mappings, and auth/cookie handling.
* **Task 3: [Refactoring & Patterns]**
    * Surrounding code cleanup, reusability enhancements, backward compatibility safeguards.

## Impacted Codebase & File Boundaries

- **Target Files:** List specific files or directories to modify or create with a brief note on expected changes.
- **Out of Scope:** Explicitly list adjacent features or files that must remain untouched to prevent regressions.

## Acceptance Criteria

Bulleted, testable conditions (NO checkboxes) defining complete implementation:

- Endpoint returns the expected payload format and handles invalid inputs gracefully.
- Component handles visual loading, error, and empty states.
- Shared types are exported and updated across frontend and backend boundaries.
