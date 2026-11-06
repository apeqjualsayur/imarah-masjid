# Step 13. Plans, limits and billing

**Before you start:** Final plan limits from _specs/phase1.md section 8.

## Prompt (paste into Claude Code)

> Read CLAUDE.md and _specs/phase1.md. Do ONLY Step 13. Plan mode first.
>
> 1. Central plan config (lib/plans.ts): Asas, Standard, Pro, Daerah with limits and feature flags. One source of truth.
> 2. Enforce in the DATABASE (triggers or policies) the hard limits: Asas max 3 users, 150 households, 2 funds. The UI shows a friendly BM message with an upgrade prompt.
> 3. Feature gates: khairat, Excel, full report set (Standard+); Pro-only items hidden or locked with a clear label.
> 4. Plan and billing page for the Pengerusi: current plan, usage vs limits, plans table, "Hubungi kami untuk naik taraf" WhatsApp button. No payment gateway in Phase 1: the platform admin changes plans; invoice records (number, period, amount, paid yes/no) are stored manually.
> 5. Downgrade rules: if usage exceeds the lower plan, data is kept read-only; nothing is deleted.
> 6. Tests: 151st household blocked, upgrade lifts the cap immediately, downgrade over limit.
> Run all checks.

## Check (do not move on until all pass)

- An Asas masjid is stopped at 151 households with a clear message; upgrading to Standard removes the cap immediately.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: plans, limits and billing records`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
