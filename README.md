# TuneTeaser 🎵

[TuneTeaser](https://tuneteaser.web.app/) is a "Name That Tune" style game where you test your music knowledge against Spotify playlists!

## How to Play
1.  **Sign in** to your TuneTeaser account, or use guest mode to try featured playlists.
2.  **Import Playlists** from public Spotify playlist URLs, page through public playlists from a Spotify profile URL, or build a custom mix from track URLs and song lines.
3.  **Pick a Crate** from your playlist library.
4.  **Listen** to a short snippet of a random song.
5.  **Guess** the song title!
    *   Incorrect guesses increase the snippet length up to 30 seconds.
    *   Correct guesses win the round!

## Features
*   **Smart Matching**: Guesses don't need to be perfect (ignores case and punctuation).
*   **Dynamic Difficulty**: Snippets start short (2s) and grow longer if you're stumped.
*   **Play Your Way**: Import multiple public playlists one at a time, or page through and select public playlists from a Spotify profile.
*   **Account Clarity**: Signed-in pages show which TuneTeaser account is active.
*   **Retro Arcade Design**: A record-shop inspired interface with arcade-style game panels, responsive layouts, and accessible focus states.

## Requirements
*   **TuneTeaser Account**: Required to save imported playlists and custom mixes.
*   **Spotify Public Playlists**: Profile linking uses Spotify client credentials and only sees public playlists. Private or collaborative playlists require Spotify OAuth.
*   **Modern Browser**: Chrome, Edge, or Firefox (with DRM enabled).

## Tech Stack
*   React & TypeScript
*   Vite
*   Firebase
*   Spotify API
*   iTunes API
*   Material UI
*   styled-components

Created by Jordan Rudman