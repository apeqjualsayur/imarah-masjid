# Phase 2, Step MCP2. AI connection: sign-in and tokens

**Before you start:** Step MCP1 passed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md and _specs/phase2-mcp.md. Do ONLY Step MCP2. Plan mode first. Before planning, read the current MCP specification and its authorization section and the SDK docs, and tell me which version you will follow and any decision I need to make. Do not guess protocol details.
>
> 1. Implement the OAuth 2.1 authorization code flow with PKCE with the metadata endpoints an MCP client needs, for an authorization server living in this app (or tell me if using Supabase's OAuth server is better and why).
> 2. Consent screen in Bahasa Malaysia: shows the AI client name, the masjid, the user's role, and plain-language read-only access; Allow and Cancel. If the masjid switch is off, show a clear message and do not issue anything.
> 3. Issue short-lived access tokens and refresh tokens; store only hashes; create an mcp_grants row. Support revocation that takes effect immediately.
> 4. Never accept a masjid_id from the client; the grant is tied to the user's single membership.
> 5. Tests: token for masjid A cannot be used for masjid B; expired, revoked and tampered tokens rejected; PKCE failure rejected; switch off blocks issuing.
> Run all checks and tell me how to test the flow with the MCP Inspector tool.

## Check (do not move on until all pass)

- With the masjid switch on, the MCP Inspector can complete sign-in as a Setiausaha and shows a granted connection.
- With the switch off, sign-in is refused with a clear message. Revoking the grant stops access immediately.

## Then

1. Commit: `feat(mcp): oauth sign-in and grants`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
