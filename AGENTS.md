# AGENTS.md

## Setup commands
- Install frontend deps: `npm install`
- Install functions deps: `npm --prefix functions install`
- Start dev server: `npm run dev`
- Start Firebase emulators: `npm run emulators`
- Start dev server against emulators: `npm run dev:emulator`
- Run frontend tests: `npm run test`
- Run functions tests: `npm run test-functions`
- Build frontend: `npm run build`
- Build functions: `npm run build-functions`

## CI
- `.github/workflows/ci.yml` runs on pushes to `main` and on PRs, using Node 22: frontend `tsc --noEmit`, `npm run lint`, `vitest run`, and `vite build`; functions `npm run build` and `npm test`. A report-only `npm audit --omit=dev` job runs for both packages.
- `.github/dependabot.yml` opens weekly grouped npm updates for `/` and `/functions` with a 7-day release cooldown.
- Local Node is v24, but CI and Cloud Functions use Node 22.

## Code style
- TypeScript strict mode
- Prefer existing MUI, styled-components, and shared `src/index.css` styles before adding UI dependencies
- Keep Cloud Function-controlled writes authoritative for leaderboard, usernames, multiplayer state, and Spotify imports

## Architecture notes
- Solo and multiplayer rounds are server-run. The client never receives the answer before a round ends; do not reintroduce client-side guess matching or point calculation. Solo callables live in `functions/src/soloRounds.ts`; there is no `submitLeaderboardScore`.
- Shared server game rules: `functions/src/answerMatching.ts` (Unicode-aware normalization, guess matching, points), `functions/src/playlistTracks.ts` (playlist loading for featured, saved, and guest Storage-only playlists), `functions/src/itunesPreview.ts` (timeouts, parallel lookups, Firestore preview cache). Callable helpers are in `functions/src/callableUtils.ts`; new modules must not call `getFirestore`/`getStorage`/`getAuth` at module top level because `index.ts` calls `initializeApp()` after imports.
- Spotify is permanently in Development Mode: use `/playlists/{id}/items` (max limit 50, parse both `item` and `track` entries), per-ID `/tracks/{id}` lookups, and search `limit` 10 with pagination. Playlist contents and other users' playlists may be refused by Spotify; surface the custom-playlist fallback. Spotify OAuth login was removed; `clearLegacySpotifySession()` in `src/utils/auth.ts` clears old browser tokens at startup.
- `firebase.json` header rules: Firebase applies the last matching rule, so keep the general `**` rule before `/assets/**`.
- Profanity: `functions/src/profanity.ts` rejects offensive usernames and room names (`containsProfanity`) and masks multiplayer playlist names (`censorProfanity`).
- Game keyboard shortcuts (Space play, Esc give-up confirm) go through `src/hooks/useGameShortcuts.ts`; keep Space ignored on editable and interactive targets.
- `public/theme-init.js` must load at the start of `<body>` (it needs `document.body`); dark mode styles use `body.dark-theme`.
- `functions/tsconfig.json` sets `rootDir: "src"` explicitly (required by TypeScript 6 editors); output stays at `functions/lib/index.js`.
- Firestore TTL deletes expired docs on the Timestamp `expiresAt` field for collection groups `itunesPreviewCache`, `leaderboard/{uid}/dailyPoints`, `callableRateLimits`, and `leaderboard/{uid}/recentScores`. Manage policies with `gcloud firestore fields ttls update` in Cloud Shell; the Firebase console has no TTL UI. Do not reintroduce numeric `expiresAtMillis` on these docs; solo round state still uses `expiresAtMillis` for its own expiry check, which is unrelated to TTL.

## Testing notes
- A full frontend `vitest run` can hit intermittent 5s timeouts or "Failed to start forks worker" errors under load (TODO MED-26). Re-run the failing files alone before treating them as real failures.
