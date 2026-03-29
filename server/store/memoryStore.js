import { MEMBER_COLORS, LIMITS } from '../../shared/constants.js';

// ─── In-RAM store — zero disk writes ───────────────────────────────────────
const store = { rooms: {} };

// ─── Code Generator ────────────────────────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (store.rooms[code]);
  return code;
}

// ─── Color Assigner ────────────────────────────────────────────────────────
function assignColor(room) {
  const usedColors = new Set(Object.values(room.members).map(m => m.color));
  return MEMBER_COLORS.find(c => !usedColors.has(c)) ||
    MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
}

// ─── Room Operations ───────────────────────────────────────────────────────
export function createRoom(socketId, nickname, password = null) {
  const code = generateCode();
  store.rooms[code] = {
    id: code,
    createdAt: Date.now(),
    creatorSocketId: socketId,
    gracePeriodTimer: null,
    channels: {
      general: { messages: [], mediaBuffers: {} },
    },
    members: {},
    disappearTimers: {},
    typingUsers: {},
    password: password,
    voiceParticipants: new Set(),
    totalMediaBytes: 0,
  };

  const room = store.rooms[code];
  const color = MEMBER_COLORS[0];
  room.members[socketId] = { nickname, color, isCreator: true, joinedAt: Date.now() };

  return { code, room };
}

export function joinRoom(code, socketId, nickname) {
  const room = store.rooms[code];
  if (!room) return { error: 'Room not found' };

  const taken = Object.values(room.members).some(
    m => m.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (taken) return { error: 'Nickname already taken in this room' };

  if (Object.keys(room.members).length >= LIMITS.MAX_MEMBERS)
    return { error: 'Room is full' };

  const color = assignColor(room);
  room.members[socketId] = { nickname, color, isCreator: false, joinedAt: Date.now() };

  return { room };
}

export function leaveRoom(socketId) {
  for (const [code, room] of Object.entries(store.rooms)) {
    if (room.members[socketId]) {
      const member = room.members[socketId];
      delete room.members[socketId];
      return { code, room, member, wasCreator: member.isCreator };
    }
  }
  return null;
}

export function deleteRoom(code) {
  const room = store.rooms[code];
  if (!room) return;

  // Cancel all disappear timers
  Object.values(room.disappearTimers).forEach(clearTimeout);

  // Cancel grace period timer
  if (room.gracePeriodTimer) clearTimeout(room.gracePeriodTimer);

  // Wipe everything
  delete store.rooms[code];
}

export function getRoom(code) {
  return store.rooms[code] || null;
}

export function getRoomBySocket(socketId) {
  for (const [code, room] of Object.entries(store.rooms)) {
    if (room.members[socketId]) return { code, room };
  }
  return null;
}

export function addMessage(code, channel, message) {
  const room = store.rooms[code];
  if (!room?.channels[channel]) return null;

  const msgs = room.channels[channel].messages;
  msgs.push(message);

  // Trim oldest messages if over limit
  if (msgs.length > LIMITS.MAX_MESSAGES_PER_CHANNEL) {
    msgs.splice(0, msgs.length - LIMITS.MAX_MESSAGES_PER_CHANNEL);
  }

  return message;
}

export function getRoomSnapshot(code) {
  const room = store.rooms[code];
  if (!room) return null;

  return {
    id: room.id,
    createdAt: room.createdAt,
    channels: Object.fromEntries(
      Object.entries(room.channels).map(([name, ch]) => [
        name,
        { messages: ch.messages }
      ])
    ),
    members: room.members,
  };
}

export function setTyping(code, socketId, isTyping) {
  const room = store.rooms[code];
  if (!room) return;
  if (isTyping) {
    room.typingUsers[socketId] = true;
  } else {
    delete room.typingUsers[socketId];
  }
}

export function getStats(code) {
  const room = store.rooms[code];
  if (!room) return null;
  const messageCount = Object.values(room.channels)
    .reduce((sum, ch) => sum + ch.messages.length, 0);
  return {
    mediaMB: (room.totalMediaBytes / (1024 * 1024)).toFixed(1),
    messageCount,
  };
}
