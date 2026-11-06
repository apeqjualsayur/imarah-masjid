# Phase 2, Step M2. Meetings: create, list and write minutes

**Before you start:** Step M1 passed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase2-meetings.md, _specs/roles-permissions.md and look at _brand/screens/ for the visual style. Do ONLY Step M2. Plan mode first; show me the screen layouts.
>
> 1. Add "Mesyuarat" to the navigation (Setiausaha, Pengerusi, Bendahari, AJK per roles). All text in messages/ms.json and en.json.
> 2. List page: filter by year, type and status; status badges (Draf, Menunggu kelulusan, Diluluskan); search by title; respect visibility (users never see items they cannot open, not even titles).
> 3. Create meeting: type, title, number, date, time, venue, visibility. Attendees: add from members or type a name; set attendance, chair and recorder; show a quorum line (required vs present).
> 4. Minutes editor (Setiausaha): agenda items; for each item a text box for the discussion; a decisions list (numbered resolutions); an action items list (description, owner, due date). Plain text with simple formatting only (bold, lists). Autosave drafts every few seconds and show "Disimpan" status; works on a phone.
> 5. Plan limit hook: checkPlanLimit(masjid, 'meetings_per_year') (Asas 12 per year). Full gating in Step M5.
> 6. Every save is audited. Tests: permissions, autosave does not create duplicate versions, plan hook, Playwright flow create a meeting with 3 agenda items and 2 actions.
> Run all checks.

## Check (do not move on until all pass)

- As Setiausaha create a meeting with attendees, 3 agenda items, 2 resolutions and 2 actions; refresh and everything is saved.
- As an AJK you cannot see the draft or a restricted meeting.

## Then

1. Commit: `feat(meetings): list, create, minutes editor`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
