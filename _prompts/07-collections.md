# Step 7. Friday collections with two-person confirmation

**Before you start:** Nothing else needed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, _specs/roles-permissions.md. Do ONLY Step 7. Plan mode first.
>
> 1. Collection screen designed for a phone, very fast: pick date (default today), fund (default Tabung Am), enter the counted amount in RM; optional breakdown (notes by denomination) that auto-totals; note.
> 2. Status flow: Counted (by user 1) then Confirmed (by a DIFFERENT user). The same user can never confirm their own count (enforce in the database, not only the UI). Allowed to count: Bendahari, AJK. Allowed to confirm: Pengerusi, Bendahari, AJK per roles file.
> 3. On confirmation, create the ledger transaction (receipt) automatically, link it to the collection, and generate the receipt number. A discrepancy field: if the confirmer enters a different amount, mark it "perlu semak" and do not post until resolved.
> 4. Offline-friendly: if the phone is offline, queue the count and sync when back online with a visible "belum dihantar" badge. Never post twice (idempotency key).
> 5. Pending collections show in the dashboard "Perlu tindakan" list.
> 6. Tests: same-user confirmation rejected at DB level; duplicate submission does not double-post; permissions; isolation.
> Run all checks.

## Check (do not move on until all pass)

- One user enters a count; the same user cannot confirm it; a second user confirms and the receipt appears in the ledger.
- Time yourself: recording a Friday collection should take under 3 minutes.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: collections with two-person confirmation`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
