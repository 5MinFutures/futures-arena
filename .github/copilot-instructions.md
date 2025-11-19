<!--
AI coding assistant instructions for the Futures Arena repository.
Keep this file concise and actionable. Reference specific files and commands.
-->

# Copilot / AI Agent Instructions — Futures Arena

Purpose: Help an AI agent be immediately productive in this React + TypeScript + Vite app.

- **Project root:** `package.json`, `vite.config.ts`, `tsconfig.*`
- **Frontend entry:** `src/main.tsx` -> `src/App.tsx`
- **DB client:** `src/supabaseClient.ts` (throws if env vars missing)
- **CSV / metrics code:** `src/utils/dataUtils.ts` (parsing & metric calculations)
- **State & domain logic:** `src/hooks/*` (`useMetrics.ts`, `usePortfolio.ts`, `useSorting.ts`)
- **UI components:** `src/components/*` (small, focused presentational + control components)
- **Developer docs:** `dev-docs/` (migration plans, project overview)

Quick operational facts
- Run dev server: `npm run dev` (Vite on port 8080 by default)
- Build: `npm run build` (note: runs `tsc -b` then `vite build`)
- Lint: `npm run lint`
- Preview production build: `npm run preview`

Environment & integrations
- The app requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env` at the project root. `src/supabaseClient.ts` will throw at import-time if they are missing — set these before running or editing code that imports the client.
- Supabase schema: tables expected are `portfolios`, `strategies`, `trades`, `portfolio_strategies`. See `dev-docs/supabase-migration-plan.md` for details.

Where to make changes (practical examples)
- To modify how trades are fetched/structured, inspect `src/App.tsx` -> `fetchFromSupabase`. It deliberately fetches strategies first, then trades per-strategy to avoid nested query limits (see `.limit(10000)`). Keep that pattern unless you also change backend/paging.
- To change CSV parsing or metric calculations, edit `src/utils/dataUtils.ts`. Many UI features rely on the shape produced there (headers: `Date/Time`, `Profit/Loss`, `Cum Net Profit`).
- To add UI controls, follow existing component patterns in `src/components/` (props-driven, typed components). Use existing hooks in `src/hooks/` for business logic where possible.

Conventions and patterns
- Prefer small focused hooks in `src/hooks/` to hold domain logic (metrics, portfolios, sorting) and keep components presentational.
- File naming: components and hooks use `.tsx` / `.ts` with explicit extensions in imports (e.g., `import Header from './components/Header.tsx'`). Preserve this style.
- The repo uses TypeScript project references; builds run `tsc -b` before bundling. Avoid changing `tsconfig.*` without testing `npm run build`.

Edge-cases & gotchas
- `supabaseClient.ts` throws when env is missing — importing it in tests or scripts without env will crash. Prefer mocking the client or guard imports when writing tests.
- Large DB loads: `fetchFromSupabase` uses per-strategy trade queries with `.limit(10000)` and client-side transforms. If changing to server-side joins, coordinate with `dev-docs/supabase-migration-plan.md`.
- Filename convention for CSV uploads: `{market}_{direction}_{portfolio_hint}_{strategy_name}.csv` (see README). Code expects market/direction hints when inferring metadata.

Developer workflow tips
- Local dev: copy `.env.example` -> `.env`, set supabase values, then `npm install` and `npm run dev`.
- If you change TypeScript types or `tsconfig.*`, run `npm run build` to catch type-checking errors early.
- Use `dev-docs/project-overview.md` for high-level architecture and `dev-docs/supabase-migration-plan.md` when touching DB schema or import scripts.

Pull request guidance for AI-generated changes
- Keep changes minimal and focused per PR (one feature/bugfix per PR).
- Add a short description of why the change was made and list files changed (helpful for reviewers).
- If touching DB fetch logic, include a short note about expected table sizes and any new limits or indexes required.

If uncertain, inspect these files first
- `src/App.tsx` — overall flow: uploads, cleanedData shape, `fetchFromSupabase`, and how UI toggles features.
- `src/utils/dataUtils.ts` — CSV parsing, currency handling, metrics.
- `src/supabaseClient.ts` — env var checks and Supabase client creation.
- `dev-docs/` — migration and architecture notes.

Questions for the maintainer (ask in PR description)
- Do you want the React Compiler enabled in production? (README notes it is disabled.)
- Should `fetchFromSupabase` support pagination instead of `.limit(10000)` for very large datasets?

End.
