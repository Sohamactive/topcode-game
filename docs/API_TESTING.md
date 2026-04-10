# API Reference and Testing Guide

## Base URLs
- Host and participant UI: `http://localhost:5173`
- Backend API: `http://localhost:3000`

## Core Flow
1. Host creates a game with `POST /api/admin/games`.
2. Server returns the game state, QR code, join URL, session code, and host session token.
3. Participants join with `POST /api/admin/games/:gameId/join-team`.
4. Host starts the game with `POST /api/admin/games/:gameId/start`.
5. The captain rolls with `POST /api/admin/games/:gameId/roll`.
6. Host resolves the prompt with `POST /api/admin/games/:gameId/resolve`.
7. Host ends the game with `POST /api/admin/games/:gameId/end`.

## Host Authorization
Protected host routes require the `x-host-session` header.

Example:
```http
x-host-session: <host-session-token>
```

## Game Session APIs

### Create Game
```http
POST /api/admin/games
Content-Type: application/json

{
  "teams": ["Team A", "Team B", "Team C"]
}
```

Response includes:
```json
{
  "game": {
    "id": "uuid",
    "session_code": "ABC123",
    "status": "pending",
    "teams": [
      {
        "id": "uuid",
        "name": "Team A",
        "position": 0,
        "captain_id": null,
        "members": [],
        "visitedSpaceIds": []
      }
    ],
    "boardSpaces": [],
    "current_team_index": 0,
    "current_prompt": null,
    "awaiting_resolution": false,
    "qr_code": "data:image/png;base64,...",
    "join_url": "http://localhost:3000/join/uuid"
  },
  "host_session_token": "uuid"
}
```

### Get Host Game State
```http
GET /api/admin/games/:gameId
x-host-session: <host-session-token>
```

### Start Game
```http
POST /api/admin/games/:gameId/start
x-host-session: <host-session-token>
```

### Roll Dice
```http
POST /api/admin/games/:gameId/roll
x-host-session: <host-session-token>
Content-Type: application/json

{
  "user_id": "captain-user-id"
}
```

The active team captain can also be supplied in `x-user-id`.

### Resolve Prompt
```http
POST /api/admin/games/:gameId/resolve
x-host-session: <host-session-token>
Content-Type: application/json

{
  "completed": true
}
```

### End Game
```http
POST /api/admin/games/:gameId/end
x-host-session: <host-session-token>
```

## Participant APIs

### Join Team
Public endpoint. No host token required.

```http
POST /api/admin/games/:gameId/join-team
Content-Type: application/json

{
  "teamId": "team-id",
  "userId": "user-123",
  "name": "Alice",
  "isCaptain": true
}
```

## Prompt APIs

### List Prompts for the Current Game
```http
GET /api/admin/games/:gameId/prompts
x-host-session: <host-session-token>
```

Query the global prompt catalog with:
```http
GET /api/prompts?type=All&enabled=true
```

### Add Prompt During a Live Game
```http
POST /api/admin/games/:gameId/prompts
x-host-session: <host-session-token>
Content-Type: application/json

{
  "text": "Stand up and stretch for 10 seconds.",
  "type": "Move"
}
```

### Toggle Prompt Visibility In Game
```http
POST /api/admin/games/:gameId/prompts/visibility
x-host-session: <host-session-token>
Content-Type: application/json

{
  "promptId": "prompt-id",
  "visible": false
}
```

## Public Game Read APIs

### Get Participant Game State
```http
GET /api/games/:gameId
```

### WebSocket Updates
```http
WS /api/games/:gameId/ws
```

The socket broadcasts `game_state` messages whenever the backend updates the game.

## Manual Test Checklist

### 1. Create and Join
- [ ] Start the app with `npm run dev`.
- [ ] Create a game from the host dashboard.
- [ ] Confirm a session code and QR code appear.
- [ ] Open the join flow in another tab or device.
- [ ] Join a team and optionally join as captain.

### 2. Start and Play
- [ ] Start the game using the host session token.
- [ ] Confirm the current team is visible.
- [ ] Roll as the captain.
- [ ] Confirm the board updates and the current prompt appears.
- [ ] Resolve the prompt as completed or not completed.

### 3. Prompt Management
- [ ] Add a prompt during a live game.
- [ ] Hide a prompt in the current game.
- [ ] Refresh the prompt list and confirm the change persists.

### 4. End Game
- [ ] End the game from the host dashboard.
- [ ] Confirm the status changes to ended.

## Automated Test
Run the helper tests with:
```bash
npm test
```

Current automated coverage lives in `server/tests/game-helpers.test.js`.