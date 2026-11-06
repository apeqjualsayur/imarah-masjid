# Roles and permissions (draft, confirm with pilot masjids)

Y = allowed, V = view only, - = no access. Enforced in RLS; the UI hides what a role cannot do.

| Capability | Pengerusi | Bendahari | Setiausaha | AJK | Imam |
|---|---|---|---|---|---|
| Dashboard and fund balances | Y | Y | V | V | V (totals only) |
| Kariah registry (view) | Y | V | Y | V | - |
| Kariah registry (edit, import) | - | - | Y | - | - |
| Khairat membership and arrears (view) | Y | Y | Y | V | - |
| Khairat fees (record payment) | - | Y | Y | - | - |
| Record receipt or payment | - | Y | - | - | - |
| Reverse a transaction | Y | Y | - | - | - |
| Enter Friday collection count | - | Y | - | Y | - |
| Confirm collection (must be a different person from the counter) | Y | Y | - | Y | - |
| E-receipts (view, share) | Y | Y | V | V | - |
| Import bank statement, match | - | Y | - | - | - |
| Lock or unlock a month | Y | - | - | - | - |
| Prepare reports | Y | Y | Y | - | - |
| Download official report (locked month only) | Y | Y | Y | - | - |
| Audit log (view) | Y | V | - | - | - |
| Invite or remove users, change roles | Y | - | - | - | - |
| Masjid settings, logo | Y | - | - | - | - |
| Plan and billing page | Y | - | - | - | - |

Rules:
- A person cannot confirm their own collection count.
- Removing the last Pengerusi is blocked.
- Unlocking a month needs a reason and is written to the audit log.

## Phase 2: Meetings (Mesyuarat)

| Capability | Pengerusi | Bendahari | Setiausaha | AJK | Imam |
|---|---|---|---|---|---|
| Create and edit draft minutes | - | - | Y | - | - |
| Submit for approval | - | - | Y | - | - |
| Approve or return with reason | Y | - | - | - | - |
| Amend approved minutes (new version) | - | - | Y (then Pengerusi approves) | - | - |
| View approved minutes (visibility semua_ajk) | Y | Y | Y | Y | Pengerusi can grant |
| View restricted (terhad) minutes | Y | - | Y | - | - |
| View drafts | Y | - | Y | - | - |
| Update action item status | Y | - | Y | owner only | - |
| Export PDF (approved) | Y | Y | Y | Y | - |
| Letterhead settings | Y | - | - | - | - |
| Per-meeting audit timeline | Y | - | Y | - | - |
