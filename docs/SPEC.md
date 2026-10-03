# Pa-Nashe Tracker – Specification

This describes the prototype in `prototype/` precisely enough to rebuild it. Where this document and the prototype code disagree, the code wins – and note the disagreement.

---

## 1. Users and purpose

Two users who pool all income: **Piepie** (`P`) and **Munny** (`M`); joint ownership is `J`. Their full and statement names live only in the data (`config/main.people`) and in `private/DATA-NOTES.md` – never hard-code them.

Primary jobs, in priority order:
1. Capture a spend on the phone straight after a shop (amount → line item → store → paid from → save) so that monthly actuals build up from individual entries.
2. See the month: budget vs actual per line, what is still to pay, what is over.
3. Allocate pooled income and commitments between Piepie and Munny and see each person’s surplus.
4. Track savings, goals and debts per account, fed by the budget, by captured spends and by imported bank statements.
5. Compare a month against three planning scenarios; run four planning calculators.
6. Year overview and per-line trends; milestone budgets for trips and events; Excel export and JSON backup.

---

## 2. Target architecture

| Concern | Prototype (claude.ai) | Production |
|---|---|---|
| Hosting | claude.ai artifact | **GitHub Pages** (free, `https://<user>.github.io/<repo>/`), built and deployed by GitHub Actions; installable PWA |
| Data | `claude.use('db')` – realtime JSON document store | **Supabase** (free plan): Postgres table `public.docs` holding the same JSON documents + Realtime |
| Login & permissions | claude.ai account + share menu | **Supabase Auth, email + password**; public sign-ups switched off; only emails in `public.members` can read or write (row-level security) |
| File uploads (receipts, PDFs) | `claude.use('assets')` → `/_blob/<id>` | Supabase Storage, private bucket `files`; `assetUrl(id)` returns a short-lived signed URL |
| Downloads (Excel, JSON) | `claude.use('downloads').save()` | Blob + `<a download>`; Web Share (`navigator.share({files})`) on phones when available |
| Excel library | SheetJS from cdnjs | `xlsx` npm package, lazy-loaded |
| Fonts | Google Fonts | `@fontsource/bricolage-grotesque` + `@fontsource/figtree` (self-hosted, works offline) |
| Offline | – | App shell cached by a service worker; last data cached in IndexedDB; changes made offline queued and sent when back online |

Build: **Vite + TypeScript, no UI framework**. The prototype is vanilla JS with template-string rendering and event delegation; keep that architecture so the port stays faithful. Split `prototype/src/*.js` into typed ES modules. Use `@supabase/supabase-js` v2.

### 2.1 Database (already written and tested)

`supabase/migrations/0001_init.sql` creates:
- `public.members(email, person 'P'|'M')` – the allow-list. `public.is_member()` checks the signed-in user’s email.
- `public.docs(collection, id, data jsonb, version, updated_at, updated_by)` with primary key `(collection, id)`; `collection` ∈ `config | months | milestones`. One row = one prototype document.
- RPC `doc_set(collection, id, data)` – full replace (upsert).
- RPC `doc_merge(collection, id, patch)` – **atomic server-side deep merge**: objects merge key by key, recursively; arrays and scalars replace; JSON `null` is stored (tombstone). Creates the row if missing. Two people saving different entries to the same month at the same moment both survive.
- Row-level security on `docs`, `members` and `storage.objects` (bucket `files`): members only. Realtime publication for `docs`.

It was tested on Postgres 16: merge semantics, tombstones, concurrent members, a signed-in stranger (sees 0 rows, writes and uploads blocked), signed-out access (0 rows), idempotent re-run. Do not weaken it. If you need schema changes, add `0002_*.sql`.

### 2.2 The data adapter (most important part of the port)

The prototype talks to storage only through `S.db` with this surface:

```
db.collection(path).onSnapshot(next, error)   // next({ docs: [{ id, exists, data() }] })
db.doc(path).set(body)                        // full replace (creates)
db.doc(path).update(patch)                    // DEEP MERGE of nested maps; arrays replaced; null stored as null
db.doc(path).delete()
```

