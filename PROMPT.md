# Building the Pa-Nashe Tracker with Claude Code

## Part A – one-time setup (about 20 minutes)

### 1. Put the files in your project folder
Open a **new** Terminal tab (Cmd + T) – leave Claude Code running in the other one – and run:

```bash
cd ~/Documents/"OUPA FOLDER"/"Claude Code PNT"
unzip ~/Downloads/pa-nashe-claude-code.zip
ls
```
You should see `CLAUDE.md`, `PROMPT.md`, `README.md`, `docs`, `private`, `prototype`, `supabase`. (If your browser saved the zip somewhere else, change the `~/Downloads/...` path.)

Then copy your three Discovery statement files (the CSV and two Excel files) into `private/statements/`.

### 2. Tools on your Mac
In the same tab: `node -v` should print v20 or higher (if not, install the LTS from https://nodejs.org), and `git --version` should print a version (if macOS offers to install developer tools, accept).

### 3. Supabase (free)
1. Sign up at https://supabase.com → **New project**. Name `pa-nashe-tracker`, a strong database password (save it in your password manager), region closest to South Africa from the list.
2. **SQL Editor → New query**: open `supabase/migrations/0001_init.sql` in a text editor, copy everything, paste, **Run**. It should say “Success”.
3. New query again: paste `supabase/members.example.sql`, replace the two placeholder emails with the emails you’ll sign in with, **Run**.
4. **Authentication → Sign In / Providers**: keep **Email** on; turn **off** “Allow new users to sign up”.
5. **Authentication → Users → Add user → Create new user**: create Piepie’s and Munny’s accounts with the same emails and strong passwords (tick “Auto confirm user”).
6. **Project Settings → API**: keep this page open – Claude Code will ask you for the **Project URL**, the **anon public** key and (for loading your data) the **service_role** key. The service_role key is like a master key: you’ll paste it only into the local `.env.local` file, never into GitHub or chat.

### 4. GitHub (free)
1. On https://github.com → **New repository** → name `pa-nashe-tracker`, **Public** (required for free GitHub Pages – your financial data is not in the code; it stays in Supabase behind your login), no README. Copy the repository URL.
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Repository **Settings → Secrets and variables → Actions → New repository secret**, twice:
   `VITE_SUPABASE_URL` = Project URL, `VITE_SUPABASE_ANON_KEY` = anon public key.
4. Your app will live at `https://YOUR-GITHUB-USERNAME.github.io/pa-nashe-tracker/`. In Supabase → **Authentication → URL Configuration**: set **Site URL** to that address, and add it plus `http://localhost:5173` under **Redirect URLs**.

> Prefer the code to be private too? Cloudflare Pages can deploy a **private** GitHub repo for free with its own free address. Tell Claude Code in Phase 0 and it will adjust Phase 5.

---

## Part B – the prompt

Go back to the Claude Code tab, press **Shift + Tab** until it shows **plan mode**, fill in the three placeholders below, and paste the whole box:

```text
You are building the production version of the Pa-Nashe Tracker, a household finance web app for Piepie and Munny.
A working prototype is in this folder. The job is a faithful port to an installable web app on Supabase + GitHub Pages
– same behaviour, same screens, same wording, same numbers – plus a secure login. Improvements come later.

Read fully before proposing anything:
- CLAUDE.md (rules you must follow – note the repository is PUBLIC and private/ must never be committed)
- docs/SPEC.md (data model, business rules, screens, design system, architecture in §2)
- supabase/migrations/0001_init.sql (database – already written and tested)
- private/ACCEPTANCE.md and private/DATA-NOTES.md (numbers that must match to the cent; data facts)
- prototype/src/*.js, prototype/src/app.css and prototype/test/mock.js (the actual implementation)
- Look at every image in private/screenshots/

My details:
- GitHub repository URL: GITHUB_REPO_URL_HERE
- GitHub Pages address: https://GITHUB_USERNAME.github.io/pa-nashe-tracker/
- Supabase project URL: SUPABASE_URL_HERE   (I'll paste the keys into .env.local myself when you ask)
The Supabase project already has 0001_init.sql applied, the two members added, sign-ups disabled and both users created.

Work in these phases. At the end of each phase: run the tests, take screenshots at 390x844 and 1360x900, compare with
private/screenshots, run `git status` to prove nothing private is staged, summarise what you did and any differences,
and STOP for my review.

Phase 0 – Plan (plan mode, no code)
  Propose the folder structure, how prototype/src splits into TypeScript modules, the adapter interface with its
  SupabaseAdapter and MemoryAdapter, the login flow, offline outbox, testing approach (MemoryAdapter, no Docker), and the
  GitHub Actions deploy. List your questions.

Phase 1 – Scaffold and calculations
  git init (main branch), connect the GitHub remote, .gitignore from this folder. Vite + TS + Vitest + Playwright.
  Port core.js into typed modules without changing calculation logic. Port mock.js as the MemoryAdapter.
  Vitest tests that load private/data/seed-reference/backup.json and assert every number in private/data/baseline.json
  plus the personFromText cases in ACCEPTANCE flow 12 (skip cleanly if private/ is missing). First commit and push.

Phase 2 – Supabase, login and seed
  SupabaseAdapter per SPEC §2.2 (doc_set / doc_merge RPCs, realtime, optimistic local merge, write queue).
  Login per SPEC §2.3: sign-in screen, forgot/reset password, “This tracker is private” for non-members, S.me from
  members.person, Settings → signed in as / change password / sign out. Create .env.example and ask me to fill .env.local.
  Seed script (npm run seed -- <backup.json>) using the service-role key from .env.local: loads config, months and
  milestones with doc_set, uploads private/data/documents/*.pdf to the files bucket, rewrites the three asset ids from
  DATA-NOTES, confirms before overwriting, idempotent. Then help me run a smoke test: both of us signed in on two
  browsers, an entry added on one appears on the other within seconds.

Phase 3 – UI port
  Port ui1/ui2/ui3/io.js and app.css screen by screen: shell and navigation, Home, Budget + line sheet, capture sheet,
  Piepie & Munny, Accounts + account page (check balance, move money, add entry, edit/new account), Plan + calculators,
  Year view + trend sheet, Milestones (create, lines, ZAR/USD payments, documents), More, Line items editor, Settings.
  Files via Storage signed URLs (SPEC §2.5); downloads via Blob / Web Share. Keep all copy, colours and spacing.

Phase 4 – Import, export, PWA, offline
  Statement import (CSV + XLSX, classification and rule learning exactly per SPEC §5.8), Excel export and JSON backup
  (SPEC §5.10), PWA manifest (name “Pa-Nashe Tracker”, short name “Pa-Nashe”, theme #1F6B5C, icons with the
  lavender #dfc5fe / brown #ae8774 half-and-half dot), service worker, IndexedDB cache + offline outbox with the
  “Offline – N changes waiting” chip (SPEC §2.4).

Phase 5 – Tests, deploy, go-live
  Playwright tests for every flow in private/ACCEPTANCE.md §6 on the MemoryAdapter (statement files from
  private/statements), visual checks at both viewports, then the GitHub Actions workflow per SPEC §2.7. Push, confirm
  the site is live, then seed production from the newest backup I give you (default:
  private/data/live-backup-2026-10-02.json). Finish with a short guide for installing the app on our phones (iPhone:
  Safari → Share → Add to Home Screen; Android: Chrome → Install app).

Rules: follow CLAUDE.md. Never change calculation logic to make a test pass. Never commit anything from private/, .env
files or keys. If the spec is ambiguous, the prototype code decides – tell me where you had to choose.
```

---

## Part C – tips while it works

- Claude Code asks permission before running commands or editing files. Read what it wants to do; “Yes” for normal project commands is fine. Say **no** to anything that touches files outside this folder or tries to `git add private`.
- At each phase stop, ask it to show you the screenshots it compared, and to run `git status`.
- Before switching from the claude.ai prototype to the new app, use **More → Download a full backup** in the prototype and give that file to Claude Code for the production seed, so nothing captured in the meantime is lost. Receipts attached in the prototype after 2 Oct 2026 will need re-attaching.
- When the port is live, ask for the Prototype 2 features (2023–2025 history, multi-year dashboards, PDF statements) as new phases – they’re listed at the end of `docs/SPEC.md`.
