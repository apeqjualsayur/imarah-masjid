# Step 2. Database schema, row-level security, seed data

**Before you start:** Supabase project imarah-dev exists. Put its URL, anon key and service-role key in .env.local.

## Prompt (paste into Claude Code)

> Read CLAUDE.md and _specs/phase1.md. Do ONLY Step 2. Start in plan mode; show me the table list and policies before writing.
>
> 1. Install the Supabase CLI as a dev dependency (use npx). Link it to my imarah-dev project (tell me exactly what to type; I will paste the project ref and password myself).
> 2. Write ordered SQL migrations in supabase/migrations/ for every table in _specs/phase1.md section 5, plus receipt_counters and reports. Use integer sen, uuid ids, created_at/updated_at.
> 3. Enable Row-Level Security on every table. Policies: a user can only read/write rows where masjid_id equals the masjid in their single membership. Add a SQL helper function (security definer, stable) that returns the caller's masjid_id and role. Enforce roles per _specs/roles-permissions.md where the table is role-sensitive (for example only Bendahari inserts transactions).
> 4. Triggers: (a) audit trigger on every table writing to audit_log, which no app role can update or delete; (b) transactions are append-only (reject update/delete except status fields explicitly allowed); (c) reject any insert/update dated in a locked month from periods; (d) memberships.user_id unique.
> 5. Seed script (supabase/seed.sql or a script in scripts/) creating 2 masjids, each with 3 users (Pengerusi, Bendahari, Setiausaha), 5 households, 3 funds, 10 transactions. Fake data only.
> 6. Write isolation tests in tests/isolation/ using supabase-js: sign in as a user of masjid A and try to select, insert, update and delete masjid B rows in EVERY table; all must fail. Also test: cannot edit a transaction, cannot write into a locked month, cannot edit audit_log.
> 7. Run migrations on imarah-dev, run seed, run tests. Show me the test output.

## Check (do not move on until all pass)

- All isolation tests pass. This is the most important test in the project; do not move on until it does.
- Ask Claude: "List every table and confirm each has RLS, an audit trigger and an isolation test." No gaps.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: schema, RLS, triggers, seed, isolation tests`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