Implement an adapter with exactly this surface, in two versions behind one interface:
1. **SupabaseAdapter**
   - `set` → `rpc('doc_set')`; `update` → `rpc('doc_merge')`; `delete` → `from('docs').delete()`.
   - `collection(c).onSnapshot`: initial `select id, data from docs where collection = c`, keep a cache, subscribe once to Realtime `postgres_changes` on `public.docs` (all events), update the cache and call every listener for that collection with the full doc list.
   - On reconnect, refetch everything.
   - Apply each write **optimistically** to the local cache first (same deep-merge rules, in TypeScript – port `merge()` from `prototype/test/mock.js`) and notify listeners immediately, so the UI updates as instantly as in the prototype. On failure, refetch and show the prototype’s toast.
2. **MemoryAdapter** – a port of `prototype/test/mock.js`, seeded from a backup JSON. Used by unit tests, Playwright tests and `npm run dev:demo`, so no Docker or local Supabase is needed.

Keep the prototype’s per-document write queue and the `null` tombstone convention (readers already filter nulls).

### 2.3 Login

- **Sign-in screen** in the prototype’s design (tokens, fonts, logo dot – lavender/brown halves): email, password, **Sign in**, **Forgot password?** (sends a reset email via `resetPasswordForEmail`, redirecting back to the app).
- **Password recovery**: when `onAuthStateChange` fires `PASSWORD_RECOVERY`, show a “Set a new password” sheet.
- Sessions persist on the device (supabase-js default); auto-refresh tokens.
- After sign-in, read `members` for the user’s email. If not found, show “This tracker is private” with Sign out, and nothing else loads.
- `S.me` = the member’s `person`.
- **Settings** shows “Signed in as <email>”, **Change password** and **Sign out**. Sign out clears the IndexedDB cache and outbox on that device.
- Accounts are created by the owners in the Supabase dashboard; public sign-up is off. No sign-up UI in the app.

### 2.4 Offline

- A service worker (vite-plugin-pwa, `registerType: 'autoUpdate'`) caches the app shell.
- The adapter keeps the last snapshot of every document in IndexedDB so the app opens with data offline.
- Writes made offline go to an **outbox** in IndexedDB and are replayed in order when back online. Merges of the same patch are idempotent, so replaying is safe.
- Show a small “Offline – N changes waiting” chip in the top bar.
- File uploads need a connection: say so and keep the entry without the receipt.

### 2.5 Files

- Upload to bucket `files` at `<uuid>.<ext>`; the stored asset id is that path.
- Rendered links use `data-a="openfile" data-id="<id>"`. On click, create a signed URL for 1 hour (cache it) and open it.
- The seed script uploads `private/data/documents/*.pdf` and rewrites the three old ids listed in `private/DATA-NOTES.md`.

### 2.6 Secrets and the public repository

GitHub Pages on a free account needs a **public** repository.

**Never committed** (`.gitignore` must cover them):
- `private/` – real financial data, PDFs, screenshots with figures, statements, acceptance numbers;
- `.env*` except `.env.example`;
- any service-role key.

**Allowed in the client:**
- The Supabase **anon key** and project URL are designed to be public; row-level security protects the data.
- In GitHub Actions they come from repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Service-role key:**
- `SUPABASE_SERVICE_ROLE_KEY` is used only by the local seed script, read from `.env.local`.
- It must never have a `VITE_` prefix and never reach the browser.

**Tests:**
- Tests load expected numbers from `private/data/baseline.json` at runtime, so no financial figures end up hard-coded in the public repo.
- Tests that need `private/` skip themselves cleanly when it is missing (as on GitHub Actions).

### 2.7 Deployment

- `vite.config.ts` uses `base: '/<repo-name>/'`.
- `.github/workflows/deploy.yml`, on push to `main`: `npm ci` → `npm run typecheck` → `npm test` (private-dependent tests skip) → `npm run build` with the two `VITE_` secrets → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- PWA `start_url` and `scope` follow the base path.
- Supabase Auth → URL configuration: Site URL = the Pages URL; Redirect URLs include the Pages URL and `http://localhost:5173`.

### 2.8 Writes
`dbWrite(path, op, data)` serialises writes per document (a promise queue per path), retries once on transient errors, and toasts on failure. Keep it. Write only on user actions, never from render code.

---

## 3. Data model

