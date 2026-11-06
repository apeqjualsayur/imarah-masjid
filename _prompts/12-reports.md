# Step 12. Reports for authorities

**Before you start:** The monthly statements, AGM report and the authority's form from the pilots (see _specs/pilot-checklist.md). Without these, build the generic version and expect to revise.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, the Laporan board in _brand/screens/, and the sample documents in _specs/samples/ (if present). Do ONLY Step 12. Plan mode first; propose the report layouts and ask me to approve them.
>
> 1. Laporan page as in the board: list of reports with status, PDF and Excel buttons, pre-submission checklist, and a banner that official reports need a locked period.
> 2. Reports (generic templates, Standard plan): Penyata Kewangan Bulanan (income, expenses, by fund and category, opening and closing balance), Penyata Tahunan summary, Senarai Tunggakan Khairat, Ringkasan Kutipan Jumaat. Asas gets the monthly PDF only with the Imarah footer.
> 3. Generated on the server from locked periods only, saved to Storage with a version and timestamp; regenerate creates a new version. Masjid logo and name in the header; signature blocks for Bendahari and Pengerusi.
> 4. Excel export with the same numbers.
> 5. A "totals check" test: totals in the report equal the cash book totals for the same month, to the sen.
> 6. Tests: report totals against fixture data, locked-period guard, plan gating, isolation.
> Run all checks.

## Check (do not move on until all pass)

- Produce the monthly statement for a locked month and compare every total with the cash book.
- Give the PDF to a pilot treasurer and ask what is missing; record the answers in _specs/report-feedback.md.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: reports for authorities`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
