import { EVENTS, LIMITS, ALLOWED_IMAGE_MIME_TYPES } from '../../shared/constants.js';
import { getRoomBySocket, addMessage, getRoom } from '../store/memoryStore.js';
import { nanoid } from '../utils/nanoid.js';
import { createRateLimiter } from '../utils/rateLimiter.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ROOM_MEDIA  = 50 * 1024 * 1024;

// Allowed sticker IDs — must stay in sync with the client sticker list
const ALLOWED_STICKER_IDS = new Set([
  'wave', 'fire', '100', 'skull', 'eyes', 'thinking',
  'exploding', 'ghost', 'alien', 'robot', 'clown',
  'salute', 'hacker', 'zap', 'lock', 'nerd',
]);

// Shared rate limiter for all message/media send events
const messageLimiter = createRateLimiter({
  capacity: LIMITS.RATE_LIMIT_MESSAGES_PER_SECOND * 2,
  refillRate: LIMITS.RATE_LIMIT_MESSAGES_PER_SECOND,
});

// Strip ASCII control characters (except tab/newline) and null bytes
function sanitizeText(raw) {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function registerMessageHandlers(io, socket) {

  socket.on('disconnect', () => messageLimiter.remove(socket.id));

  // IMAGE UPLOAD
  socket.on(EVENTS.MEDIA_UPLOAD, ({ channel, base64, mimeType, filename }) => {
    if (!messageLimiter.consume(socket.id)) return;

    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    if (!room.channels[channel]) return;
    const member = room.members[socket.id];
    if (!member) return;

    // Validate MIME type against whitelist
    const normalizedMime = typeof mimeType === 'string' ? mimeType.toLowerCase().split(';')[0].trim() : '';
    if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)) { socket.emit(EVENTS.MEDIA_TOO_LARGE, { maxMB: 5, roomLimit: false }); return; }

    // Validate base64 is a non-empty string
    if (typeof base64 !== 'string' || !base64.length) return;

    const bytes = Math.ceil((base64.length * 3) / 4);
    if (bytes > MAX_IMAGE_BYTES) { socket.emit(EVENTS.MEDIA_TOO_LARGE, { maxMB: 5, roomLimit: false }); return; }
    room.totalMediaBytes = (room.totalMediaBytes || 0);
    if (room.totalMediaBytes + bytes > MAX_ROOM_MEDIA) { socket.emit(EVENTS.MEDIA_TOO_LARGE, { maxMB: 50, roomLimit: true }); return; }
    room.totalMediaBytes += bytes;

    // Sanitize filename
    const safeFilename = typeof filename === 'string'
      ? sanitizeText(filename).slice(0, 200) || 'image'
      : 'image';

    const mediaId = nanoid();
    if (!room.channels[channel].mediaBuffers) room.channels[channel].mediaBuffers = {};
    room.channels[channel].mediaBuffers[mediaId] = { base64, mimeType: normalizedMime };

    const message = {
      id: nanoid(), channel, type: 'image', mediaId, base64, mimeType: normalizedMime,
      filename: safeFilename, nickname: member.nickname, color: member.color,
      timestamp: Date.now(), reactions: {}, replyTo: null,
    };
    addMessage(code, channel, message);
    io.to(code).emit(EVENTS.MESSAGE_NEW, { message });
  });

  // TEXT / STICKER
  socket.on(EVENTS.MESSAGE_SEND, ({ channel, text, disappearAfter, replyTo, type, stickerId }) => {
    if (!messageLimiter.consume(socket.id)) return;

    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    if (!room.channels[channel]) return;
    const member = room.members[socket.id];
    if (!member) return;

    if (type === 'sticker') {
      if (!stickerId || !ALLOWED_STICKER_IDS.has(stickerId)) return;
      const message = {
        id: nanoid(), channel, type: 'sticker', stickerId,
        nickname: member.nickname, color: member.color,
        timestamp: Date.now(), reactions: {}, replyTo: null,
      };
      addMessage(code, channel, message);
      io.to(code).emit(EVENTS.MESSAGE_NEW, { message });
      return;
    }

    if (typeof text !== 'string' || !text.trim()) return;
    const sanitized = sanitizeText(text).trim();
    if (!sanitized) return;
    if (sanitized.length > LIMITS.MESSAGE_TEXT_MAX_LENGTH) return;

    const message = {
      id: nanoid(), channel, type: 'text',
      nickname: member.nickname, color: member.color,
      text: sanitized, timestamp: Date.now(),
      disappearAfter: disappearAfter || null,
      replyTo: replyTo || null, reactions: {},
    };
    addMessage(code, channel, message);
    io.to(code).emit(EVENTS.MESSAGE_NEW, { message });

    if (disappearAfter) {
      const timer = setTimeout(() => {
        const r = getRoom(code);
        if (!r) return;
        const ch = r.channels[channel];
        if (!ch) return;
        ch.messages = ch.messages.filter(m => m.id !== message.id);
        delete r.disappearTimers[message.id];
        io.to(code).emit(EVENTS.MESSAGE_EXPIRED, { messageId: message.id });
      }, disappearAfter);
      room.disappearTimers[message.id] = timer;
    }
  });

  // REACTIONS
  socket.on(EVENTS.MESSAGE_REACT, ({ messageId, channel, emoji }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const member = room.members[socket.id];
    if (!member) return;
    const ch = room.channels[channel];
    if (!ch) return;
    const msg = ch.messages.find(m => m.id === messageId);
    if (!msg) return;
    // Validate emoji is a short non-empty string (emoji codepoints are at most a few chars)
    if (typeof emoji !== 'string' || !emoji.trim() || emoji.length > 12) return;
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(member.nickname);
    if (idx === -1) msg.reactions[emoji].push(member.nickname);
    else { msg.reactions[emoji].splice(idx, 1); if (!msg.reactions[emoji].length) delete msg.reactions[emoji]; }
    io.to(code).emit(EVENTS.MESSAGE_REACTION_UPDATED, { messageId, reactions: msg.reactions });
  });
}
