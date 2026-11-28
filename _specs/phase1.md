# Phase 1 spec: decisions, scope, data model

Source: Phase 1 Build Plan (https://claude.ai/artifact/9gKSQcpoWQjDAUBzTVJmJ1) and Technical Handover Guide (https://claude.ai/artifact/TccPDb81RmjcTvPQrDwcjR). If this file and the code disagree, tell the owner and fix one of them.

## 0. Product identity
App name **Imarah**. Domain **imarahmasjid.my** (marketing site at the root, app at app.imarahmasjid.my). Tagline: "Sistem Pengurusan Masjid dan Surau". Never imply a government or JAKIM link. Separate Supabase projects: `imarah-dev` and `imarah-prod` (do NOT share a database with masjidview.my). masjidview.my (free TV prayer-time and announcement product) is a funnel: Phase 1 only links to Imarah; no data is shared until consent and privacy notice are fixed.

## 1. Goal
One pilot treasurer records a month of real collections and payments, reconciles the bank, locks the month and produces the monthly statement PDF with the masjid logo, and stops using Excel.

## 2. Locked decisions
| Area | Decision |
|---|---|
| Tenancy | One masjid per user. No switcher, no cross-masjid access. Platform admin is a separate, audited login. |
| Plans | Asas (free; max 3 users, 150 households, 2 funds, monthly PDF only, Imarah footer), Standard RM79/mo, Pro RM199/mo, Daerah/Negeri custom. Prices are hypotheses. |
| Khairat | Standard and above. |
| State report templates | Pro only. Standard gets generic templates. |
| WhatsApp | Phase 1: "Share to WhatsApp" wa.me link only. Blast is a later add-on. |
| Design | Imarah Teal (see `_brand/`). |
| Language | Bahasa Malaysia first, English second. |
| Platform | Responsive PWA. Native apps later via Capacitor. |
| Money | Records, reconciles, reports. Never holds funds. |

## 3. In Phase 1
Roles and isolation; kariah registry; fund-based cash book; collections with two-person confirmation; e-receipts; reports for authorities; period lock and audit log; logo and branding; khairat membership and arrears; DuitNow QR display with bank CSV matching; prayer times; plan limits; in-app help centre.

## 4. Not in Phase 1
Online donations, maker-checker approvals, khairat claims workflow, programmes and events, member view, SPMM tracker, state-specific templates, WhatsApp blast, native apps, payment gateway for subscriptions (plan changes are done by the platform admin; invoices are manual).

## 4b. Phase 2 order (recommended)
1. **Mesyuarat** (meetings and minutes), see `_specs/phase2-meetings.md`. First because it needs no outside service, costs almost nothing to host and supports the trust and governance pitch.
2. **Sambungan AI (MCP)**, read-only first, see `_specs/phase2-mcp.md`. Ask pilots first whether they would use it.
3. Online donations with auto-matching.
4. Maker-checker approvals.
5. Khairat claims workflow.
6. Programmes and events.
7. Member view with kariah card.
8. State-specific report templates.
9. WhatsApp blast add-on.
Order after item 1 can change with pilot feedback.

## 5. Data model
Every table except `masjids` has `masjid_id` and RLS limiting rows to the caller's masjid.

| Table | Purpose | Key fields |
|---|---|---|
| masjids | Tenant | name, address, state, logo_path, plan, prayer_zone, duitnow_payload |
| memberships | User to one masjid with a role | user_id (UNIQUE), masjid_id, role, status |
| households | Kariah households | masjid_id, head_name, address, phone, whatsapp_opt_in, pdpa_consent_at |
| members | People in a household | household_id, name, ic_last4, date_of_birth, relation |
| funds | Tabung Am, Pembangunan, Khairat, Amal Jariah, etc. | masjid_id, name, restricted |
| categories | Income and expense categories | masjid_id, name, type (income or expense) |
| transactions | Every receipt and payment, append-only | masjid_id, fund_id, category_id, amount_sen, direction, date, ref_no, method, status, reverses_id, household_id (optional) |
| collections | Friday box counts | masjid_id, date, fund_id, total_sen, counted_by, confirmed_by, transaction_id |
| khairat_plans, khairat_members | Fees, status, arrears | masjid_id, household_id, year, fee_sen, coverage, pay_by, fund_id, people, paid_sen, ended_at |
| bank_lines | Imported bank statement lines | masjid_id, date, amount_sen (signed), description, matched_transaction_id, import_id, line_hash, cash_transfer, rejected_ids |
| bank_formats, bank_imports | Saved column choices per bank; one row per uploaded file | masjid_id, name, date_column, description_columns, debit/credit or amount column, date_order; file_name, lines_added, lines_skipped, cancelled_at |
| periods | Month locks | masjid_id, month, locked_at, locked_by, unlock_reason |
| audit_log | Who changed what, when; never edited | masjid_id, user_id, table_name, row_id, action, before, after, at |

Also: `receipt_counters` (masjid_id, year, last_no) for gapless receipt numbers, and `reports` (masjid_id, type, period, storage_path, generated_by, at).

Also (Step 3): `invitations` (masjid_id, email, role, token_hash, invited_by, expires_at, accepted_at, accepted_by, revoked_at). Only a hash of the link token is stored; links last 7 days; one open invitation per email per masjid.

### Sign-in and access decisions (Step 3)
- Sign-in: email and password, or a magic link for existing accounts. New masjids start from self sign-up (email confirmation), then onboarding creates the masjid and makes the creator its Pengerusi.
- Invitations: the Pengerusi gets a copy-link (and WhatsApp share). Email through Resend is sent when `RESEND_API_KEY` is set. The invitee sets a name and password on the link page; the link only works for the invited email.
- A removed member can only be invited back to the same masjid (one membership per user, kept for history). Joining another masjid needs a different email.
- Platform admin: an account with `app_metadata.platform_admin = true` (set only with the service key, via `npm run admin:create`). Must pass 2-step verification (authenticator app) every session, can never hold a masjid membership, signs in at `/pentadbir/log-masuk`. Can list masjids and set the plan only. Every list view and plan change is written to that masjid's own audit log (action `VIEW` or `UPDATE`), visible to its Pengerusi.

### Logo and prayer-time decisions (Step 4)
- Logos: private Storage bucket `masjid-logos`, files at `masjids/<masjid_id>/logo-<time>.<png|svg>`, max 1 MB, PNG or SVG (checked by the file's bytes; SVGs with scripts, event handlers or outside links are refused). Members read their own folder; only the Pengerusi writes. Shown through one-hour signed links made on the server. `masjids.logo_path` must point inside the masjid's own folder (database check).
- Prayer times: `lib/prayer-times.ts` only. api.waktusolat.app month by zone, cached 12 hours on the server -> bundled `data/prayer-times/<year>.json` (all JAKIM zones) -> strip hidden. Strict checks; times are never guessed. Shown: Subuh, Zohor, Asar, Maghrib, Isyak (Syuruk left out, as on the designs). Next prayer highlighted; after Isyak the strip shows tomorrow.
- **Yearly task:** run `npm run prayer:fetch-year -- <year>` once JAKIM publishes the new year (2027 was not published on 25 Nov 2026), commit the file and deploy before 1 January.
- Seed masjids: A in Selangor (SGR01) with a sample logo, B in Pulau Pinang (PNG01) without one, so zones and logos can be told apart.

### Kariah decisions (Step 5)
- `households.whatsapp_consent_at` added; a check keeps `whatsapp_opt_in` and its date in step. Ticking a consent box records the date; unticking clears it (the audit log keeps the withdrawal).
- Phones stored as digits with the leading 0 (`lib/phone.ts` repairs +60, spaces, a lost leading 0; refuses Excel's 1.23E+09).
- IC: last 4 digits only; a full 12-digit IC is cut on the device and again on the server.
- CSV import: one row per household (`nama_ketua, alamat, telefon, whatsapp, pdpa`); members are added on screen. UTF-8 or Windows-1252, comma or semicolon. Preview checks every row; confirm re-checks the whole file on the server. Duplicate = same phone, or same name and address. "ya" consent records the import date.
- `checkPlanLimit` in `lib/plan-limits.ts` (Asas: 150 households) is checked by the app on add and import; the database enforces it from Step 13.
- Household change history (`household_history`) for Pengerusi and Bendahari: who, when, which fields. Personal fields show "changed" only; the log never held their values.

### Cash book decisions (Step 6)
- New masjids get default categories (income: Kutipan Jumaat, Derma, Sewaan dewan, Khairat, Lain-lain; expense: Bil elektrik/air, Gaji, Penyelenggaraan, Kebajikan, Lain-lain) and default funds: Tabung Am and Pembangunan (restricted) on Asas; also Khairat Kematian (restricted) and Amal Jariah on paid plans. New masjids start on Asas, so they get two; more are added under Tetapan > Dana & kategori.
- Funds and categories are archived, never deleted (`archived_at`). A fund can be archived only at a zero balance (database trigger). Asas counts active funds only (app check; database from Step 13). Category type (income or expense) cannot change after creation. Who: Pengerusi and Bendahari (`funds.manage`).
- Rules on every new entry (trigger `check_transaction`): no date after today in Malaysia; no archived fund or category; an ordinary entry's category must match its direction; a reversal needs a reason, keeps the original's category and cannot be dated before it. Rows saved before Step 6 are untouched.
- A reversal is dated today, so a correction to a locked month lands in the current open month. It counts against the side it cancels: a cancelled receipt lowers income rather than adding an expense (same rule in `lib/cashbook.ts`, `fund_summary` and `masjid_totals`).
- `fund_summary(from, to)` runs with the caller's rights (Imam gets nothing). `masjid_totals(month)` gives the total and the month's income and expense to every role including the Imam, never the rows. `member_names()` gives names only (no emails) of the masjid's own people for "recorded by" lines.
- Attachments: private bucket `transaction-files`, `masjids/<masjid_id>/<uuid>.<jpg|png|webp|pdf>`, max 5 MB. Uploaded from the browser straight to Storage as the user (Vercel limits server requests to 4.5 MB), then the server re-checks the file's bytes before saving the entry. Bendahari uploads; P, B, S, AJK read; a file saved with an entry can never be deleted or replaced; an upload that never became an entry can be removed by the Bendahari.
- Ledger running balance only for one fund with no other filter. CSV export: plain numbers in separate in and out columns, cells that Excel would run as formulas get a leading apostrophe.

### Collection decisions (Step 7)
- Statuses: `counted` -> `confirmed`, or `counted` -> `needs_review` (confirmer's figure differs; nothing posted) -> recount -> `counted` -> `confirmed`. A count can be `void` (cancelled with a reason) before confirmation by the counter, the Pengerusi or the Bendahari. Confirmed and void counts can never change (trigger, applies to the secret key too).
- Every write goes through security-definer functions `record_collection`, `confirm_collection`, `recount_collection`, `cancel_collection`; direct insert, update and delete on `collections` are revoked for app users. The check `confirmed_by <> counted_by` (Step 2) and `checked_by <> counted_by` hold for everyone.
- Blind confirmation: the confirmer types their own count; the first figure is hidden in the app until confirmed (the counter sees their own; both figures show after a difference). This is a screen rule; the row is still readable by finance roles through the API.
- Whoever recounts becomes the counter, so a different person must confirm.
- On a match the function posts one receipt in the same database transaction: fund and date of the count, category "Kutipan Jumaat" (if it exists and is open), method cash, `created_by` = confirmer, and a receipt number. Confirming again returns `confirmed` and posts nothing (row lock).
- Receipt numbers (started here, extended to all receipts in Step 8, see below): `RC-<year>-<0001>` per masjid per calendar year of the entry date, from `receipt_counters` locked by the update in the same transaction; never reused, even after a reversal. Only the system writes `transactions.receipt_no` (column-level insert grant excludes it).
- Idempotency: `client_key` (made on the phone when the form opens) is unique per masjid; sending again, even five at once, returns the first count.
- Offline: a count made with no signal is kept in that browser's localStorage, per user, shown as "Belum dihantar", and sent on reconnect, on page open or by "Hantar sekarang". Pages are still never cached by the service worker (Step 1 decision), so offline saving works when the count screen was open before the signal dropped.
- Breakdown: RM100, 50, 20, 10, 5, 1 notes counted by number; coins as one amount (`coins_sen`). The database checks it adds up to the total.

### E-receipt decisions (Step 8)
- Every new money-in entry that is not a cancellation gets a receipt number from trigger `zz_assign_receipt_no` (runs after the other checks; a refused entry rolls the counter back, so no gaps). Payments and reversals never carry one (check constraint). Collections keep the number `confirm_collection` gives them; same sequence. Entries saved before Step 8 have no number and no receipt (owner decision: only test data existed).
- `transactions.received_from` (optional donor name, max 100) is printed as "Daripada"; blank prints "—". It is hidden in the audit log like other personal data.
- Donor email is used once to send through Resend with the PDF attached and is never stored. `log_receipt_emailed(id)` (P, B) writes an `EMAIL` row to the audit log without the address.
- PDF: A5, drawn with `pdf-lib` on the server (`lib/pdf/receipt.ts`), Plus Jakarta Sans bundled from `lib/pdf/fonts/` (OFL). Always in Malay. SVG logos are drawn to PNG with `@resvg/resvg-wasm`, loaded at run time; nothing native, because the owner's drive D (exFAT) cannot hold the links Next.js makes for native or external packages. A logo that cannot be read prints the initials.
- Cancelled receipts keep their number; the copy shows a BATAL badge, note and diagonal watermark, and cannot be shared or emailed.
- Share link: `/r/<id>.<expiry>.<signature>`, HMAC-SHA256 with `RECEIPT_LINK_SECRET`, valid 30 days. The route is public and reads only that one receipt with the service key after checking the signature; a bad or expired link gets a plain Malay page (404/410). WhatsApp share is a `wa.me/?text=` link; the system sends nothing.
- "Dijana oleh Imarah": always on Asas; paid plans can hide it with `masjids.receipt_hide_credit` (Pengerusi, Tetapan > E-resit).
- Permissions: view and download P, B, S, AJK (`receipts.view`); share and email P, B (`receipts.share`). The Imam cannot read transactions at all.

### Khairat decisions (Step 9)
- Standard plan and above: `planHasFeature(plan, "khairat")` in `lib/plan-limits.ts` for screens; `private.khairat_allowed()` in the database for setup policies and every khairat function. Asas sees an upgrade message.
- `khairat_plans` per masjid per year: `fee_sen`, `coverage` (household | person), `pay_by` (last day to pay, a date in that year; owner chose a date over a number of days), `fund_id` (default the fund named Khairat…). Set by Pengerusi and Bendahari. The year never changes.
- `khairat_members` per household per year, written only through `enrol_khairat`, `renew_khairat` (last year's members who did not end) and `end_khairat` (reason required; Bendahari, Setiausaha). `people` is fixed at enrolment: 1 per household, or the household's listed members (at least 1) per person. Due = fee × people.
- Status is worked out, not stored (`lib/khairat.ts`): tamat if ended; aktif if paid in full or today is on or before `pay_by`; otherwise tunggakan. Arrears count only for tunggakan. Earlier years' arrears are shown per household.
- Payments only through `record_khairat_payment` (Bendahari, Setiausaha): a receipt in the setup's fund, category "Khairat", `household_id`, `khairat_member_id`, note "Yuran khairat <year>", "Daripada" = head of household unless typed. Never more than the year's balance (row lock, so two at once cannot overpay; owner decision). Receipt number from Step 8.
- `paid_sen` follows the ledger only: a trigger adds each linked payment and takes off a payment when it is reversed. App users cannot write members or `transactions.khairat_member_id`. Seed amounts paid before Imarah have no ledger entry.
- No claims in Phase 1.

### DuitNow QR and bank matching decisions (Step 10)
- No pilot statement was available when Step 10 was built. The parser was built and tested on two made-up layouts (`tests/fixtures/bank-contoh-*.csv`: separate debit/credit with account details above the header; one signed amount column with named months). The first real pilot CSV must be imported and reconciled to zero before Step 10 counts as checked.
- DuitNow QR: `masjids.duitnow_payload` keeps only the QR text (EMVCo), never the picture. The picture is read in the browser (`jsqr`); `lib/duitnow.ts` checks the layout, the CRC at the end, country MY and currency 458, and shows the account name inside it; the Pengerusi must tick that the name is the masjid's account. Set by the Pengerusi (`settings.manage`). QR drawn with `qrcode` (pure JS) on screen and in the PDF. `masjids.receipt_show_qr` prints it on receipts (not on cancelled copies).
- "Terima derma" (`/derma`) shows the QR to every role, including the Imam, and prints as a poster (app menus are hidden when printing).
- `bank_formats` (one per bank per masjid): columns kept by header text, so the header row is found again even with account details above it; either one signed amount column or debit and credit columns; date order dmy/ymd/mdy. Bendahari writes, Pengerusi reads.
- `bank_imports` (file name hidden in the audit log), `bank_lines.import_id`, `line_hash`, `cash_transfer`, `rejected_ids`. All writes to lines and imports through `import_bank_lines`, `match_bank_line`, `mark_bank_cash`, `clear_bank_line`, `reject_bank_suggestion`, `cancel_bank_import` (Bendahari only); direct insert, update and delete are revoked.
- Duplicates: `line_hash` = SHA-256 of date, amount in sen, description (lower case, spaces collapsed) and how many identical lines came before it in the same file; unique per masjid. Re-importing a file adds nothing; two identical payments on one day both stay. Lines from before Step 10 got a `lama-` hash.
- A file is read on the server again before saving (max 900 KB, 5,000 lines). Lines in a locked month are shown and left out; the database refuses them anyway.
- Matching: one bank line to one ledger entry (unique index), same signed amount, entry not cash, not cancelled and not a cancellation. Suggestions within 3 days, closest first, each entry once; a rejected suggestion is not shown again for that line. Manual matching at any date. When an entry is reversed, its match is removed by a trigger unless the bank line is in a locked month (then it shows as needing attention).
- Reconciliation (owner decision): one bank account per masjid for now. Bank total = all lines in the month. Ledger total = the month's non-cash entries (bank transfer, DuitNow, cheque, cancellations included) + lines marked as a cash deposit or cash withdrawal (cash already in the ledger as the cash entry). Difference shown; goal RM 0.00. Lists: unmatched lines, unmatched entries (an entry and its cancellation in the same month are left out), matches across months (timing differences).
- An unmatched line can open the new-entry form filled in (date, amount, direction, method bank transfer, note = description); saving matches it.
- Cancelling an import deletes its lines, only while none is matched or marked and none is in a locked month; the import row stays, marked cancelled.
- All plans, including Asas (owner decision). Pengerusi views the reconciliation read-only (`bank.view`); Bendahari does everything else (`bank.match`). No bank credentials are ever asked for or stored.


1. Money in integer sen.
2. Transactions never edited or deleted; reversing entry via `reverses_id`.
3. Trigger rejects any change dated inside a locked period.
4. Trigger writes every insert/update/delete to `audit_log`; no role can change the log.
5. A user has exactly one membership.
6. Platform admin login is separate and every use is logged.
7. Minimum personal data; IC last digits only.

## 7. Roles
See `_specs/roles-permissions.md`.

## 8. Plan limits (Asas)
Max 3 users, 150 households, 2 funds, monthly PDF only, Imarah footer on outputs. Enforced in the database and shown in the UI with a clear message.

## 9. Open items (do not block the build)
Terms of use for JAKIM prayer-time data and api.waktusolat.app (check before launch); exact report formats per state; collection permit rules; whether a masjid may pay a software fee from kariah funds; PDPA and hosting abroad (Singapore); JAKIM prayer-time data terms; terms of service; SSM entity; service tax on subscription.

## 10. Done means
Pilot success measures: treasurer closes one full month; Friday collection recorded in under 3 minutes; Pengerusi can find who changed a figure and when; treasurer names a price they would pay.
