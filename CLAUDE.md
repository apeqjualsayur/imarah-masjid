# Masjid Management System (app name: Imarah; domain imarahmasjid.my; app at app.imarahmasjid.my)

Multi-tenant web app (PWA) for masjids and suraus in Malaysia: kariah registry, fund-based cash book, collections, e-receipts, khairat, bank matching, period lock, audit log, reports for authorities, in-app help.
Owner: Afiq (not a coder; directs Claude Code in VS Code). Language of UI: Bahasa Malaysia first, English second.

## How to work with me
- Do ONE build step at a time. Read `_specs/phase1.md` and the step file in `_prompts/` first. Do not start the next step.
- Start every step in plan mode: show a short plan (files, tables, screens) and wait for my OK.
- Explain in plain language. After each step give: what changed, the exact command(s) to run, and the exact things I should click to check.
- Never run destructive commands (drop tables, delete branches, force push, reset data) without asking first.
- Commit after each working step with a clear message. Never commit secrets.
- If a requirement is unclear or conflicts with these rules, stop and ask. Do not guess on money, permissions or personal data.

## Stack (do not change without asking)
Next.js App Router + TypeScript (strict) + Tailwind; Supabase (Postgres, Auth, RLS, Storage); Vercel; next-intl; Serwist PWA; PDF library + exceljs; Resend; Vitest + Playwright; Sentry.

## Non-negotiable rules
1. Tenancy: one masjid per user (`memberships.user_id` unique). No masjid switcher. Every table except `masjids` has `masjid_id` and an RLS policy limiting rows to the caller's masjid. Never accept `masjid_id` from the browser as trusted input; derive it from the session.
2. Money is integer sen. Never floats. One shared helper formats as "RM 1,234.50".
3. `transactions` are append-only. No update or delete. Corrections = a reversing entry (`reverses_id`) plus a new entry.
4. A DB trigger rejects changes dated inside a locked period.
5. A DB trigger writes every insert/update/delete to `audit_log`. The log cannot be edited or deleted by any app role.
6. The system records, reconciles and reports. It never holds or moves mosque funds.
7. Personal data: minimum only. IC = last digits only. Record WhatsApp/PDPA consent with date. No personal data in logs or Sentry.
8. Secrets live in env vars only (`.env.local`, Vercel, Supabase). The service-role key is server-only. `.env*` is git-ignored; keep `.env.example` current.
9. Every new table ships with: `masjid_id`, RLS policy, audit trigger, and an isolation test (user of masjid A cannot read or write masjid B rows).
10. Permissions are enforced in RLS and mirrored in the UI (hide actions the role cannot do). Roles: Pengerusi, Bendahari, Setiausaha, AJK, Imam. See `_specs/roles-permissions.md`.
11. Reports for authorities are generated only from locked periods.

## Phase 2 rules (meetings, only when building that module)
- Approved minute versions are immutable (database trigger). Amendments create a new version with a reason and need approval again.
- The content hash is computed on the server at approval and printed on the PDF.
- Draft minutes are visible only to Setiausaha and Pengerusi. Respect each meeting's visibility setting in RLS, not only in the UI.
- Text only: no file attachments in this module.

## UI rules
- Use design tokens from `_brand/tokens.json` via the Tailwind config. No hard-coded colours or font sizes. Font: Plus Jakarta Sans.
- Match the Imarah Teal screens in `_brand/screens/`. Light theme. Prayer times: small, quiet strip at top right. Masjid logo and name lead the sidebar; "Dikuasakan oleh Imarah" only as a small credit.
- Tap targets at least 44px. Do not rely on colour alone to show status. Icon-only buttons need an accessible label.
- No user-facing text in code. Every string goes in `messages/ms.json` and `messages/en.json`. Dates like "29 Okt 2026". Plain everyday Malay (kariah, khairat, AJK, Bendahari stay as is).

## Help and docs rule
Any change to a screen or feature must update its help article in `content/help/ms/` and `content/help/en/` in the same commit, and add a line to the release notes ("Apa yang baharu"). Keep `_specs/` current when a decision changes.

## Testing
- Vitest for logic (money, permissions, report totals). Playwright for key flows. Isolation tests in `tests/isolation/` must pass before every commit that touches the database.
- Run lint, type-check and tests before saying a step is done.

## Repo layout
`app/` pages and server actions · `components/` · `lib/` (money, dates, permissions, reports) · `supabase/migrations/` (ordered SQL, never edited after applied) · `content/help/{ms,en}/` · `messages/` · `_specs/` · `_brand/` · `_prompts/` · `tests/`
