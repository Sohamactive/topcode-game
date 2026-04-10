# Architecture Update

## Current Control Model
The app uses a host session token instead of the older admin-token flow.

- Host dashboard: `/`
- Join flow: `/join/:gameId`
- Host game view: `/game/:gameId`

The host session token is returned when a game is created and is reused for host-only actions.

## Runtime Roles
- Host creates the game, starts play, resolves prompts, and ends the session.
- Participants join by QR code or manual game code.
- The active team captain performs the roll action and can mark a prompt complete.

## Authorization Model
- Host routes require `x-host-session`.
- Public route: `POST /api/admin/games/:gameId/join-team`.

## Core Route Set
- `POST /api/admin/games`
- `GET /api/admin/games/:gameId`
- `POST /api/admin/games/:gameId/start`
- `POST /api/admin/games/:gameId/roll`
- `POST /api/admin/games/:gameId/resolve`
- `POST /api/admin/games/:gameId/end`
- `GET /api/admin/games/:gameId/prompts`
- `POST /api/admin/games/:gameId/prompts`
- `POST /api/admin/games/:gameId/prompts/visibility`
- `POST /api/admin/games/:gameId/join-team` (public)
- `GET /api/games/:gameId`
- `GET /api/games/:gameId/ws`

## Game State Shape
- `status`: pending, active, or ended
- `teams`: includes `position`, `captain_id`, `members`, and `visitedSpaceIds`
- `boardSpaces`: 25 numbered spaces with prompt data
- `current_team_index`: active team index
- `current_prompt`: prompt currently shown
- `awaiting_resolution`: whether the host still needs to resolve the prompt
- `last_assigned_space`: the space the team landed on
- `activity_feed`: rolling event log for join/start/roll/resolve/end actions

## Data Flow
1. Host creates a game.
2. Server returns the game state, session code, join URL, QR code, and host session token.
3. Participants join a team and optionally become captain.
4. Captain rolls on the active team.
5. Server moves the team, selects the current board space, and broadcasts the new state.
6. Host resolves the prompt.
7. Game continues until the host ends it.

## Real-Time Sync
- WebSocket broadcasts keep host and participant screens aligned.
- Polling fallback is available if the socket is unavailable.
- The backend remains the source of truth for state changes.
