# Phase 2, Step MCP1. AI connection: foundation

**Before you start:** Phase 1 live. Read _specs/phase2-mcp.md. Optional: meetings module done.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase2-mcp.md and _specs/roles-permissions.md (AI connection section). Do ONLY Step MCP1. Plan mode first.
>
> 1. Migrations (new, never edit old): mcp_clients, mcp_grants, mcp_tokens, mcp_calls, and masjids.mcp_enabled (default false) and masjids.mcp_share_sensitive (default false). RLS and audit triggers on all; token tables readable only by server code, never by the browser.
> 2. Settings > Sambungan AI page (Pengerusi only): master switch and the sensitive-fields switch, each with a plain BM explanation of what data an AI service would receive. Changing a switch is audited. Other roles see a read-only note.
> 3. Add MCP rate-limit settings per plan to lib/plans.ts (configurable numbers; use placeholders and tell me what you chose).
> 4. Isolation and permission tests for the new tables and settings. No MCP endpoint yet.
> Run all checks.

## Check (do not move on until all pass)

- Only the Pengerusi can switch AI connection on or off; the change appears in the audit log.
- Isolation tests pass for the new tables.

## Then

1. Commit: `feat(mcp): tables, settings, rate-limit config`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
