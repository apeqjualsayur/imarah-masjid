# Step 5. Kariah registry

**Before you start:** Pilot masjid's kariah list (Excel or paper) as a test CSV, with names changed if needed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, _specs/roles-permissions.md. Do ONLY Step 5. Plan mode first.
>
> 1. Kariah page: households list with search (name, phone, address), filters (khairat status later), and a detail page showing members.
> 2. Add/edit household and members. Collect minimum data: head name, address, phone, members (name, relation, date of birth, IC LAST 4 digits only). Show a clear note that full IC numbers are not stored.
> 3. WhatsApp and PDPA consent: checkboxes with the date saved at registration, and a short BM consent text I can edit in messages/ms.json.
> 4. CSV import: download a template; upload; preview with row-by-row validation errors (bad phone, missing name, duplicates); import only valid rows after I confirm; show a summary. Handle UTF-8 and Excel-saved CSVs.
> 5. Only Setiausaha edits and imports (per roles file); others view per the matrix.
> 6. Plan limit hook: central function checkPlanLimit(masjid, 'households') used here (full enforcement comes in Step 13).
> 7. Every change shows in the audit log. Tests: CSV parser unit tests with messy samples, permission tests, isolation tests.
> Run all checks.

## Check (do not move on until all pass)

- Import 50 sample households from a CSV, fix errors flagged in the preview, then edit one.
- The edit appears in the audit log with who, when, before and after.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: kariah registry and CSV import`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
