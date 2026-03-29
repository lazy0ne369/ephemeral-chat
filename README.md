# EPHEMERAL CHAT — Phase 1

> No logs. No accounts. No trace.

## Quick Start

### 1. Install dependencies

```bash
# Server
cd server && npm install

# Client (new terminal)
cd client && npm install
```

### 2. Run the server

```bash
cd server
npm run dev       # with nodemon (auto-restart)
# or
npm start         # plain node
```

Server runs on → http://localhost:3001

### 3. Run the client

```bash
cd client
npm run dev
```

Client runs on → http://localhost:5173

---

## What works in Phase 1

- ✅ Create a room (get an invite code)
- ✅ Join a room (enter code + nickname)
- ✅ Real-time messaging in #general
- ✅ Typing indicators
- ✅ Member list (live, updates on join/leave)
- ✅ Creator host badge (👑)
- ✅ Kick members (creator only)
- ✅ Add channels (creator only)
- ✅ Copy invite link
- ✅ 60s grace period if host disconnects
- ✅ Room auto-deletes when creator leaves
- ✅ "CONNECTION TERMINATED" screen on room deletion
- ✅ "ACCESS REVOKED" screen if kicked

## Architecture

```
server/
  index.js              ← Express + Socket.io
  store/memoryStore.js  ← In-RAM store (zero disk writes)
  socket/roomHandlers.js
  socket/messageHandlers.js

client/src/
  main.jsx
  App.jsx               ← Route switching
  context/RoomContext   ← All room state
  hooks/useSocket.js    ← Socket.io connection
  components/Landing/   ← Create / Join UI
  components/Room/      ← Full chat layout
  components/Screens/   ← Deleted / Kicked screens
```

## Phases Remaining

- **Phase 2** — Emoji reactions, message replies, disappearing messages
- **Phase 3** — Image/media sharing
- **Phase 4** — Animations, memory usage meter, sounds
