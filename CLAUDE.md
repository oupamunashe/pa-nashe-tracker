# Pa-Nashe Tracker

Household finance web app for Piepie and Munny, a couple in South Africa who pool their income. It replaces their spreadsheet tracker: monthly budgets, quick capture of spends on the phone, a Piepie/Munny split of who pays for what, savings and debt accounts, scenario planning, milestones (trips, events) and Excel export. Currency: South African rand (R).

This is a **faithful port of a working prototype** that ran on claude.ai. The prototype is the source of truth for behaviour, layout, wording and numbers.

Stack: Vite + TypeScript (no UI framework) · Supabase (Postgres JSON documents, Realtime, Auth email + password, Storage) · GitHub Pages via GitHub Actions · PWA with offline outbox.

## Where things are

- `prototype/index.html` – the working prototype (single file).
- `prototype/src/` – the same code split by concern: `core.js` (state, data layer, all calculations), `ui1.js` (shell, Home, Budget, People), `ui2.js` (Accounts, Plan, Year, Milestones, More, Line items), `ui3.js` (sheets and their actions), `io.js` (statement import, Excel export, event wiring, init), `app.css` (design system).
- `prototype/test/` – `mock.js` (in-memory version of the prototype’s database – port it as the MemoryAdapter), `harness.py` and `screenshots.py` (run the prototype headless).
- `docs/SPEC.md` – data model, business rules, screens, design tokens, Supabase/GitHub architecture. Read the relevant section before changing anything.
- `supabase/migrations/0001_init.sql` – the database: already written **and tested**. Don’t weaken it; add new numbered migrations if needed.
- `private/` – **git-ignored**, never commit or copy out of it:
  - `ACCEPTANCE.md` – numbers and flows the port must reproduce to the cent;
  - `DATA-NOTES.md` – names, data facts, PDF asset ids to rewrite;
  - `data/` – the real data backup (production seed), reference seed, `baseline.json`, PDFs;
  - `screenshots/` – 32 reference screens;
  - `statements/`, `tests/test_flows.py`, `tools/`.

## Non-negotiable rules

1. **Parity first.** Port behaviour and UI exactly before improving anything. Ideas go under “Proposed changes” in your phase summary. The only intended differences are listed in SPEC §2 (login, Supabase, offline, file links).
2. **Keep calculation logic intact.** `monthCalc`, `shares`, `peopleCalc`, `balances`, `planCalc`, `yearCalc`, `msCalc`, `classify`, `personFromText` are verified against real figures. Move and type them; don’t change their logic. If a number differs, find the porting bug.
3. **Deep-merge writes.** `update()` must go through the `doc_merge` RPC (server-side recursive merge). Never read-modify-write a whole document from the client, and never replace a nested map: that silently deletes the other person’s entries. `null` is a tombstone meaning deleted.
4. **The repository is public** (GitHub Pages). Nothing from `private/`, no real names, emails, amounts, statements or keys may be committed or hard-coded. Tests read expected numbers from `private/data/baseline.json` at runtime and skip cleanly when `private/` is absent.
5. **Secrets.** Only the Supabase URL and anon key reach the browser (as `VITE_` variables). The service-role key is for the local seed script only, from `.env.local`.
6. **Only the two members** can read or write. Row-level security enforces it in the database; the UI also blocks non-members.
7. **Money**: numbers in rand, `r2()` before every write, `fmt()` for display (`R1,234.56`, negatives `–R1,234.56`).
8. **People colours**: Piepie lavender `#dfc5fe` (text on it `#4B2A78`), Munny light brown `#ae8774` (text on it `#3B261C`). Buttons say only “Piepie” and “Munny”.
9. **Browser storage**: `localStorage` only for small per-device preferences, always in try/catch; IndexedDB for the offline cache and outbox.
10. **Copy**: reuse the prototype’s wording – plain, sentence case, from the users’ point of view.

## Environment

- The project folder path contains spaces, so always quote paths in shell commands.
- `.env.local` (never committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase free plan: a project pauses after about a week with no activity and can be restored from the dashboard.

## Commands (keep this list up to date as you add scripts)

- `npm run dev` – app against the real Supabase project (reads `.env.local`)
- `npm run dev:demo` – app on the MemoryAdapter with `private/data/seed-reference/backup.json` (no login)
- `npm run dev:demo` with `?synthetic` – same, on the fake fixture `tests/fixtures/synthetic-backup.json`; `?me=M` to act as Munny
- `npm test` – Vitest (calculations, adapter, merge) + Playwright flows on the MemoryAdapter
- `npm run test:unit` / `npm run test:e2e` – one half only; `PN_NO_PRIVATE=1` simulates a checkout without `private/` (CI)
- `npm run typecheck` – `tsc --noEmit`
- `npm run seed -- private/data/live-backup-2026-10-02.json` – load a backup into Supabase (asks for confirmation; uploads PDFs; rewrites asset ids)
- `npm run check` – read-only health check of the Supabase project (sign-up off, members, RLS, counts; prints no emails or figures)
- `npm run seed -- <backup.json> --yes` – same as above without the question (only when the owners have said so)
- `npm run build` – production build; deployment happens via GitHub Actions on push to `main` (`.github/workflows/deploy.yml`: typecheck, tests, secret check, build, Pages). Live: https://oupamunashe.github.io/pa-nashe-tracker/
- `npm run build && npm run preview` – the production build locally (service worker, installable) at http://localhost:4173/pa-nashe-tracker/
- `npm run icons` – regenerate the PWA icons in `public/` from the logo dot
- Pushing a change to `.github/workflows/` needs a GitHub token with the `workflow` scope

## Working style

- Plan before coding; follow the phases in `PROMPT.md` and stop for review at the end of each phase.
- After each phase run the tests and compare screenshots with `private/screenshots/` at 390×844 and 1360×900.
- Small, focused commits with clear messages. Before every commit, check `git status` to make sure nothing from `private/` or `.env*` is staged.
