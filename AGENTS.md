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

## Code style
- TypeScript strict mode
- Prefer existing MUI, styled-components, and shared `src/index.css` styles before adding UI dependencies
- Keep Cloud Function-controlled writes authoritative for leaderboard, usernames, multiplayer state, and Spotify imports
