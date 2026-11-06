# Phase 2, Step M4. Letterhead settings and PDF export

**Before you start:** Step M3 passed. Have the masjid's real letterhead sample ready (logo, address lines, registration details if any).

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase2-meetings.md section 8 and 9, and the logo and e-receipt board in _brand/screens/. Do ONLY Step M4. Plan mode first; show me a sample layout description before coding.
>
> 1. Settings > Kepala surat (Pengerusi): header name (default masjid name), address lines, phone, email, optional registration label and number, footer text. Live preview using the masjid logo from Settings. Validate lengths so the header never overflows.
> 2. PDF export of a meeting (server-side, A4) as in _specs/phase2-meetings.md section 9: letterhead header with logo; title MINIT MESYUARAT [JENIS] BIL. X/TAHUN; date, time, venue; attendance table and quorum line; agenda and minutes by item; numbered resolutions; action table; signature blocks "Disediakan oleh" (Setiausaha) and "Diluluskan oleh" (Pengerusi) with names and approval date; footer with page x of y, version, short approval reference.
> 3. Draft and pending meetings export with a "DRAF" watermark; approved ones do not. Asas plan shows "Dijana oleh Imarah" in the footer; Standard and Pro do not.
> 4. Malay and English labels follow the user's language setting but minutes text is printed exactly as typed. Handle long text across pages with no cut-off words, and Malay characters correctly.
> 5. Save each generated approved PDF to private storage with version number and timestamp; downloading again returns the same file.
> 6. Tests: PDF generation smoke test, page-break test with a very long minute, watermark logic, plan footer logic, permissions (who can export).
> Run all checks and attach a sample PDF generated from the seed data for me to review.

## Check (do not move on until all pass)

- Export an approved meeting; open the PDF: logo, letterhead, attendance, resolutions, signatures and reference all look right and print on A4.
- Export a draft: it has the DRAF watermark.
- Give the sample to a pilot Setiausaha and note what they would change in _specs/meetings-feedback.md.

## Then

1. Commit: `feat(meetings): letterhead settings and PDF export`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
