# TuneTeaser

[TuneTeaser](https://tuneteaser.web.app/) is a "Name That Tune" style game where you test your music knowledge against imported Spotify playlists, custom mixes, and featured guest playlists.

## How to Play
1.  **Sign in** to your TuneTeaser account, or use guest mode to try featured playlists and guest imports.
2.  **Import Playlists** from public Spotify playlist URLs, page through public playlists from a Spotify profile URL, or build a custom mix from track URLs and song lines.
3.  **Pick a Playlist** from your playlist library.
4.  **Listen** to a short snippet of a random song.
5.  **Guess** the song title!
    *   Incorrect guesses increase the snippet length up to 30 seconds.
    *   Correct guesses win the round and can earn points for eligible TuneTeaser accounts.

## Features
*   **Smart Matching**: Guesses don't need to be perfect (ignores case and punctuation).
*   **Dynamic Difficulty**: Snippets start short (2 seconds) and grow longer if you are stumped.
*   **Play Your Way**: Import multiple public playlists one at a time, page through and select public playlists from a Spotify profile, or build custom mixes from Spotify track links and `Song - Artist` lines.
*   **Playlist Sorting & Filtering**: Find the perfect playlist in your library quickly with title-based searching and sorting by Name, Track Count, and Date Added (including reverse sorting).
*   **Account Clarity**: Signed-in pages show which TuneTeaser account is active.
*   **Retro Arcade Design**: A record-shop inspired interface with arcade-style game panels, responsive layouts, and accessible focus states.
*   **Real-Time Leaderboard**: Compete with other music experts! A real-time scoreboard shows the top 10 players and your current position/rank.
*   **Local Multiplayer Lobby Foundation**: Create a private party room, share a short code or `/multiplayer/{roomCode}` link, let players join with their TuneTeaser usernames, pick a playlist, set a point goal, and manage players before starting.
*   **Dynamic Scoring**: Points are based on correct guesses and speed. Solve a song in the initial 2-second snippet for a maximum score of 25 points. Slower answers scale down linearly to a base of 10 points.
*   **Fair Play Safeguards & Storage Safety**:
    *   Guest/anonymous profiles are ineligible for points to prevent scoreboard pollution.
    *   Playlists must contain at least 10 tracks to be eligible for points.
    *   A 10-minute cooldown prevents spamming the exact same song and playlist combination.
    *   **Resource Caps**: Libraries are limited to a maximum of 30 playlists per account or guest session to prevent storage expansion, and individual playlists are capped at 5,000 tracks.
    *   **Account Cleanup**: Inactive anonymous users (older than 30 days) are automatically deleted daily to keep the database clean and organized.
    *   **Input Protection**: Strict alphanumeric and safe-symbol constraints are enforced on display names and playlist titles to block scripting/HTML tags. Custom song titles and artists are automatically sanitized.
    *   **High-Concurrency Scaling**: Leaderboard score submissions are executed via atomic database-side increments to ensure data integrity during multiple concurrent game rounds.

## Tech Stack
*   React & TypeScript
*   Vite
*   Firebase (Authentication & Firestore)
*   Google Cloud Functions
*   Spotify API
*   iTunes API
*   Material UI
*   styled-components

## Development & Deployment

### Scripts
*   **Run local dev server**: `npm run dev`
*   **Run local Firebase emulators**: `npm run emulators`
*   **Run dev server against emulators**: `npm run dev:emulator`
*   **Run unit tests**: `npm run test`
*   **Build production code**: `npm run build`
*   **Deploy to Firebase Hosting**: `npm run deploy`

### Local Firebase Emulator Testing
Use two terminals for local Firebase testing:
1.  Run `npm run emulators` from the project root.
2.  Run `npm run dev:emulator` from the project root.
3.  Open the Vite URL for the app and `http://127.0.0.1:4000` for the Firebase Emulator UI.

The `dev:emulator` script loads `.env.emulator`, which sets `VITE_USE_FIREBASE_EMULATORS=true`. In that mode, Auth, Firestore, and Functions use local emulators instead of production Firebase.

### Firestore Leaderboard Schema
To enable the leaderboard system, the Firestore database needs to contain a `leaderboard` collection:
*   **Collection**: `leaderboard`
*   **Document ID**: `{uid}` (Firebase Auth User ID)
*   **Fields**:
    *   `displayName`: `string`
    *   `totalPoints`: `number`
    *   `gamesWon`: `number`
    *   `lastUpdated`: `timestamp`

### Firestore Security Rules
The deployed rules allow public leaderboard reads, owner-only leaderboard/user playlist writes, signed-in reads for multiplayer lobbies, and Cloud Function-only writes for multiplayer state:
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
      allow write: if isOwner(uid);
    }

    match /users/{uid} {
      allow read, write: if isOwner(uid);

      match /playlists/{playlistId} {
        allow read, write: if isOwner(uid);
      }
    }

    match /multiplayerRooms/{roomId} {
      allow read: if isSignedIn();
      allow write: if false;

      match /players/{uid} {
        allow read: if isSignedIn();
        allow write: if false;
      }
    }
  }
}
```

### Firestore Multiplayer Schema
Local multiplayer uses a `multiplayerRooms` collection and `players` subcollection:
*   **Collection**: `multiplayerRooms`
*   **Document ID**: `{roomCode}` six-character private room code
*   **Fields**:
    *   `hostUid`: `string`
    *   `roomName`: `string`
    *   `status`: `"lobby" | "playing" | "ended"`
    *   `maxPlayers`: `number`
    *   `pointGoal`: `number`
    *   `playerCount`: `number`
    *   `playlistId`: `string | null`
    *   `playlistName`: `string | null`
    *   `expiresAt`: `number`
*   **Subcollection**: `multiplayerRooms/{roomCode}/players/{uid}`
    *   `displayName`: `string`
    *   `isHost`: `boolean`
    *   `score`: `number`
    *   `state`: `string`

## Requirements
*   **TuneTeaser Account or Guest Session**: Required to save imported playlists and custom mixes. Registered accounts persist playlist metadata in Firestore. Guest sessions keep playlist metadata in browser local storage and upload track snapshots under a guest storage path.
*   **Spotify Public Playlists**: Profile linking uses Spotify client credentials and only sees public playlists. Private or collaborative playlists require Spotify OAuth.
*   **Modern Browser**: Chrome, Edge, or Firefox (with DRM enabled).

Created by Jordan Rudman
