# Quick Start

## Prerequisites
- Node.js 18+
- npm

## Install Dependencies
If packages are not installed yet, run:
```bash
npm install
cd server && npm install
cd ..
npm --prefix client install
```

## Seed Prompts
```bash
npm run seed-prompts
```

## Start the App
```bash
npm run dev
```

Open:
- Host dashboard: http://localhost:5173/
- Join flow: http://localhost:5173/join/<gameId>

## Host Flow
1. Create a game from the host dashboard.
2. Share the QR code or session code.
3. Use the saved host session token for host-only actions.
4. Start the game.
5. Resolve each prompt and end the game when done.

## Participant Flow
1. Scan the QR code or enter the game code.
2. Enter a display name.
3. Choose a team.
4. Optionally join as captain.
5. Wait for your turn and use the captain roll action.

## Automated Test
```bash
npm test
```

## Troubleshooting
- If the client build breaks, run `npm run client:build`.
- If the server fails, run `cd server && npm run dev` and inspect logs.
- If the database becomes inconsistent, stop the server, delete `server/momentum.db`, and seed again.
