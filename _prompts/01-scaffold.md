# Step 1. Scaffold, design tokens, language, PWA

**Before you start:** Nothing else needed.

## Prompt (paste into Claude Code)

> Read CLAUDE.md, _specs/phase1.md and look at the images in _brand/screens/. Do ONLY Step 1. Start in plan mode.
>
> Build the project foundation:
> 1. Create a Next.js app (App Router, TypeScript strict, Tailwind, ESLint) in this repo root. Keep my existing folders.
> 2. Load Plus Jakarta Sans (400/500/600/700). Put every colour and radius from _brand/tokens.json into the Tailwind config as named tokens (primary, primary-dark, tint, background, surface, border, ink, muted, gold, etc). No hard-coded hex values in components.
> 3. Add next-intl with Bahasa Malaysia (ms) as default and English (en) second. Create messages/ms.json and messages/en.json. Add a language toggle. No hard-coded user-facing text.
> 4. Build a placeholder responsive app shell that matches the Imarah Teal screens: desktop = white sidebar (logo placeholder, masjid name, nav items: Utama, Kewangan, Kariah, Khairat, Laporan, Tetapan), main area, small quiet prayer-time strip at top right (static sample times for now); phone = top header, bottom tab bar (Utama, Kewangan, Kariah, Khairat, Lagi). Footer credit "Dikuasakan oleh Imarah".
> 5. Add Serwist PWA: manifest, icons (simple placeholders), installable on a phone.
> 6. Add Vitest and Playwright with one passing example test each. Add a money helper in lib/money.ts (integer sen in, "RM 1,234.50" out) with unit tests.
> 7. Add .env.example usage, a README with run instructions (npm install, npm run dev, npm test).
> Finish by running lint, type-check and tests. Then tell me: the commands to run, and what to look at on desktop and phone width.

## Check (do not move on until all pass)

- `npm run dev` opens the app; it looks like the Imarah Teal screens at desktop and phone width.
- Toggle BM/EN changes labels.
- On your phone (same Wi-Fi, or after deploying), "Add to Home Screen" works.
- `npm test` passes.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: scaffold app, tokens, i18n, PWA shell`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
