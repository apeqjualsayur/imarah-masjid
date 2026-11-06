# Step 9. Khairat membership and arrears

**Before you start:** The pilot masjid's khairat rules: fee, who is covered, claim rules.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, _specs/roles-permissions.md. Do ONLY Step 9. Plan mode first.
>
> 1. Khairat plans per masjid per year: fee amount (sen), who is covered (household or per person, configurable), grace period. Standard plan and above only (use the plan check helper).
> 2. Enrol households; status: aktif, tunggakan (arrears), tamat. Arrears computed from fee versus paid for the year.
> 3. Record a khairat payment: creates a ledger receipt in the Khairat Kematian fund and a receipt, linked to the household; updates paid_sen and status.
> 4. Arrears list with filters and CSV export; summary on the dashboard.
> 5. Setiausaha and Bendahari per the roles file. Everything audited.
> 6. Do NOT build claims in Phase 1.
> 7. Tests: arrears calculation, partial payments, payment for the wrong year, permissions, isolation.
> Run all checks.

## Check (do not move on until all pass)

- Record a payment for a household in arrears; its status, the Khairat fund balance and the receipt all update.
- An Asas masjid cannot open Khairat (clear upgrade message).

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: khairat membership and arrears`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
