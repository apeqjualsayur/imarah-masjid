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
2. Online donations with auto-matching.
3. Maker-checker approvals.
4. Khairat claims workflow.
5. Programmes and events.
6. Member view with kariah card.
7. State-specific report templates.
8. WhatsApp blast add-on.
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
| khairat_plans, khairat_members | Fees, status, arrears | masjid_id, household_id, year, fee_sen, paid_sen |
| bank_lines | Imported bank statement lines | masjid_id, date, amount_sen, description, matched_transaction_id |
| periods | Month locks | masjid_id, month, locked_at, locked_by, unlock_reason |
| audit_log | Who changed what, when; never edited | masjid_id, user_id, table_name, row_id, action, before, after, at |

Also: `receipt_counters` (masjid_id, year, last_no) for gapless receipt numbers, and `reports` (masjid_id, type, period, storage_path, generated_by, at).

## 6. Rules that never bend
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
Exact report formats per state; collection permit rules; whether a masjid may pay a software fee from kariah funds; PDPA and hosting abroad (Singapore); JAKIM prayer-time data terms; terms of service; SSM entity; service tax on subscription.

## 10. Done means
Pilot success measures: treasurer closes one full month; Friday collection recorded in under 3 minutes; Pengerusi can find who changed a figure and when; treasurer names a price they would pay.
