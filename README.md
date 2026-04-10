# Momentum Icebreaker Game MVP

Web-based facilitator-led board game for innovation sessions.

## What It Supports
- Host creates a live session with custom team names
- Unique session code + QR code join flow
- Participants join instantly (QR or manual code), choose team, and can claim captain role
- Shared real-time 5x5 board (25 spaces)
- Captain-only dice roll for active team
- Prompt-driven flow with Move, Talk, Create, Wildcard categories
- No scoring, no leaderboard, no winner declaration
- Host can end game anytime

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express + express-ws
- DB: SQLite

## Run Locally
1. Install dependencies
```bash
npm install
```
2. Seed prompts (35 total: 10 Move, 10 Talk, 10 Create, 5 Wildcard)
```bash
npm run seed-prompts
```
3. Start app
```bash
npm run dev
```
4. Open host view
- http://localhost:5173/

## Host Flow
1. Create game and teams
2. Share QR/session code
3. Start game
4. Active team's captain rolls
5. Team performs prompt
6. Resolve prompt (completed/not completed)
7. Continue until facilitator ends session

## Prompt Management (Admin in Host Dashboard)
- Add prompt
- Edit prompt text/type
- Enable/disable prompts
- Hide/show prompt in current game
- Filter by type

## API Highlights
- `POST /api/admin/games`
- `POST /api/admin/games/:gameId/start`
- `POST /api/admin/games/:gameId/roll`
- `POST /api/admin/games/:gameId/resolve`
- `POST /api/admin/games/:gameId/end`
- `GET /api/admin/games/:gameId/prompts`
- `POST /api/admin/games/:gameId/prompts`
- `PUT /api/admin/games/:gameId/prompts/:promptId`
- `POST /api/admin/games/:gameId/prompts/visibility`
- `POST /api/admin/games/:gameId/join-team`
- `GET /api/games/:gameId`
- `WS /api/games/:gameId/ws`

## Notes
- Designed for facilitator-first shared screen usage.
- Participant view is mobile-friendly and requires no account/login.