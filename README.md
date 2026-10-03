# Pa-Nashe Tracker

Household budget, savings and spending tracker for Piepie and Munny – a web app you can install on your phone.

**Live:** https://oupamunashe.github.io/pa-nashe-tracker/ · **Install on your phone:** [docs/INSTALL.md](docs/INSTALL.md)

Vite + TypeScript (no framework) · Supabase (Postgres JSON documents, Realtime, Auth, Storage) · GitHub Pages via GitHub Actions · installable PWA with an offline outbox. A faithful port of the prototype in `prototype/`.

| Path | What it is |
|---|---|
| `src/core`, `src/calc` | State, formatting and every calculation, moved verbatim from the prototype |
| `src/data` | Storage adapters (Supabase, in-memory), deep merge, IndexedDB cache and offline outbox |
| `src/auth`, `src/ui`, `src/io` | Sign-in, screens and sheets, statement import, Excel export and backups |
| `tests/` | Vitest (calculations, merge, adapters) and Playwright (acceptance flows, screens, offline) |
| `scripts/` | `seed` (load a backup into Supabase), `check` (project health), `icons` |
| `supabase/` | Database schema (`migrations/0001_init.sql`) and the members template |
| `docs/` | `SPEC.md` (full specification), `INSTALL.md` (phone install guide) |
| `prototype/` | The working prototype the app was ported from |
| `private/` | Real data, PDFs, statements, screenshots and acceptance numbers – **git-ignored, never uploaded** |

Commands are listed in `CLAUDE.md`. Every push to `main` is tested and deployed by `.github/workflows/deploy.yml`.
