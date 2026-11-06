# Step 14. Harden, deploy, onboard the pilot

**Before you start:** Production Supabase project (imarah-prod), Sentry project, imarahmasjid.my (and app.imarahmasjid.my), a lawyer's review of terms and PDPA notice.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md and the security section of the Technical Handover Guide. Do ONLY Step 14. Plan mode first.
>
> 1. Security review: audit every table for RLS, audit triggers and isolation tests; search the code for any use of the service-role key outside server-only files; check no secrets or personal data in logs, Sentry or the repo; check file upload validation and signed URL expiry; check rate limiting on sign-in and invites. Report findings in _specs/security-review.md with severity and fixes. Fix high-severity items now.
> 2. Add Sentry with personal-data scrubbing. Add error pages in BM.
> 3. Environments: dev, staging (optional), prod. Write docs/deploy.md with exact steps to create imarah-prod, apply migrations, set Vercel env vars, point the domain, and roll back.
> 4. Backups: enable Supabase backups; document a restore runbook; add a monthly "export my data" (PDF + Excel + CSV) for each masjid.
> 5. Legal pages: Terma Perkhidmatan, Notis Privasi PDPA, with placeholders I will have reviewed by a lawyer. Clause: masjid owns its data and logo.
> 6. Seed the pilot masjids on prod (empty, real masjid info only) and invite their users.
> Run all checks and show me the security report.

## Check (do not move on until all pass)

- Restore a backup into a test project and the data is intact.
- Sign in as two masjids on the live domain and confirm they cannot see each other's data.
- Lawyer has reviewed terms and PDPA notice before any real kariah data is stored.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `chore: harden, deploy, backups, legal pages`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
