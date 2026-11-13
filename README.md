# TuneTeaser

[TuneTeaser](https://tuneteaser.web.app/) is a "Name That Tune" style game where you test your music knowledge against public Spotify playlists, imported Spotify profile playlists, custom mixes, featured guest playlists, and private online multiplayer rooms.

<img width="700" alt="TuneTeaser game screen" src="https://github.com/user-attachments/assets/2b774f0a-2ff9-4347-a8c7-b4713d7f489d" />

## How to Play
1.  **Sign in** to your TuneTeaser account, or use guest mode to try featured playlists and guest imports.
2.  **Import Playlists** by searching public Spotify playlists, pasting a public Spotify playlist URL, browsing public playlists from a Spotify profile URL, or building a custom mix from track URLs and song lines.
3.  **Pick a Playlist** from your playlist library.
4.  **Listen** to a short snippet of a random song.
5.  **Guess** the song title!
    *   Incorrect guesses increase the snippet length up to 30 seconds.
    *   Correct guesses win the round and can earn points for eligible TuneTeaser accounts.
6.  **Play Multiplayer** by creating a private room, sharing the room code or link, choosing a playlist, setting a point goal and round timer, then racing friends through synchronized rounds.

## Features
*   **Smart Matching**: Guesses ignore case, accents, punctuation, short edition metadata, and common title suffixes such as remaster, live, demo, edit, mix, deluxe, and anniversary labels. Non-Latin titles (for example Japanese, Korean, or Cyrillic) can be guessed in their own script. Titles made only of symbols are skipped because they cannot be guessed fairly.
*   **Server-Run Rounds**: Solo and multiplayer rounds are chosen, judged, and timed by Cloud Functions. The browser only receives the preview audio until the round ends, and points are calculated from the snippet length the server tracked.
*   **Dynamic Difficulty**: Single-player snippets start short (2 seconds) and grow longer if you are stumped.
*   **Keyboard Shortcuts**: In solo and multiplayer rounds, press Space to play the snippet (when not typing), Enter to guess, and Esc to give up after a confirm step.
*   **Play Your Way**: Search public Spotify playlists, import public playlists one at a time, page through and select public playlists from a Spotify profile, or build custom mixes from Spotify track links and `Song - Artist` lines.
*   **Playlist Sorting & Filtering**: Find the perfect playlist in your library quickly with title-based searching and sorting by Name, Track Count, and Date Added (including reverse sorting).
*   **Account Clarity**: Signed-in pages show which TuneTeaser account is active.
*   **Retro Arcade Design**: A record-shop inspired interface with arcade-style game panels, responsive layouts, dark mode, toast feedback, and accessible focus states.
*   **Privacy-Friendly Analytics**: Production builds use cookieless Umami analytics for page views and a few game events (guest session, signup, solo round start and finish). Development and emulator sessions send nothing.
*   **Real-Time Leaderboard**: Compete with other music experts! A real-time scoreboard shows the top 10 players and your current position/rank.
*   **Online Multiplayer Rooms**: Create a private room, share a short code or `/multiplayer/{roomCode}` link, let players join with their TuneTeaser usernames, pick a playlist, set a point goal and round timer, then play synchronized rounds with answer reveals, give-up/timed-out states, host kick controls, Play again, and Return to lobby.
*   **Dynamic Scoring**: Points are based on correct guesses and speed. Solve a song in the initial 2-second snippet for a maximum score of 25 points. Slower answers scale down linearly to a base of 10 points.
*   **Fair Play Safeguards & Storage Safety**:
    *   Guest/anonymous profiles are ineligible for points to prevent scoreboard pollution.
    *   Playlists must contain at least 10 tracks to be eligible for points.
    *   TuneTeaser account setup and Settings username changes reserve normalized usernames and update leaderboard display names through callable Cloud Functions, not direct browser writes.
    *   Leaderboard points are only awarded by the server-run solo round callables (`startSoloRound`, `submitSoloGuess`, `giveUpSoloRound`). The server picks the track from the player's saved or featured playlist, checks the guess, enforces a 10-minute cooldown for the same song and playlist, and caps solo points at 1,500 per account per UTC day.
    *   Usernames and multiplayer room names are checked for offensive language on the server, and offensive words in a room's playlist name are masked.
    *   Multiplayer room creation is rate limited, and room codes are reserved atomically so two rooms can never share a code.
    *   Multiplayer timers and round advancement are server-authoritative: late guesses are rejected, unfinished players are timed out by scheduled recovery, roster changes re-evaluate settlement, durable `advancing` rounds recover automatically, and expired rooms are cleaned up with their player and private round subcollections.
    *   **Resource Caps**: Libraries are limited to a maximum of 30 playlists per account or guest session to prevent storage expansion, individual playlists are capped at 5,000 tracks, Spotify import pagination is validated server-side, custom mixes resolve up to 50 Spotify track links per import, and rounds cap iTunes lookup attempts, run lookups with timeouts in small parallel batches, and share a server-side preview cache (`itunesPreviewCache`).
    *   **Account Cleanup**: Inactive anonymous users (older than 30 days) are automatically deleted daily to keep the database clean and organized.
    *   **Input Protection**: Strict alphanumeric and safe-symbol constraints are enforced on display names and playlist titles to block scripting/HTML tags. Custom song titles and artists are automatically sanitized. Background playlist imports that fail remain marked as import errors instead of appearing complete.
    *   **High-Concurrency Scaling**: Leaderboard score submissions are executed via atomic database-side increments to ensure data integrity during multiple concurrent game rounds.

## Tech Stack
*   React & TypeScript
*   Vite
*   Firebase (Authentication, Firestore, App Check, and Hosting)
*   Firebase Storage
*   Google Cloud Functions and scheduled cleanup jobs
*   Spotify API
*   iTunes API
*   Umami Analytics
*   Material UI
*   styled-components

## Development & Deployment

### Scripts
*   **Run local dev server**: `npm run dev`
*   **Run local Firebase emulators**: `npm run emulators`
*   **Run dev server against emulators**: `npm run dev:emulator`
*   **Run frontend unit tests**: `npm run test`
*   **Run functions tests**: `npm run test-functions`
*   **Run security rules tests** (Firebase CLI and Java 21 required): `npm run test:rules`
*   **Build production frontend**: `npm run build`
*   **Build functions**: `npm run build-functions`
*   **Deploy to Firebase Hosting**: `npm run deploy`
*   **Deploy Cloud Functions**: `npm run deploy-functions`
*   **Deploy Firestore rules**: `npm run deploy-rules`
*   **Deploy Storage rules**: `npm run deploy-storage-rules`

### Production App Check
Production callable Cloud Functions enforce Firebase App Check. Before deploying Hosting, register the web app in Firebase App Check with reCAPTCHA v3, add the site key as `VITE_FIREBASE_APPCHECK_SITE_KEY` in the production build environment, then rebuild and redeploy Hosting. If this key is missing or the app is not registered, production callable requests can fail with `Unauthenticated` before reaching the function handler.

### Hosting Headers
`firebase.json` sends `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, and a `Permissions-Policy` on every response, `Cache-Control: no-cache` for HTML and other non-hashed files, and a one-year immutable cache for hashed `/assets/**` files. A Content Security Policy is also defined in `firebase.json`. If you add a new external origin (an API, font, or image host), add it to that policy.

### Local Firebase Emulator Testing
Use two terminals for local Firebase testing:
1.  Run `npm run emulators` from the project root.
2.  Run `npm run dev:emulator` from the project root.
3.  Open the Vite URL for the app and `http://127.0.0.1:4000` for the Firebase Emulator UI.

The `dev:emulator` script loads `.env.emulator`, which sets `VITE_USE_FIREBASE_EMULATORS=true`. In that mode, Auth, Firestore, Functions, and Storage use local emulators instead of production Firebase.

### Firestore Leaderboard and Username Schema
TuneTeaser account setup, username changes, and score writes are Cloud Function-controlled. The browser can read leaderboard entries, but cannot write leaderboard or username reservation documents directly.
*   **Collection**: `leaderboard`
*   **Document ID**: `{uid}` (Firebase Auth User ID)
*   **Fields**:
    *   `displayName`: `string`
    *   `totalPoints`: `number`
    *   `gamesWon`: `number` (correct solo guesses; multiplayer wins are not tracked here)
    *   `lastUpdated`: `timestamp`
*   **Collection**: `usernames`
*   **Document ID**: normalized username
*   **Purpose**: case-insensitive username reservation during TuneTeaser account initialization and Settings username changes

### Firebase Security Rules
Firestore rules allow public leaderboard reads, Cloud Function-only leaderboard and username reservation writes, owner-only user playlist writes, signed-in room-code lookup for multiplayer lobbies, denied multiplayer room listing, and Cloud Function-only writes for multiplayer state:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    match /leaderboard/{uid} {
      allow read: if true;
      allow write: if false;
    }

    match /usernames/{usernameId} {
      allow read, write: if false;
    }

    match /users/{uid} {
      allow read, write: if isOwner(uid);

      match /playlists/{playlistId} {
        allow read, write: if isOwner(uid);
      }
    }

    match /multiplayerRooms/{roomId} {
      allow get: if isSignedIn();
      allow list: if false;
      allow write: if false;

      match /players/{uid} {
        allow read: if isSignedIn();
        allow write: if false;
      }
    }
  }
}
```

Storage rules are version-controlled in `storage.rules` and deployed through `firebase.json`. Playlist track snapshots are restricted to `users/{uid}/playlists/{playlistId}.json`, where `request.auth.uid` must match `uid`; JSON uploads are capped at 5 MiB and all other Storage paths are denied.

### Firestore Multiplayer Schema
Online multiplayer uses a `multiplayerRooms` collection with player and private round subcollections. Room and player writes are controlled by Cloud Functions:
*   **Collection**: `multiplayerRooms`
*   **Document ID**: `{roomCode}` six-character private room code
*   **Fields**:
    *   `hostUid`: `string`
    *   `roomName`: `string`
    *   `status`: `"lobby" | "playing" | "ended"`
    *   `maxPlayers`: `number`
    *   `pointGoal`: `number`
    *   `roundTimerSeconds`: `number`
    *   `playerCount`: `number`
    *   `playlistId`: `string | null`
    *   `playlistName`: `string | null`
    *   `currentRound`: non-answer round metadata while playing, including synchronized timer fields and `advancing` reveal state
    *   `revealedRound`: answer metadata after a round completes
    *   `winnerUid`: `string | null`
    *   `winnerDisplayName`: `string | null`
    *   `closeReason`: optional `"host-left"`, used by clients to recover when the host closes a room
    *   `expiresAt`: `number`, used by the daily cleanup job that deletes expired rooms, players, and private rounds
*   **Subcollection**: `multiplayerRooms/{roomCode}/players/{uid}`
    *   `displayName`: `string`
    *   `isHost`: `boolean`
    *   `score`: `number`
    *   `state`: `"lobby" | "guessing" | "correct" | "gave-up" | "timed-out"`
    *   `currentRoundId`: `string | null`
    *   `roundSnippetDurationMs`: `number | null`
    *   `lastEarnedPoints`: `number | null`
*   **Private subcollection**: `multiplayerRooms/{roomCode}/rounds/{roundId}`
    *   Stores playable preview URLs, answer titles, and round choices for callable use.
    *   Firestore rules do not expose this subcollection directly to clients.
    *   Deleted with its parent room by the expired-room cleanup job.

### Solo Round Schema (server-only)
*   **Collection**: `soloRounds/{uid}`, one document per player that is overwritten when a new round starts. It stores the answer, preview URL, server-tracked snippet length, round state, points eligibility, and recently played track IDs. Rounds expire after 30 minutes. Clients cannot read it; it is deleted with the account.
*   **Subcollections**: `leaderboard/{uid}/recentScores/*` (per-song cooldowns) and `leaderboard/{uid}/dailyPoints/{YYYY-MM-DD}` (daily cap totals, with a Timestamp `expiresAt`; expired docs are deleted by a Firestore TTL policy).
*   **Collection**: `itunesPreviewCache/{hash}` caches iTunes preview lookups shared by solo and multiplayer (found entries for 14 days, misses for 3 days, then deleted by a Firestore TTL policy on `expiresAt`).

## Requirements
*   **TuneTeaser Account or Guest Session**: Required to save imported playlists and custom mixes. Registered accounts persist playlist metadata in Firestore. Guest sessions keep playlist metadata in browser local storage and upload track snapshots under the guest's anonymous Firebase UID.
*   **Spotify Public Data**: Public playlist search, playlist URL import, and profile URL import use Spotify client credentials and only see public data. TuneTeaser's Spotify app runs in Spotify's Development Mode, where Spotify restricts reading playlist contents and other users' playlists, so these imports can fail. When they do, add the tracks as `Song - Artist` lines with Build Custom Playlist. There is no Spotify sign-in.
*   **Modern Browser**: A current version of Chrome, Edge, or Firefox.