Four collections. All amounts are rand numbers (USD only inside milestones). Dates are `YYYY-MM-DD` strings; months are `YYYY-MM`.

### 3.1 `config/main`
```
people:   { P: { n:'Piepie', full:'<name on bank statements>', alias:'<other names, comma-separated>' },
            M: { n:'Munny',  full:'<name on bank statements>', alias:'<other names, comma-separated>' } }   // real values: private/DATA-NOTES.md
scenario: '1' | '2' | '3'            // default yardstick
planBase: <number>                   // monthly earned take-home income excl. La Vie rent
scen:     { '1'|'2'|'3': { name, desc, b: { <bucket>: [pct (0..1), fixedRand] } } }
calc:     { emergency:{m1,m2,stepUp}, lavie:{rent,levies,bond,cover,months,relet,touchup,stretch,seed,fromEmergency,extraBond,escalation},
            baby:{monthsLeft,birth,essentials,monthly,preMonths,gifts,salary,uif,employerPct,leaveMonths,planned},
            big:{everyday,carPrice,depositPct,tradeIn,upfront,rate,standUsd,transferPct,servicesUsd,fx,fxBuffer,depositShare} }
rules:    [ [KEYWORD, itemId], ... ]  // statement description → line item; learned on import
```

### 3.2 `config/catalog`
```
items: { <itemId>: { n: name, g: groupKey, o: sortOrder, pb?: planBucket, rec?: true (monthly),
                     arch?: true (hidden from pickers), fl?: [ { a: accountId, s: share 0..1, x: +1|-1 } ] } }
```
`fl` = “linked accounts”: when money goes to this line, each linked account moves by `x * s * amount` (e.g. TFSA Contributions → `tfsa_p` 0.5 +1 and `tfsa_m` 0.5 +1; Tablet Repayment → `d_tablet` 1 −1).

### 3.3 `config/accounts`
```
accounts: { <accId>: { n, t: 'savings'|'goal'|'credit'|'loan'|'bank'|'lent', ow: 'P'|'M'|'J',
                       open: number|null (null = unknown), od: openingDate, bank?, held?, goal?, gd?, limit?, rate?,
                       minp?, due?, bf?: false (budget links do NOT move it – statement-driven), track?: false (bank: no balance),
                       note?, chk?: 'why the balance must be confirmed', closed?: true,
                       pot?: 'short'|'medium'|'long' (savings pot; default from the linked lines' horizon), tfsa?: true } }
```
- `credit` and `loan` are liabilities: their balance is the amount **owing**.
- `goal` = money earmarked inside other accounts (e.g. Baby Fund, Uber Car Savings). Excluded from the savings total.
- `lent` = money owed to them (Owner’s Loan to Business).
- **TFSA** (name contains “TFSA”/“tax-free”, or `tfsa: true`): the account card leads with the contributions in the current SA tax year (1 March – end of February; settled entries up to today) against its goal; earlier tax years can be picked and are measured against that year’s statutory limit (R30,000 from 2015/16, R33,000 from 2017/18, R36,000 from 2020/21, R46,000 from 2026/27). Ledger entries of type `correction` adjust contributions either way (`src/calc/tfsa.ts`).
- **Savings pots** (`src/calc/pots.ts`): each savings/goal account is Short-term (emergency & liquid), Medium-term (reserves, 1–3 years) or Long-term (investments, 10 years+) – by `pot`, else from the catalog groups of the lines linked to it (`lt` → long, `it` → medium, otherwise short). A pot's total adds its savings accounts (confirmed balances); goals in it are shown separately, never added twice. Filter on Accounts, summary on Home.

### 3.4 `months/<YYYY-MM>`
```
y, m
lines:  { <itemId>: { b: budget, al?: [ { w:'P'|'M', v: number, u:'amt'|'pct', lb?: label } ], rec?: bool, note?: string } | null }
txns:   { <id>: { d, mo (budget month – may differ from d’s month), it: itemId, amt (>0), store?, note?, pay?: accountId (paid from),
                  by?: 'P'|'M', src: 'import'|'app'|'statement', at?: epochMs, rc?: assetId } | null }
ledger: { <id>: { d, a: accountId, amt (signed change in balance – for liabilities + means owing up), ty, ds, src,
                  bal? (only for ty:'check'), at?, pair?, ref? } | null }
```
A transaction lives in the document of its **budget month** (`mo`), a ledger entry in the document of its date’s month. `src:'import'` transactions are the 2026 spreadsheet’s monthly totals, one per line per month, dated the 28th.

