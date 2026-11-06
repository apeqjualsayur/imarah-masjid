# Step 10. DuitNow QR and bank matching

**Before you start:** One real bank statement CSV from a pilot (names/account numbers removed if they prefer).

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md. Do ONLY Step 10. Plan mode first. First, look at the sample CSV I put in tests/fixtures/ (outside git if it has real data) and propose the column mapping.
>
> 1. DuitNow QR: Settings stores the masjid's DuitNow QR payload or uploaded QR image; show it on a "Terima derma" screen and on receipts if enabled. The system only displays the QR; money goes straight to the masjid's bank.
> 2. Bank import: upload CSV; map columns once per bank (saved per masjid): date, description, debit, credit; parse to sen; skip duplicates using a hash of date+amount+description; show a preview before importing.
> 3. Matching: suggest matches between bank lines and ledger transactions (same amount, date within 3 days); the Bendahari accepts or rejects each; unmatched bank lines can create a ledger entry in one click.
> 4. Reconciliation screen for a month: bank total vs ledger total, list of unmatched items, difference shown clearly; goal is zero.
> 5. Bendahari only. Everything audited. No bank credentials are ever stored.
> 6. Tests: parser with 2 different bank formats, duplicate import, matching rules, isolation.
> Run all checks.

## Check (do not move on until all pass)

- Import a real statement CSV and reconcile one month to zero difference.
- Importing the same file twice adds nothing.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: DuitNow QR and bank reconciliation`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
