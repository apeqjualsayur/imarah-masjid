# Phase 2, Step MCP5. AI connection: admin screens, guides, help, final checks

**Before you start:** Step MCP4 passed. Have a Claude account and, if available, another MCP-capable AI to test with.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase2-mcp.md section 7 and the Phase 2 AI connection rows in _specs/help-articles.md. Do ONLY Step MCP5. Plan mode first.
>
> 1. Sambungan AI admin page for the Pengerusi: list of connected users and clients with last used time, call log (tool, time, status, row count, no personal data), Revoke buttons. "Sambungan saya" for every user with their own connections and Revoke.
> 2. "Cara sambung" guides in BM and English with the connector URL and step-by-step instructions. Check the current official instructions for connecting a remote MCP server in Claude and ChatGPT and write only what you can confirm; tell me anything you could not verify.
> 3. A "Contoh soalan" panel with 8 sample questions in Malay per role.
> 4. Write the 5 help articles for the AI connection in content/help/ms and en, map routes for the "?" panel, update release notes and manuals.
> 5. Final checks: re-run all isolation tests; confirm no personal data in logs or Sentry; confirm rate limits by plan; add an MCP section to _specs/security-review.md covering prompt injection, token handling and data minimisation.
> 6. Walk me through a real test: connect my own Claude to the dev app and ask 5 questions; list what worked and what did not.
> Run all checks.

## Check (do not move on until all pass)

- Connect your own Claude (or other AI) to the dev app, ask "Berapa baki Tabung Am?" and the number matches the app.
- Revoke from the admin page and the next question fails.
- Another masjid's data never appears; all isolation tests pass.

## Then

1. Commit: `feat(mcp): admin screens, guides, help, security notes`
2. Push, check the Vercel preview.
3. Tell Claude: "Step done. What is the next step?"

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
