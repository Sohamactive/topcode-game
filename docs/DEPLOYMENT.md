# Deployment Guide

This project is a Node.js backend plus a React/Vite frontend with SQLite for local persistence.

## What to Deploy
- Backend: `server/server.js`
- Frontend build: `client/dist`
- Database: `server/momentum.db` for single-instance deployments

## Local Production Check
Before deploying, verify the app locally:
```bash
npm run seed-prompts
npm run build
npm start
```

## Recommended Production Layout
1. Build the frontend with `npm run client:build`.
2. Run the server with `NODE_ENV=production`.
3. Set `BASE_URL` to the public URL of the deployment.
4. Store the SQLite database on persistent disk if the server restarts matter.

## Option 1: Single EC2 Instance
This is the simplest deployment path for the current MVP.

### Install Runtime
```bash
sudo apt update
sudo apt install -y nodejs npm git nginx
```

### Deploy Code
```bash
git clone <repo-url>
cd topcoder-game
npm install
cd server && npm install
cd ..
npm --prefix client install
npm run seed-prompts
npm run client:build
```

### Start the Server
```bash
cd server
NODE_ENV=production BASE_URL=https://your-domain.com node server.js
```

### Reverse Proxy
Proxy port 80 or 443 to backend port 3000 so the host and join routes remain consistent.

## Option 2: Docker
Build a container that copies the repo, installs dependencies, builds the client, and starts `server/server.js`.

Example runtime command:
```bash
NODE_ENV=production BASE_URL=https://your-domain.com node server/server.js
```

## Environment Variables
Set these in production:
```env
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com
```

`BASE_URL` is used when generating join URLs and QR codes.

## Database Notes
- SQLite is fine for a single-instance deployment.
- If you need multi-instance persistence, migrate the storage layer to a network database.
- Back up `server/momentum.db` regularly if you keep SQLite in production.

## Smoke Test After Deploy
1. Open the host dashboard.
2. Create a game.
3. Confirm the QR code and session code render.
4. Join from another device.
5. Roll, resolve, and end the game.

## Operational Notes
- Keep the server process managed by a service manager such as PM2 or systemd.
- Use HTTPS in front of the app.
- Restrict access to the host dashboard if the deployment is public-facing.