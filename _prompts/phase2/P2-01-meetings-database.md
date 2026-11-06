# Phase 2, Step M1. Meetings: database, rules, audit

**Before you start:** Phase 1 is finished and live (Steps 0 to 15 pass their checks). Read _specs/phase2-meetings.md first. Collect 2 sample minutes and a letterhead from a pilot (see _specs/pilot-checklist.md).

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase2-meetings.md and _specs/roles-permissions.md (meetings section). Do ONLY Step M1. Plan mode first; show me the tables and policies before writing.
>
> 1. Write new migrations (never edit old ones) for meetings, meeting_attendees, meeting_versions, meeting_actions and letterhead exactly as in _specs/phase2-meetings.md section 5. Every table: masjid_id, RLS, audit trigger.
> 2. RLS per roles: drafts visible only to Setiausaha and Pengerusi; approved minutes visible to Pengerusi, Bendahari, Setiausaha, AJK when visibility is semua_ajk; terhad visible only to Pengerusi and Setiausaha. Writes only by the roles in the matrix.
> 3. Triggers: an approved meeting_versions row cannot be updated or deleted; meeting status can only move draf > menunggu_kelulusan > diluluskan, or menunggu_kelulusan > draf (return with reason), or draf > dibatalkan; only a user holding the Pengerusi role can set diluluskan; action item status can change after approval but nothing else about approved content can.
> 4. A server function approve_meeting(meeting_id) that computes a SHA-256 hash of the version content, stores hash, approver and time, and sets status. Never compute the hash in the browser.
> 5. Seed fake data: 1 approved AJK meeting, 1 draft, 1 restricted meeting for each seeded masjid.
> 6. Tests in tests/isolation/ and tests/meetings/: masjid A cannot read or write masjid B meetings; AJK cannot see drafts or terhad meetings; a Bendahari cannot edit; an approved version cannot be edited or deleted; illegal status jumps are rejected; hash changes if content changes and the stored hash stays fixed.
> Run migrations on imarah-dev, seed, run all tests, and show me the output.

## Check (do not move on until all pass)

- All new isolation and rule tests pass.
- Ask Claude: "List every new table with RLS, audit trigger and test." No gaps.

## Then

1. Commit: `feat(meetings): schema, rules, approval function`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
