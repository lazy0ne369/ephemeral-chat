import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerRoomHandlers } from './socket/roomHandlers.js';
import { registerVoiceHandlers } from './socket/voiceHandlers.js';
import { createRateLimiter } from './utils/rateLimiter.js';

// Simple in-process HTTP rate limiter: 60 requests per second per IP
const httpLimiter = createRateLimiter({ capacity: 120, refillRate: 60 });

function httpRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (httpLimiter.consume(ip)) {
    next();
  } else {
    res.status(429).json({ error: 'Too many requests' });
  }
}

export function createAppServer(options = {}) {
  const {
    clientOrigin = process.env.CLIENT_ORIGIN,
    serveClient = true,
  } = options;

  const app = express();
  const httpServer = createServer(app);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, '../client/dist');
  const configuredOrigins = clientOrigin
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
    maxHttpBufferSize: 10e6,
  });

  app.use(cors({ origin: originValidator }));
  app.use(express.json());
  app.use(httpRateLimit);

  app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: Date.now() }));

  if (serveClient && existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get(/^(?!\/health$|\/socket\.io).*/, httpRateLimit, (_, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);
    registerRoomHandlers(io, socket);
    registerVoiceHandlers(io, socket);
    socket.on('disconnect', () => console.log(`[DISCONNECT] ${socket.id}`));
  });

  return { app, io, httpServer };
}
