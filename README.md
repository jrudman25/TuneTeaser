# TuneTeaser 🎵

[TuneTeaser](https://tuneteaser.web.app/) is a "Name That Tune" style game where you test your music knowledge against Spotify playlists!

## How to Play
1.  **Sign in** to your TuneTeaser account, or use guest mode to try featured playlists.
2.  **Import Playlists** from public Spotify playlist URLs, page through public playlists from a Spotify profile URL, or build a custom mix from track URLs and song lines.
3.  **Pick a Playlist** from your playlist library.
4.  **Listen** to a short snippet of a random song.
5.  **Guess** the song title!
    *   Incorrect guesses increase the snippet length up to 30 seconds.
    *   Correct guesses win the round and earn points!

## Features
*   **Smart Matching**: Guesses don't need to be perfect (ignores case and punctuation).
*   **Dynamic Difficulty**: Snippets start short (2 seconds) and grow longer if you are stumped.
*   **Play Your Way**: Import multiple public playlists one at a time, or page through and select public playlists from a Spotify profile.
*   **Playlist Sorting & Filtering**: Find the perfect playlist in your library quickly with title-based searching and sorting by Name, Track Count, and Date Added (including reverse sorting).
*   **Account Clarity**: Signed-in pages show which TuneTeaser account is active.
*   **Retro Arcade Design**: A record-shop inspired interface with arcade-style game panels, responsive layouts, and accessible focus states.
*   **Real-Time Leaderboard**: Compete with other music experts! A real-time scoreboard shows the top 10 players and your current position/rank.
*   **Dynamic Scoring**: Points are based on correct guesses and speed. Solve a song in the initial 2-second snippet for a maximum score of 25 points. Slower answers scale down linearly to a base of 10 points.
*   **Fair Play Safeguards & Storage Safety**:
    *   Guest/anonymous profiles are ineligible for points to prevent scoreboard pollution.
    *   Playlists must contain at least 10 tracks to be eligible for points.
    *   A 10-minute cooldown prevents spamming the exact same song and playlist combination.
    *   **Resource Caps**: Libraries are limited to a maximum of 25 playlists per account (both registered and guest) to prevent storage expansion, and individual playlists are capped at 5,000 tracks.
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
*   **Run unit tests**: `npm run test`
*   **Build production code**: `npm run build`
*   **Deploy to Firebase Hosting**: `npm run deploy`

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
Configure the security rules for the `leaderboard` collection:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Requirements
*   **TuneTeaser Account or Local Storage**: Required to save imported playlists and custom mixes (saved in browser local storage for guests, or persistently in a database for registered accounts).
*   **Spotify Public Playlists**: Profile linking uses Spotify client credentials and only sees public playlists. Private or collaborative playlists require Spotify OAuth.
*   **Modern Browser**: Chrome, Edge, or Firefox (with DRM enabled).

Created by Jordan Rudman