# Phase 2 module: Mesyuarat (meetings and minutes)

Decision (owner, 2026-11-06): Phase 2. Minutes are typed as text inside the app. Export as PDF with the masjid logo and letterhead. Approval is done inside the app. No file attachments in this module (text only), so storage stays tiny.

## 1. Goal
The Setiausaha records a meeting and its minutes in the app, the Pengerusi approves them in the app, and anyone allowed can open or export the approved minutes as a letterhead PDF. Every change is traceable and approved minutes cannot be altered.

## 2. Scope
In: meeting record, attendees and quorum, agenda, minutes sections, decisions (resolutions), action items with owners and status, draft and approval flow, versions, per-meeting audit timeline, visibility setting, letterhead settings, PDF export, plan gating, help articles.
Out (later): attachments, e-signature images, voting, linking a resolution to a payment, calendar invites, notifications by WhatsApp, a general document library.

## 3. Meeting types
AJK (mesyuarat jawatankuasa), Agung (AGM), Khas (special), Lain-lain.

## 4. Status flow
`draf` > `menunggu_kelulusan` > `diluluskan` (locked).
- Draf: Setiausaha edits freely (autosave). Each save is audited.
- Menunggu kelulusan: submitted by Setiausaha; editing stops; Pengerusi can approve or return to draf with a reason.
- Diluluskan: approved by Pengerusi; content is frozen. A SHA-256 hash of the approved content and the approval time and approver are stored and printed on the PDF.
- Amendment: on an approved meeting the Setiausaha opens "Pinda minit" with a required reason. That creates version N+1 as a new draf. The Pengerusi must approve it. All earlier versions stay readable. The PDF shows the version number.
- Action item status (belum, dalam tindakan, selesai) can change after approval without a new version; each change is audited. Minutes text cannot.

## 5. Data model (all tables have masjid_id, RLS, audit trigger, isolation tests)
| Table | Fields |
|---|---|
| meetings | masjid_id, type, title, meeting_no, meeting_date, start_time, end_time, venue, status, visibility (`semua_ajk` or `terhad`), current_version, quorum_required, quorum_met, created_by, approved_by, approved_at, content_hash |
| meeting_attendees | meeting_id, name, user_id (optional), position_label, attendance (`hadir`, `tidak_hadir`, `mohon_maaf`), is_chair, is_recorder |
| meeting_versions | meeting_id, version_no, content (jsonb: agenda items, minute sections, resolutions), change_reason, status, created_by, created_at, approved_at, content_hash |
| meeting_actions | meeting_id, version_no, description, owner_name, owner_user_id (optional), due_date, status |
| letterhead | masjid_id (unique), header_name, address_lines, phone, email, registration_label, registration_no, footer_text |

Rules: an approved version is immutable (trigger rejects update and delete). Meeting rows move status only along the allowed flow. Hash is computed on the server. Nothing is ever hard-deleted; a draft can be "dibatalkan" with a reason.

## 6. Roles (see `_specs/roles-permissions.md`, meetings section)
Setiausaha writes and submits. Pengerusi approves or returns. Bendahari and AJK view approved minutes. Visibility `terhad` limits viewing to Pengerusi and Setiausaha. Imam: no access unless the Pengerusi grants it (setting). Draft minutes are visible only to Setiausaha and Pengerusi.

## 7. Plans (hypotheses to test)
Asas: up to 12 meetings per year, "Dijana oleh Imarah" footer on PDF. Standard and Pro: unlimited, letterhead, no footer. Later Pro idea: link resolutions to payments.

## 8. Letterhead
Settings page (Pengerusi): header name (default masjid name), address lines, phone, email, optional registration label and number, footer text, with a live preview. The PDF uses the masjid logo from Settings. Do not assume which registration body applies; leave label free text. Receipts and reports keep their current layout until we choose to reuse the letterhead.

## 9. PDF layout (A4)
Header: logo left, name and address block, phone and email, optional registration line, rule. Title "MINIT MESYUARAT [JENIS] BIL. X/TAHUN". Date, time, venue. Attendance table with quorum line. Agenda and minutes by item. Resolutions numbered. Action list table. Signature blocks: "Disediakan oleh" (Setiausaha) and "Diluluskan oleh" (Pengerusi) with name and approval date. Footer: page x of y, version, approval reference (short hash), "Dijana oleh Imarah" on Asas. Draft and pending show a "DRAF" watermark.

## 10. Open questions for pilot masjids
How are minutes written and signed today? Do they confirm minutes at the next meeting (add a "disahkan dalam mesyuarat bil. X" step if so)? Which headings do they always use? Any state rules on records or the AGM pack? Which meetings need restricted visibility? Please collect 2 sample minutes and a letterhead sample.
