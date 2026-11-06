# Step 15. In-app help and user manual

**Before you start:** Nothing else needed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/help-articles.md and _specs/roles-permissions.md. Do ONLY Step 15. Plan mode first.
>
> 1. Write markdown help articles in content/help/ms/ and content/help/en/ for every row in _specs/help-articles.md. Each: purpose, numbered steps matching the real screens, "Jika ada masalah". Plain everyday Malay. Include screenshots only if captured by Playwright from the seeded app.
> 2. Bantuan page: searchable article list; "Mula di sini" checklist per role showing only that role's tasks with tick-off saved per user.
> 3. A "?" button on every screen opening a side panel with the article for that screen. Field-level hints (small help icons) on tricky fields, and helpful empty states.
> 4. "Hubungi sokongan": opens WhatsApp to the support number from an env setting, pre-filled with masjid name and screen.
> 5. "Apa yang baharu": release notes page from content/help/releases.md.
> 6. Printable PDF manual per role generated from the articles.
> 7. Add a test that fails if a route has no help article mapping in either language.
> Run all checks.

## Check (do not move on until all pass)

- Sign in as each role and see only that role's checklist; the '?' panel works on every screen; searching 'resit' finds the receipt article; the PDF manual opens and prints.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: in-app help and manuals`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
