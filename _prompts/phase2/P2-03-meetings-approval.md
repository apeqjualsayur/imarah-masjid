# Phase 2, Step M3. Meetings: approval, versions, audit timeline

**Before you start:** Step M2 passed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md and _specs/phase2-meetings.md. Do ONLY Step M3. Plan mode first.
>
> 1. Submit for approval (Setiausaha): validates that title, date, at least one attendee and one agenda item exist; changes status to Menunggu kelulusan; the minutes become read-only.
> 2. Pengerusi review screen: read the minutes; Approve (calls approve_meeting) or Return with a required reason (back to Draf, reason shown to the Setiausaha).
> 3. After approval: a green "Diluluskan" banner with approver, date and short reference (first 8 characters of the hash). All text fields read-only.
> 4. Amend (Setiausaha): "Pinda minit" asks for a reason, copies the current approved content into version N+1 as Draf, and goes through the same submit and approve flow. Version history list lets any allowed user open earlier versions read-only and compare differences in plain words ("Ditambah", "Dibuang").
> 5. Action items: after approval the owner or Setiausaha can change status (Belum, Dalam tindakan, Selesai) with the change audited and shown in the timeline; an "Tindakan tertunggak" list on the dashboard for overdue items.
> 6. Per-meeting audit timeline (Pengerusi and Setiausaha): created, edited, submitted, returned, approved, amended, action updates, with who and when.
> 7. Tests: cannot approve your own role incorrectly (only Pengerusi), cannot edit while pending or after approval, amendment keeps old versions intact and unchanged, timeline entries exist, hash verification test (recompute and compare).
> Run all checks.

## Check (do not move on until all pass)

- Submit as Setiausaha, return as Pengerusi with a reason, fix, resubmit, approve. Try editing after approval: blocked.
- Amend an approved meeting: version 2 appears, version 1 is unchanged and readable.
- The audit timeline shows every step.

## Then

1. Commit: `feat(meetings): approval flow, versions, audit timeline`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
