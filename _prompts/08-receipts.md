# Step 8. E-receipts

**Before you start:** Test with a real masjid logo from a pilot.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, and the logo/e-receipt board in _brand/screens/. Do ONLY Step 8. Plan mode first.
>
> 1. Gapless receipt numbers per masjid per year (e.g. RC-2026-0001) using receipt_counters inside the same database transaction as the ledger entry. Never reuse a number, even after a reversal.
> 2. Receipt PDF: masjid logo and name, receipt number, date, received from (optional donor name), fund, method, amount in figures and in Malay words, signature line for the Bendahari, footer "Dijana oleh Imarah" (hidden on paid plans if configured). Matches the e-receipt board. Server-generated.
> 3. Receipts list and detail; download PDF; "Kongsi ke WhatsApp" button that opens a wa.me link with a short BM message and a time-limited signed link to the PDF. No messages are sent by the system.
> 4. Optional email of the receipt via Resend when a donor email is entered.
> 5. Reversed transactions show a "BATAL" watermark on the receipt copy.
> 6. Tests: receipt number sequence under concurrent inserts; amount-in-words unit tests; PDF generation smoke test.
> Run all checks.

## Check (do not move on until all pass)

- The receipt PDF shows the correct logo, amount (figures and words) and number; the share link opens on a phone.
- Two quick receipts never share a number.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: e-receipts and WhatsApp share link`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
