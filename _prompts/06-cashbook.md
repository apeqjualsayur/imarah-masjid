# Step 6. Funds and cash book

**Before you start:** A 1-hour interview with the Bendahari to confirm fund names and categories (see _specs/pilot-checklist.md).

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, _specs/roles-permissions.md. Do ONLY Step 6. Plan mode first.
>
> 1. Funds: create/rename/archive funds (default set: Tabung Am, Pembangunan, Khairat Kematian, Amal Jariah). Mark a fund restricted. Categories for income (Kutipan Jumaat, Derma, Sewaan dewan, Khairat, Lain-lain) and expense (Bil elektrik/air, Gaji, Penyelenggaraan, Kebajikan, Lain-lain), editable.
> 2. Cash book (Kewangan): record a receipt or payment: date, fund, category, amount (entered in RM, stored as sen), method (tunai, pindahan bank, DuitNow, cek), reference, note. Optional attach a photo or PDF (Storage). Bendahari only.
> 3. Ledger view: filter by month, fund, category, direction; running balance per fund; totals; export to CSV.
> 4. Corrections: a Reverse button creates a linked reversing entry with a required reason, then lets me enter the correct one. Originals stay visible, marked "dibatalkan".
> 5. Dashboard (Utama): total of all funds, fund cards with balance, this month's income and expense.
> 6. Reject saving into a locked month with a friendly message (trigger already exists).
> 7. Tests: unit tests for balances and reversals using sen; a test where I enter 10 known transactions and the balances match a hand-calculated expected result; permission and isolation tests.
> Run all checks.

## Check (do not move on until all pass)

- Record 10 transactions across 3 funds, reverse one, and confirm fund balances and ledger totals match a calculator.
- A non-Bendahari user cannot record a transaction.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: funds, categories, cash book, reversals`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
