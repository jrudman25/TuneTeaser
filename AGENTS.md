# AGENTS.md

## Setup commands
- Install frontend deps: `npm install`
- Install functions deps: `npm --prefix functions install`
- Start dev server: `npm run dev`
- Start Firebase emulators: `npm run emulators`
- Start dev server against emulators: `npm run dev:emulator`
- Run frontend tests: `npm run test`
- Run functions tests: `npm run test-functions`
- Run Firestore/Storage security rules tests: `npm run test:rules` (needs the Firebase CLI and Java 21; starts the firestore and storage emulators under project `demo-tuneteaser`)
- Build frontend: `npm run build`
- Build functions: `npm run build-functions`

## CI
- `.github/workflows/ci.yml` runs on pushes to `main` and on PRs, using Node 22: frontend `tsc --noEmit`, `npm run lint`, `vitest run`, and `vite build`; functions `npm run build` and `npm test`; a `rules` job installs Java 21 and `firebase-tools@15.34.2` and runs `npm run test:rules`. On PRs only, `actions/dependency-review-action` fails if the PR adds a runtime dependency with a high or critical advisory. There is no `npm audit` job: existing advisories are tracked by Dependabot alerts and security updates (enabled in repo settings, along with malware alerts).
- `.github/dependabot.yml` opens weekly grouped npm minor/patch updates for `/` and `/functions` with a 7-day release cooldown. npm major version updates are ignored (do them by hand with the migration guide); security updates still open regardless.
- Local Node is v24 (npm 11), but CI and Cloud Functions use Node 22 (npm 10). npm 10 is stricter about lockfile/peer mismatches, so after dependency changes verify with `npx -y npm@10 ci --dry-run` in a temp copy of `package.json` + `package-lock.json`. Frontend TypeScript must stay on 5.x for now: `vite-tsconfig-paths` -> `tsconfck` peers `typescript ^5`.

## Code style
- TypeScript strict mode
- Prefer existing MUI, styled-components, and shared `src/index.css` styles before adding UI dependencies
- Keep Cloud Function-controlled writes authoritative for leaderboard, usernames, multiplayer state, and Spotify imports

## Architecture notes
- Solo and multiplayer rounds are server-run. The client never receives the answer before a round ends; do not reintroduce client-side guess matching or point calculation. Solo callables live in `functions/src/soloRounds.ts`; there is no `submitLeaderboardScore`.
- Shared server game rules: `functions/src/answerMatching.ts` (Unicode-aware normalization, guess matching, points), `functions/src/playlistTracks.ts` (playlist loading for featured, saved, and guest Storage-only playlists), `functions/src/itunesPreview.ts` (timeouts, parallel lookups, Firestore preview cache). Callable helpers are in `functions/src/callableUtils.ts`; new modules must not call `getFirestore`/`getStorage`/`getAuth` at module top level because `index.ts` calls `initializeApp()` after imports.
- Spotify is permanently in Development Mode: use `/playlists/{id}/items` (max limit 50, parse both `item` and `track` entries), per-ID `/tracks/{id}` lookups, and search `limit` 10 with pagination. Playlist contents and other users' playlists may be refused by Spotify; surface the custom-playlist fallback. Spotify OAuth login was removed; `clearLegacySpotifySession()` in `src/utils/auth.ts` clears old browser tokens at startup.
- `firebase.json` header rules: Firebase applies the last matching rule, so keep the general `**` rule before `/assets/**`. When adding an external origin, update the CSP there too (Umami needs `cloud.umami.is` in `script-src` and `connect-src`, plus `gateway.umami.is` in `connect-src` for event sends).
- Analytics: Umami lives in `src/utils/analytics.ts`; `initAnalytics()` injects the script only in production builds, and `trackEvent()` is a no-op when Umami is absent or blocked.
- Profanity: `functions/src/profanity.ts` rejects offensive usernames and room names (`containsProfanity`) and masks multiplayer playlist names (`censorProfanity`).
- Game keyboard shortcuts (Space play, Esc give-up confirm) go through `src/hooks/useGameShortcuts.ts`; keep Space ignored on editable and interactive targets.
- `public/theme-init.js` must load at the start of `<body>` (it needs `document.body`); dark mode styles use `body.dark-theme`.
- `functions/tsconfig.json` sets `rootDir: "src"` explicitly (required by TypeScript 6 editors); output stays at `functions/lib/index.js`.
- Firestore TTL deletes expired docs on the Timestamp `expiresAt` field for collection groups `itunesPreviewCache`, `leaderboard/{uid}/dailyPoints`, `callableRateLimits`, and `leaderboard/{uid}/recentScores`. Manage policies with `gcloud firestore fields ttls update` in Cloud Shell; the Firebase console has no TTL UI. Do not reintroduce numeric `expiresAtMillis` on these docs; solo round state still uses `expiresAtMillis` for its own expiry check, which is unrelated to TTL.

- Scheduled multiplayer jobs filter and order by deadline and page through results with `processQueryPages` (batches of 50, 40s budget). Their composite indexes live in `firestore.indexes.json`; deploy indexes (`firebase deploy --only firestore:indexes`) and let them build before deploying functions that use new queries.

## Testing notes
- Rules tests live in `rules-tests/` with their own `vitest.config.ts` (node environment) and are excluded from the root `vitest run`. `@firebase/rules-unit-testing` v6 contexts return the compat SDK (`.doc()`, `.ref().put()`, `.getMetadata()`; no `getBytes()`). When changing `firestore.rules` or `storage.rules`, add or update a case there.
- CI has no `.env`, so any test that imports `src/backend/FirebaseConfig` (directly or through a util) must `vi.mock('../backend/FirebaseConfig', ...)`, or it fails with `auth/invalid-api-key`. Reproduce locally with `VITE_FIREBASE_API_KEY= npx vitest run` (process env overrides `.env`).
- A full frontend `vitest run` can hit intermittent 5s timeouts or "Failed to start forks worker" errors under load (TODO MED-26). Re-run the failing files alone before treating them as real failures.
