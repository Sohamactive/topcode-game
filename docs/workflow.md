# Momentum Workflow

## 1. Runtime Layout
- Backend API runs on port 3000.
- Frontend Vite dev server runs on port 5173.
- In production, the backend serves the built client from `client/dist`.
- The backend is the source of truth for game state.

## 2. Host Setup Flow
1. Host opens the dashboard at `/`.
2. Host creates a game with team names.
3. Backend returns the game state, session code, join URL, QR code, and host session token.
4. The host session token is used for all control actions via `x-host-session`.

## 3. Participant Join Flow
1. Participant scans the QR code or enters the session code manually.
2. Participant enters a name.
3. Participant selects a team.
4. Participant may request captain role.
5. Client calls `POST /api/admin/games/:gameId/join-team`.
6. Team membership updates in real time for all connected clients.

## 4. Authorization Rules
- Host routes require `x-host-session`.
- Join-team is public and does not require host credentials.
- Captain-only rolling is enforced at gameplay time when a captain is assigned.

## 5. Board and Turn Flow
- The board is a 25-space grid.
- On roll, the backend advances the current team by 1-6 spaces.
- The landing space determines the prompt shown for that turn.
- The host resolves the challenge as completed or not completed.
- The turn stays on the active team until resolution.

## 6. Prompt Management Flow
- The host can add prompts during a live game.
- The host can hide or show prompts per game.
- The prompt list refreshes after changes.

## 7. Real-Time Sync
- Clients receive game updates via WebSocket on `/api/games/:gameId/ws`.
- Polling fallback is used if WebSocket is unavailable.
- Team roster, board state, prompts, and activity feed update live.

## 8. Activity and Engagement
- The backend stores a rolling activity feed in game state.
- The host dashboard displays the live feed.
- The UI stays focused on facilitation instead of scoring.

## 9. End Conditions
- The host can end the game manually at any time.
- The game status changes to ended.
- No winner or leaderboard logic is used in the core flow.

## 10. Key Routes
- `GET /api/health`
- `GET /api/games/:gameId`
- `GET /api/games/:gameId/ws`
- `POST /api/admin/games`
- `POST /api/admin/games/:gameId/join-team`
- `GET /api/admin/games/:gameId`
- `POST /api/admin/games/:gameId/start`
- `POST /api/admin/games/:gameId/roll`
- `POST /api/admin/games/:gameId/resolve`
- `POST /api/admin/games/:gameId/prompts`
- `GET /api/admin/games/:gameId/prompts`
- `POST /api/admin/games/:gameId/prompts/visibility`
- `POST /api/admin/games/:gameId/end`

## 11. Test Flow
- Automated helper tests live in `server/tests/game-helpers.test.js`.
- Run them with `npm test`.
