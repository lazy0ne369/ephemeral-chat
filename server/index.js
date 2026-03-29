import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerRoomHandlers } from './socket/roomHandlers.js';
import { registerVoiceHandlers } from './socket/voiceHandlers.js';

const app = express();
const httpServer = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client/dist');
const configuredOrigins = process.env.CLIENT_ORIGIN
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const originValidator = (origin, callback) => {
  if (!origin || !configuredOrigins?.length || configuredOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin not allowed by CORS'));
};

const io = new Server(httpServer, {
  cors: {
    origin: originValidator,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 10e6, // 10MB per message (for media later)
});

app.use(cors({ origin: originValidator }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: Date.now() }));

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/health$|\/socket\.io).*/, (_, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);
  registerRoomHandlers(io, socket);
  registerVoiceHandlers(io, socket);
  socket.on('disconnect', () => console.log(`[DISCONNECT] ${socket.id}`));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n⚡ Ephemeral Chat Server running on :${PORT}`);
  console.log(`   Zero persistence — memory only\n`);
});
