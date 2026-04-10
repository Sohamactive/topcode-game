# Momentum

Momentum is a lightweight facilitator-led workshop game for live group energy.

Participants join with QR, pick a team, optionally become captain, and play through Move/Talk/Create/Wildcard prompts on a fixed 12-space board.

## Core Highlights
- QR-first join flow with manual code fallback
- Host session token control (no admin token entry required)
- Team roster with captain indicator
- Fixed 3x4 board with typed spaces
- Real-time sync via WebSocket + polling fallback
- Prompt management during active sessions
- Non-competitive default flow (no leaderboard winner logic)

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express + express-ws
- Storage: SQLite

## Project Structure
- client: frontend app
- server: backend API + SQLite setup
- docs: workflow and supporting documentation

## Setup
1. Install dependencies

```bash
npm install
```

2. Seed prompts

```bash
npm run seed-prompts
```

3. Run in development

```bash
npm run dev
```

4. Open app
- Host dashboard: http://localhost:5173/

## Host Flow
1. Open Host Dashboard at /
2. Create game with teams and rounds
3. Share QR/session code with participants
4. Start game
5. Run loop: Roll -> Resolve -> Next Team
6. End round or end game when needed

All host control requests use x-host-session automatically from the client.

## Participant Flow
1. Scan host QR (or use manual code fallback)
2. Enter name
3. Select team
4. Pick captain role if available
5. Join game board and follow live state

## Board Model
- 12 spaces in 3 rows x 4 columns
- Space types:
  - Move
  - Talk
  - Create
  - Wildcard

Each roll assigns an unvisited space for the current team, then selects a prompt matched to the space type.

## Prompt Controls
Host can:
- Add prompt during game
- Hide/show prompts per game
- Refresh prompt list

## API Overview
- GET /api/health
- GET /api/games/:gameId
- WS /api/games/:gameId/ws
- POST /api/admin/games
- POST /api/admin/games/:gameId/join-team
- GET /api/admin/games/:gameId
- POST /api/admin/games/:gameId/start
- POST /api/admin/games/:gameId/roll
- POST /api/admin/games/:gameId/resolve
- POST /api/admin/games/:gameId/next
- POST /api/admin/games/:gameId/end-round
- GET /api/admin/games/:gameId/prompts
- POST /api/admin/games/:gameId/prompts
- POST /api/admin/games/:gameId/prompts/visibility
- POST /api/admin/games/:gameId/end

## Build
```bash
npm run build
```

## Notes
- Host control is session-token based.
- Join-team is intentionally public to reduce friction in workshop rooms.
- See docs/workflow.md for full operational sequence.
