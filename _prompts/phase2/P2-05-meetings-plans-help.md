# Phase 2, Step M5. Meetings: plans, help articles, release notes

**Before you start:** Step M4 passed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase2-meetings.md section 7 and the Phase 2 meetings rows in _specs/help-articles.md. Do ONLY Step M5. Plan mode first.
>
> 1. Add meeting limits to lib/plans.ts: Asas 12 meetings per year and Imarah footer; Standard and Pro unlimited with letterhead and no footer. Enforce the cap in the database and show a friendly BM upgrade message. Downgrade keeps existing meetings readable and exportable, never deletes.
> 2. Write the 7 help articles listed under "Phase 2 additions" in _specs/help-articles.md, in content/help/ms/ and content/help/en/, with steps that match the real screens. Add the "Mula di sini" checklist items for Setiausaha and Pengerusi.
> 3. Map every new route to a help article so the "?" panel works; update the test that fails when a route has none.
> 4. Add "Apa yang baharu" release notes for the Mesyuarat module and update the printable role manuals.
> 5. Final security pass for the module: re-run all isolation tests, confirm no meeting data appears in logs or Sentry, and add a short section to _specs/security-review.md.
> Run all checks.

## Check (do not move on until all pass)

- An Asas masjid is stopped at the 13th meeting in a year with a clear message; upgrading lifts it immediately.
- Sign in as Setiausaha and Pengerusi: the checklist and "?" panel show the right meetings articles; the PDF manual includes them.
- All isolation tests pass.

## Then

1. Commit: `feat(meetings): plan limits, help articles, release notes`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
