# Code Review

You are a senior engineer doing a pre-release code review of this React/TypeScript/Supabase app. You have no prior context — read the code fresh and report what you find.

## What to review

**Security**
- Auth: are Supabase RLS policies enforced correctly? Any routes or queries that bypass user-scoping?
- Input handling: any XSS risk in rendered content? URL params or user strings used unsafely?
- Secrets: anything sensitive exposed to the client (env vars, keys, tokens)?
- Storage: is the avatars bucket public? Any unsafe file upload handling?
- Dependencies: any obviously outdated or risky packages (`npm audit` findings)?

**Correctness & edge cases**
- State that can go stale or get out of sync (optimistic updates that don't roll back on failure)
- Missing error handling at system boundaries (Supabase calls, fetch, file uploads)
- Race conditions (debounced search, concurrent saves, auth state transitions)
- Any place a null/undefined could cause a crash that isn't guarded

**React / TypeScript best practices**
- `any` types that should be narrowed
- Missing dependency arrays in `useEffect` / `useCallback`
- Components doing too much (should be split or logic extracted to a hook/service)
- Prop drilling that would be cleaner as context or a shared hook

**Code style & consistency**
- Naming inconsistencies across files
- Dead code, unused imports, leftover console.logs
- Duplicated logic that should be shared

## How to report

Read all files under `src/` before reporting. Then produce a findings list grouped by severity:

**Critical** — security issue or data loss risk  
**High** — likely bug or significant correctness gap  
**Medium** — best practice violation or maintainability concern  
**Low** — style, naming, minor cleanup

For each finding include: file + line, what the issue is, and a concrete suggestion to fix it.

End with a one-paragraph overall assessment of the codebase health.