### 3.5 `milestones/<id>`
```
n, st:'active'|'done', start, end, usd: ratePerUSD|null, note, o
lines: { <lid>: { n, sec:'income'|'expense', grp, b, cur:'ZAR'|'USD', o } | null }
txns:  { <tid>: { d, l: lid, amt, cur, note?, rc? } | null }
files: [ { id: assetId, n: filename, d } ]
```

---

## 4. Reference lists (from `core.js`)

**Groups** (key → name → section), in display order:
earned “Earned Income” in · funding “Other Funding (drawdowns & loans)” in · lt “Long-Term Savings & Investments (10yrs+)” sav · it “Intermediate Savings & Investments (1-3yrs)” sav · st “Short-Term Savings & Investments (0-12months)” sav · protection “Protection and Insurances” exp · housing “Housing Bills & Utilities” exp · household “Household and Personal Expenses” exp · health “Health & Wellness” exp · debt “Debt & Repayments” exp · onceoff “Other & Once-off Misc Expenses” exp · family “Family & Relationships” exp · giving “Giving” exp · ownerloan “Owner’s Loan to Business” exp.

**Sections**: in “Income”, sav “Savings & Investments”, exp “Expenses”.

**Plan buckets** (key → summary category): retire, emergency, goals → savings · sultana, lavie → house · household → household · protection, health → health · debt → debt · family, giving, onceoff, ownerloan → other. Summary categories: Savings; House Bills & Utilities; Household and Personal; Health, Wellness & Protection; Debts & Repayment; Other Expenses.

**Account types**: savings “Savings & investments”, goal “Goal (earmarked)”, credit “Credit card / store account”, loan “Loan”, bank “Everyday account”, lent “Money lent out”.

---

## 5. Business rules (port verbatim from `core.js`)

### 5.1 Month (`monthCalc(k)`)
- Lines shown = every non-null key in `lines` ∪ every item that has a transaction in the month.
- `act` = sum of the month’s live transactions for that item.
- **Automatic funding**: any transaction whose item is not income and whose `pay` account is savings/goal/credit/loan counts as money coming *from* that account → summed per account into `auto`. It appears under Income as “Paid from savings & credit (automatic)” and is included in Money in.
- Totals for budget (`b`) and actual (`a`): `earned`, `funding`, `sav`, `exp`, `auto` (actual only); `income = earned + funding + auto`; `out = sav + exp`; `surplus = income − out`.
- Variance: income/savings `act − b` (green when ≥ 0); expenses “Left” = `b − act` (red when < 0).

### 5.2 Piepie / Munny allocation (`shares`, `peopleCalc`)
- A line’s `al` is a list of splits; each is a rand amount (`u:'amt'`) or a percent (`u:'pct'`) for P or M, with an optional label (e.g. “Chie’s pocket money”).
- Budget basis: amounts as entered; percents of the budget. Actual basis: percents of the actual; rand amounts scaled by `actual / budget`.
- Whatever is not covered goes to “Not allocated” (`U`).
- Per person: income = their share of income/funding lines (plus, on the actual basis, automatic funding from accounts they own); commitments = their share of savings/expense lines; left = income − commitments.

### 5.3 Account balances (`balances()`)
For each account, collect events with `d >= od`:
- budget-link events from each transaction’s item `fl` (skipped when the account has `bf:false`), amount `x * s * amt`;
- paid-from events: for a transaction with `pay`, direction is +1 for income items and −1 otherwise; assets move by `dir * amt`, liabilities by `−dir * amt`;
- ledger entries as stored.

Sort by date, then `at`, then checks last. Walk: start at `open` (unknown if null); a `check` sets the balance to `bal` (recording the adjustment) and makes it known; other events add `amt`. Results: `bal` (null if unknown), `delta` (net movement – shown when unknown), `lastCheck`, `needsCheck = chk && no check yet && !closed`.

Totals on the Accounts screen exclude accounts that still need a check and say “+ N to confirm”.

