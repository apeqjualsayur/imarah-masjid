# Imarah (imarahmasjid.my): start here

You direct, Claude Code builds. Work one step at a time: paste the prompt, run the check, commit, move on.

## What is in this kit
| Path | What it is |
|---|---|
| `CLAUDE.md` | Standing rules Claude Code reads every session |
| `_specs/phase1.md` | Decisions, scope, data model |
| `_specs/roles-permissions.md` | Who can do what (confirm with pilots) |
| `_specs/help-articles.md` | The in-app help article list (Step 15) |
| `_specs/pilot-checklist.md` | What to collect from pilot masjids and when |
| `_brand/tokens.json` | Imarah Teal colours, font, radii |
| `_brand/screens/` | Put the four design PNGs here |
| `_prompts/00..15` | One file per build step: prompt, check, commit |
| `_prompts/phase2/` | Phase 2 meetings module, 5 steps |
| `_specs/phase2-meetings.md` | Meetings and minutes spec |
| `.env.example`, `.gitignore` | Secrets template and ignore rules |

## Part 1. Step 0: set up (about 1 hour)

### A. Install the tools (once)
1. **VS Code**: https://code.visualstudio.com
2. **Node.js (LTS)**: https://nodejs.org. Check in a terminal: `node -v` shows a version.
3. **Git**: https://git-scm.com. Check: `git --version`.
4. **Claude Code**: follow the install steps at https://docs.claude.com/en/docs/claude-code. Check: `claude --version`.

### B. Create the accounts
1. **GitHub**: create a **private** repo named `imarah`.
2. **Supabase** (supabase.com): new project named `imarah-dev`. Pick the Singapore region (nearest). Save the database password in your password manager. From Project Settings > API copy the Project URL, the anon key and the service-role key.
3. **Vercel** (vercel.com): sign in with GitHub. Do not import the repo yet (nothing to deploy until Step 1).
4. **Resend** (resend.com): create an account; make an API key later at Step 3.
5. Later: Sentry (Step 14), a domain name (Step 14).

### C. Put the kit in the repo
1. Unzip this kit. Move its contents into a new folder `imarah` on your computer.
2. Save the four Imarah Teal board images into `_brand/screens/` (names: `desktop.png`, `mobile.png`, `logos-receipt.png`, `laporan.png`). Open the design canvas link in `_brand/README.md` and export or screenshot each board.
3. In that folder open a terminal and run:
   - `git init`
   - `git add .`
   - `git commit -m "chore: add starter kit"`
   - `git branch -M main`
   - `git remote add origin <your GitHub repo URL>` then `git push -u origin main`
4. Create `.env.local` by copying `.env.example` and paste the three Supabase values. Never commit it (it is git-ignored).

### D. Open it with Claude Code
1. In VS Code: File > Open Folder > `imarah`.
2. Open the terminal in VS Code and run `claude`.
3. Type: `Read CLAUDE.md and _specs/phase1.md and tell me, in 5 bullets, what we are building and the rules you will follow.` Check that the answer mentions one masjid per user, sen, append-only ledger, RLS.

**Check for Step 0:** repo on GitHub, Supabase project exists, `.env.local` filled, Claude Code answers correctly in D3. Then go to `_prompts/01-scaffold.md`.

## Part 2. How every step works
1. Open the step file in `_prompts/`. Read "Before you start".
2. Paste the prompt into Claude Code. It will show a plan first. Read it; if it matches, say "Approved, go ahead". If unsure, ask "explain this in simple words".
3. When Claude finishes it tells you commands and what to click. Do exactly the **Check** list.
4. If a check fails, use the "If something fails" line at the bottom of the step file.
5. Commit and push. Say "Step done. What is the next step?".

## Part 3. Start of every new session
Paste: `Read CLAUDE.md. Look at the git log and tell me which build step we are on, what is finished, and what the next step is. Do not start it yet.`

## Order of work and the pilot
- Steps 1 to 4: foundation. You can do these before any pilot is signed.
- **Recruit 3 to 5 pilot masjids before Step 5** and start collecting documents (`_specs/pilot-checklist.md`).
- Steps 5 to 10: money. Steps 11 to 12: control and reports. 13: plans. 14: harden and deploy. 15: help.
- Estimate: about 12 weeks part-time. Treat as a guess until Step 3 is done.

## Phase 2: Mesyuarat (meetings and minutes)
Start only after Phase 1 is live and a pilot has used it for a month. Files: `_specs/phase2-meetings.md` and `_prompts/phase2/P2-01` to `P2-05`. Same routine as Part 2. Order: M1 database, M2 editor, M3 approval and versions, M4 letterhead and PDF, M5 plans and help. Estimate about 1 to 1.5 weeks part-time with Claude Code.
Before M1, collect from a pilot: 2 sample minutes and their letterhead (see `_specs/pilot-checklist.md`).

## Rules for you (the owner)
- Never paste real kariah lists or bank statements into the repo. Use fake data in git; keep real files outside the repo.
- Do not store real kariah data until a lawyer has reviewed the PDPA notice and the hosting region question (Step 14).
- Do not skip the isolation tests in Step 2. Everything else depends on them.
