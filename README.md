# Pa-Nashe Tracker

Household budget, savings and spending tracker for Piepie and Munny – a web app you can install on your phone.

**Building it:** see `PROMPT.md` (setup + the prompt for Claude Code).

| Path | What it is |
|---|---|
| `PROMPT.md` | One-time setup (Supabase, GitHub) and the kickoff prompt |
| `CLAUDE.md` | Rules and map for Claude Code |
| `docs/SPEC.md` | Full specification of the app |
| `supabase/` | Database setup (`migrations/0001_init.sql`) and the members template |
| `prototype/` | The working prototype the app is ported from, plus its test harness |
| `private/` | Your real data, PDFs, statements, screenshots and acceptance numbers – **git-ignored, never uploaded** |

Running the prototype’s own checks (optional):
```bash
pip3 install playwright openpyxl && python3 -m playwright install chromium
python3 private/tests/test_flows.py
```
