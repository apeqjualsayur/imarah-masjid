# Step 4. App shell, masjid logo, prayer times

**Before you start:** Pick the correct JAKIM zone codes for 2 test masjids. Verify JAKIM data terms of use and the terms of api.waktusolat.app before launch (open item).

## Prompt (paste into Claude Code)

> Read CLAUDE.md and _specs/phase1.md; look at _brand/screens/ (desktop, mobile, logos). Do ONLY Step 4. Plan mode first.
>
> 1. Replace the shell placeholders with real data: masjid name, address line and logo in the sidebar (desktop) and beside the greeting (phone). If no logo, show initials in a tint circle.
> 2. Settings > Logo: upload PNG or SVG (max 1 MB, validate type and size), stored in a private Supabase Storage bucket under masjids/<masjid_id>/, served by signed URL. Crop-safe display in circle or rounded square.
> 3. Prayer-time strip at top right (desktop) and 5-column row (phone): Subuh, Syuruk optional, Zohor, Asar, Maghrib, Isyak; highlight the next prayer in tint. Data by the masjid's prayer_zone (JAKIM zone codes such as SGR01). Reuse the proven approach from masjidview.my: fetch the month from api.waktusolat.app (JAKIM times), fetched on the server, cached per zone per day, then a bundled 12-month fallback file, and never guess times. If everything fails, hide the strip; never break the page. Do not share a database or code dependency with masjidview; copy the approach only. Isolate the fetch in lib/prayer-times.ts so the source can change.
> 4. Storage policies so a masjid can only read/write its own folder. Add isolation tests for Storage.
> 5. Greeting uses the signed-in user's name; "Dikuasakan oleh Imarah" credit stays small.
> Run all checks. Tell me how to verify with the two seeded masjids.

## Check (do not move on until all pass)

- Two masjids show two different logos and never see each other's (try opening the other masjid's logo URL).
- Prayer strip shows correct times for the zone, and the page still works with the network blocked to the feed.

## Then

1. Ask Claude: "Summarise what changed and update the help article and release note." (from Step 4 onward)
2. Commit: `feat: shell, logo upload, prayer times`
3. Push to GitHub. Check the Vercel preview loads.
4. Tell Claude: "Step done. What is the next step?" and open the next prompt file.

**If something fails:** paste the exact error into Claude Code with: "This failed when I did <what you did>. Explain what went wrong in plain words, then fix it, then re-run the checks."
