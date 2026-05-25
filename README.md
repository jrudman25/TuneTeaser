# TuneTeaser 🎵

[TuneTeaser](https://tuneteaser.web.app/) is a "Name That Tune" style game where you test your music knowledge against Spotify playlists!

## How to Play
1.  **Login** to your TuneTeaser account.
2.  **Import Playlists** from public Spotify playlist URLs or load public playlists from a Spotify profile URL.
3.  **Listen** to a short snippet of a random song.
4.  **Guess** the song title!
    *   Incorrect guesses increase the snippet length up to 30 seconds.
    *   Correct guesses win the round!

## Features
*   **Smart Matching**: Guesses don't need to be perfect (ignores case and punctuation).
*   **Dynamic Difficulty**: Snippets start short (2s) and grow longer if you're stumped.
*   **Play Your Way**: Import multiple public playlists one at a time, or page through and select public playlists from a Spotify profile.
*   **Retro Arcade Design**: A record-shop inspired interface with arcade-style game panels, responsive layouts, and accessible focus states.

## Requirements
*   **TuneTeaser Account**: Required to save imported playlists.
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