### 5.4 Plan (`planCalc(k, scenario)`)
- Plan per bucket = `pct × planBase + fixed`.
- Actual per bucket = sum of the month’s line actuals with that `pb`; **La Vie net** = La Vie lines − “La Vie Rentals” income.
- Actual base = actual earned income − La Vie Rentals.
- Status: savings buckets “On target” if actual ≥ plan else “Below target”; others “Within plan” if actual ≤ plan else “Over plan”.
- Drawdowns = funding + automatic funding. Net savings = savings − drawdowns. Net savings rate = net ÷ actual base.
- Editing a target % writes `scen[s].b[bucket] = [pct/100, existingFixed]`.

**Calculators** (formulas in `viewPlan`):
- **Emergency fund**: essentials = Scenario 1 plan for sultana + lavie + household + protection + health + debt + family; targets = essentials × m1 and × m2; months to milestone = (target − balance of `g_emergency`) ÷ (S1 emergency plan − lavie.fromEmergency), and again with `+ stepUp`.
- **La Vie reserve**: carry = levies + bond + cover; target = carry × months + relet × rent × 1.15 + touchup; monthly = fromEmergency + extraBond + escalation × rent; balance from `g_lavie`.
- **Baby Fund**: target = birth + essentials + monthly × preMonths − gifts; leave gap = leaveMonths × max(0, salary × (1 − employerPct) − uif); balance from `g_baby`; needed per month and shortfall at planned contribution.
- **Big purchase**: car target = max(0, depositPct × carPrice − tradeIn) + upfront; instalment = PMT(rate/12, 48, carPrice × (1 − depositPct)); months at everyday and sprint (Scenario 2 goals fixed amount); Zim stand full = (standUsd × (1 + transferPct) + servicesUsd) × fx × (1 + fxBuffer); deposit = depositShare × standUsd × fx × (1 + fxBuffer).

