# Imarah

Sistem Pengurusan Masjid dan Surau. A multi-tenant web app (PWA) for masjids and suraus in Malaysia.

New here? Read `README-START-HERE.md` for the build routine and `CLAUDE.md` for the project rules.

## Run it

You need [Node.js](https://nodejs.org) (LTS).

```
npm install
npm run dev
```

Open http://localhost:3009. (Port 3009, because 3000 is often taken by another project.)

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is git-ignored: never commit it. If you add a new variable, add its name to `.env.example` too.

The app needs the three Supabase values to run. In Supabase, add `http://localhost:3009/**` under Authentication → URL Configuration → Redirect URLs, or email links will not open the app.

| Command | What it does |
|---|---|
| `npm run db:seed` | Fake masjids, users and data in the dev database |
| `npm run test:isolation` | Database security tests against the dev database |
| `npm run admin:create -- email` | Make a platform admin account |

## Checks

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests at desktop and phone width (Playwright) |
| `npm run lint` | Code style checks |
| `npm run typecheck` | TypeScript checks |
| `npm run build` | Production build |

The first time you run `npm run test:e2e`, install the browser with `npx playwright install chromium`.

## Good to know

- **Design tokens:** colours and radii come from `_brand/tokens.json` through `tailwind.config.mts`. Change them there, not in components.
- **Text:** all user-facing text lives in `messages/ms.json` and `messages/en.json`.
- **PWA:** the service worker only runs in a production build, so installing on a phone needs the deployed HTTPS site. It stores static build files only, never pages or data.
- **Icons:** placeholders. Regenerate them from the brand tokens with `npm run icons`.
