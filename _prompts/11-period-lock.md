# Step 11. Period lock and audit log screen

**Before you start:** Nothing else needed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, _specs/roles-permissions.md. Do ONLY Step 11. Plan mode first.
>
> 1. Month lock: Pengerusi locks a month. Pre-lock checklist screen: pending collections, unmatched bank lines, draft items; warn but let the Pengerusi proceed only if there are no pending collections.
> 2. Once locked, every insert/update in that month is rejected by the database for all roles (including admin) with a friendly BM message in the UI.
> 3. Unlock needs a typed reason; the unlock and reason are audited. Reports already generated for that month are marked "tidak lagi sah" until regenerated.
> 4. Audit log screen (Pengerusi full, Bendahari view): filter by date, user, table, action; show before/after in readable form; export CSV. The log cannot be edited.
> 5. Tests: attempt insert, reverse, edit, import into a locked month, all rejected; unlock flow; audit entries present.
> Run all checks.

## Check (do not move on until all pass)

- Lock a month; every attempt to change it is rejected; unlock with a reason; find all of this in the audit screen.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: period lock and audit screen`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