### 5.5 Year (`yearCalc(y)`)
12 columns; per item budget and actual arrays; per month totals from `monthCalc`. **Compare with** another year (Year view): only months both years have (with actual entries, when showing actuals) are compared, so a part year is set against the same months of the other; KPIs, monthly spent/left-over chart and a table of every section, group and line with change in rand and %. The later year is always “current”: change = current − earlier year, % = change ÷ earlier year (one decimal), whichever year was picked first (`src/calc/compare.ts`). Change colours (own tokens `--yoy-good` #4ADE80 / `--yoy-bad` #F87171 on dark; #15803D / #B91C1C on light for contrast): green = better (more in, saved or left over; less spent, incl. debt repayments; less drawn from funding), red = worse. Rows indent in three steps: section, group, line (`td.lv0/lv1/lv2`). Months before 2026 (`isHistory`, the old workbooks) show nothing as due: no “Due” chip, empty Still to pay. Memo cards: La Vie net position (rent − levies − bond − FNB home loan cover − municipality tax), Owner’s loan balance (`biz_loan`), La Vie vacancy reserve (`g_lavie`).

### 5.6 Starting a month (`startMonth`)
Copies from the latest month every line that is monthly (`rec` on the line or the item), or has a budget and is not in the once-off group. Copies `b`, `al`, `rec`; drops notes and transactions. Monthly expense/savings lines with no actual show a “Due” chip and appear in Home → “Still to pay” with **Mark paid** (creates a transaction for the budget amount, dated today if this month else the 28th, paid by the single allocated person or the device user).

### 5.7 Capture (`sheetTxn`)
Amount (large) → “What was it for?” quick picks (recently captured items first, then Groceries, Fuel Piepie, Dates, Dischem & Clicks, Miscellaneous, Our Pocket Money, Home improvements, Wife Maintenance) + searchable grouped picker with “Add ‘…’ as a new line item” → store/payee, date → paid from (accounts grouped; remembers last choice per device) + “Counts towards” budget month (follows the date by default; lets mid-December salary count to January) → paid by (Piepie/Munny, defaults to device user) → note → receipt photo. Buttons: Save, Save & add another (keeps the line item), Delete when editing.

### 5.8 Statement import (`sheetImport`, `classify`)
- Accepts CSV/XLSX (Discovery format: Value Date, Value Time, Type, Description, Beneficiary or Cardholder, Amount; generic Date/Description/Amount or Debit/Credit also parsed). PDF → message that it comes in Prototype 2.
- Each row is classified, in this order: before account opening date → skip; same account + date + amount already in ledger → “Already in this account” skip; a captured transaction paid from this account with same amount within ±3 days → “Captured on …” skip; interest → ledger; fee → ledger; transfer (`Type` transfer or “From:/To:” beneficiary, matched to one of their accounts) → ledger; money out matching a rule → budget entry with that item; other money out → budget entry (choose item); money in → ledger.
- Liabilities store `amt = −statementAmount`.
- Budget entries become transactions with `pay = account`, `src:'statement'`, `by` = `personFromText(beneficiary + description)` or the account owner.
- Changing a suggested item learns a rule (first two words of the description).
- One write per month on save.

`personFromText`: tokens from each person’s statement name + aliases; tokens shared by both (their common surname) are ignored; a unique token match or “initials + surname” (e.g. “CP SURNAME”) identifies the person; ambiguous → none.

### 5.9 Milestones
Rand by default; optional USD rate per milestone; each line and payment has a currency; rand values = USD × rate. Templates on creation: trip, event, blank. Documents section holds attached files.

### 5.10 Export
Workbook sheets: `Overview <year>` (sections → groups → items × 12 months + total; section totals; surplus), `Plan <Mon> <year>`, one `<Month> <year> Budget` per month in the 2026 tracker layout (Planning, Budget, Actual, Variance, Notes, Who, Piepie, Munny; section and group subtotals; automatic funding rows; surplus), `Transactions`, `Accounts`, `Account history`, one `MS <name>` per milestone. JSON backup = `{ exported, config, months, milestones }` – the same shape as `private/data/live-backup-*.json`, so a backup can be re-seeded.

---

## 6. Screens

Navigation: phone – top bar (logo dot, month switcher, “who” button) + bottom tab bar (Home, Budget, round **+ Add** capture button raised in the centre, Accounts, More). Desktop ≥ 980 px – left rail (logo, “Add a spend” button, Home, Budget, Piepie & Munny, Accounts, Plan, Year view, Milestones, More) and no tab bar. Month switcher shows only on Home, Budget, People, Plan; its month name is a dropdown of every month, grouped by year (newest first). Before anything else: the **sign-in screen** (§2.3). After sign-in, the device user (`S.me`) comes from the signed-in member’s `person`, so the prototype’s first-run “Who’s using this device?” sheet is no longer shown automatically; Settings → This device still lets them switch who new entries default to (“Piepie” and “Munny” only on the buttons).

| Screen | Content |
|---|---|
| Home | “Hi Piepie”; green hero: left after savings and spending (big), planned, Money in / Saved / Spent tiles (each with the same month last year when there is one), bar of who covered outgoings (lavender/brown); Still to pay (Mark paid); Against your plan (scenario 1/2/3 segmented, six bars with target tick, net savings rate); Needs a look (balances to confirm, top over-budget lines); Latest entries (app-captured); two person cards |
| Budget | Title, Add line, Start <next month> (latest month only); four KPI tiles; filter All lines / Still to pay / Over budget; Income, Savings & Investments, Expenses panels with collapsible groups; columns Line item / Budget / Actual / (wide) Left or Variance; chips for allocation, Monthly, Due, “n entries”; thin progress bar per expense line; Left over panel |
| Line sheet | KPI tiles; budget input; Every month toggle; Who pays presets (All Piepie, All Munny, 50/50, Not allocated) and split rows (person, label, value, R/% toggle, remove); remaining text; notes; entries list; Remove from month / Mark paid / Save |
| Piepie & Munny | Budget/Actual toggle; three cards: Piepie, Munny, Not allocated yet – each with surplus and income/paying-for lists |
| Accounts | Move money, Import statement, New account; KPIs (Savings, Debt owed, Owed to you, Balances to confirm); notice; lists by type with owner avatar, bank, confirm chip, goal progress |
| Account | Check balance, Move money, Add entry, Import statement, Edit; balance, goal/limit bars, notices; history with running balance |
| Plan | Scenario segmented control; description; plan base input; table by summary category and bucket with editable target %; drawdowns and net savings rows; four calculator panels with editable inputs |
| Year view | Year select, Compare with (another year), Actual/Budget; comparison panel when a year is picked; bar chart (money in, saved, spent) + left-over line; full table; three memo cards; tap a row → trend sheet with budget vs actual bars |
| Milestones | Cards with status, dates, spent vs planned bar, funding; detail with KPIs, lines table, payments, documents |
| More | People, Plan, Year, Milestones; Import statement, Export to Excel, Download a full backup; Line items & categories; Settings |
| Settings | Name in the app + name on bank statements + other names, per person; this device; appearance (match device / light / dark); **signed in as … · Change password · Sign out** |
| Sign in | Logo dot + “Pa-Nashe Tracker”, email, password, Sign in, “Forgot password?”; “Set a new password” after a reset link; “This tracker is private” for signed-in non-members |

---

## 7. Design system (`src/styles/app.css`)

Updated after the port (October 2026): dark-first look, Century Gothic, PM logo. The prototype's original tokens are in `prototype/src/app.css`.

- **Fonts**: one family for headings and body – `'Century Gothic', CenturyGothic, 'Urbanist', AppleGothic, sans-serif`. Century Gothic is used where installed; elsewhere (phones, most Macs) the self-hosted look-alike Urbanist (SIL OFL). Tabular figures for amounts.
- **Dark tokens (default)**: bg `#1C1E26`, surface `#242732`, surface2 `#2B2F3C`, ink `#E7E9F0`, muted `#A5AABA`, faint `#7F8495`, line `#363A48`, accent (brand) `#ADC6FF` with text `#1C1E26` on it, brand-soft `#2E3752`, good `#6CC394`, bad `#EE8B76`, warn `#E3B45A`, joint `#9DB8C4`.
- **Light tokens** (Settings → Appearance → Light, or Match device on a light-mode phone): bg `#F2F3F7`, surface `#FFFFFF`, ink `#1C1E26`, accent `#3A5BA0`, good `#2E7A4E`, bad `#B4432F`.
- **Status colours**: one green (`--good`) for everything on target and one red (`--bad`) for everything off target.
- **People** (unchanged): Piepie `#dfc5fe` / ink `#4B2A78` (dark theme `#2E1A4A`); Munny `#ae8774` / ink `#3B261C` (dark theme `#2A1A12`). Used on chips, avatars, the 6 px top border of person cards and the hero split bar.
- **Logo**: the white “PM.” mark from the owners' artwork (`Linktree Art.png`, git-ignored), extracted by `npm run icons` into `public/pm-mark.png` and drawn in the text colour beside “Pa-Nashe Tracker”. App icons: the mark on `#1C1E26` (favicon.ico 32, apple-touch 180, 192, 512, maskable 512). Manifest and `theme-color`: `#1C1E26`.
- Radii 8/14/22; one soft shadow; sheets slide up from the bottom on phones and centre on desktop.
- Respect `prefers-reduced-motion`; visible focus rings; safe-area insets; `viewport-fit=cover`.
- The memorable element is the raised round capture button; everything else stays quiet.

### History (October 2023 – December 2025)
Built from the owners' 2024 and 2025 workbooks (git-ignored) by `private/tools/extract_history.py` and `build_history.py`, loaded by `private/tools/seed-history.mts` (additive; backs up first). Month documents have the 2026 shape. Recurring costs use the 2026 line items; lines that repeat but no longer exist are **archived** items (`arch: true`, hidden from pickers); single-month extras sit under a general item of their group with the sheet's label as the entry's note. Entries are dated the 28th (`src: 'import'`). Account balances are unaffected (every account's opening date is in 2026). `tests/unit/history.test.ts` checks every month against the workbook totals when `private/` is present.

## 8–9. Data facts and attached files

See `private/DATA-NOTES.md` (git-ignored): seeded data facts, and the three PDF asset ids the seed script must re-upload and rewrite.

## 10. Backlog (Prototype 2 – not part of the port)

Import 2023 (Oct–Dec), 2024 and 2025 trackers via an approved mapping file; multi-year comparison dashboard with filters and scenario benchmarks; PDF statement reading (FNB, African Bank).
