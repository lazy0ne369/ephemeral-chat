import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerRoomHandlers } from './socket/roomHandlers.js';
import { registerVoiceHandlers } from './socket/voiceHandlers.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 10e6, // 10MB per message (for media later)
});

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: Date.now() }));

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
