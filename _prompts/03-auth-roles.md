# Step 3. Sign-in, onboarding, roles, invitations

**Before you start:** Resend account and API key in .env.local.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md, _specs/roles-permissions.md. Do ONLY Step 3. Plan mode first.
>
> 1. Supabase Auth sign-in (email + password, plus magic link). BM screens, large friendly fields.
> 2. First-time onboarding: a new user creates a masjid (name, state, address, prayer zone) and becomes its Pengerusi. One membership per user, enforced.
> 3. Invitations: Pengerusi invites by email with a role; invitee follows the link, sets a password and joins that masjid only. Pending invitations can be revoked. Send email via Resend.
> 4. Role-aware navigation: each role sees only the menu items and buttons it may use. Server-side checks too; never rely on the UI.
> 5. Settings > Pengguna page: list users, change role, deactivate. Block removing the last Pengerusi.
> 6. Platform admin: a separate protected area (own login, 2-step verification if practical) that can view masjids and set plan; every action logged to audit_log. Keep it minimal.
> 7. Tests: Playwright flow for create masjid, invite Bendahari, sign in as each, confirm menus differ; unit tests for permission helpers; extend isolation tests.
> Run lint, types, all tests. Tell me how to try it as 3 different users.

## Check (do not move on until all pass)

- Create a masjid, invite two roles, sign in as each and confirm each sees only what it should.
- A user from masjid A cannot open any masjid B URL or id.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: auth, onboarding, roles, invitations`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
