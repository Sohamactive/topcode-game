# Requirements Verification

This checklist reflects the current implementation in the repository as of April 10, 2026.

## Host Flow
- [x] Host can create a game from the dashboard.
- [x] Server returns a session code, QR code, join URL, and host session token.
- [x] Host actions use `x-host-session`.
- [x] Host can start the game.
- [x] Host can resolve prompts as completed or not completed.
- [x] Host can end the game.

## Participant Flow
- [x] Participants can join by QR code.
- [x] Participants can join manually by game code.
- [x] Participants enter a display name.
- [x] Participants choose a team.
- [x] Participants can join as captain.
- [x] Join-team is public and does not require host credentials.

## Gameplay
- [x] The game uses a shared board state.
- [x] The board currently has 25 numbered spaces.
- [x] Teams move with a 1-6 roll and wrap around the board.
- [x] The current space determines the active prompt.
- [x] Captain-only roll enforcement is present.
- [x] Prompt resolution keeps the session moving without scoring or leaderboard logic.

## Prompts
- [x] Prompt data is stored in SQLite.
- [x] Prompt CRUD is available through the API.
- [x] Prompts can be hidden or re-enabled during a live game.
- [x] New prompts can be added during a live game.

## Real-Time Sync
- [x] The game broadcasts updates over WebSocket.
- [x] Polling fallback exists if the socket fails.
- [x] Host and participant screens share the same game state.

## Technical
- [x] The frontend uses React + Vite.
- [x] The backend uses Node.js + Express.
- [x] The app uses SQLite for local persistence.
- [x] The repository includes an automated test suite at `server/tests/game-helpers.test.js`.
- [x] `npm test` passes.

## Notes
- The old 16-space and scoring-era docs have been replaced in this folder.
- `server/test-board.js` and `test-board.js` are legacy manual smoke-test scripts, not part of the automated suite.