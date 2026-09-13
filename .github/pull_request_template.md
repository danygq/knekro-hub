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

Closes #
