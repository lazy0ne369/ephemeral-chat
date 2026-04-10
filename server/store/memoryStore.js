import { MEMBER_COLORS, LIMITS, MEMBER_ROLES } from '../../shared/constants.js';
import { nanoid } from '../utils/nanoid.js';
import { randomBytes } from 'node:crypto';

const store = { rooms: {} };

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;

  do {
    const bytes = randomBytes(6);
    code = Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
  } while (store.rooms[code]);

  return code;
}

function assignColor(room) {
  const usedColors = new Set(
    Object.values(room.sessions)
      .filter((session) => !session.revoked)
      .map((session) => session.color)
  );

  return MEMBER_COLORS.find((color) => !usedColors.has(color))
    || MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
}

function createSessionRecord({ sessionId, nickname, color, role }) {
  return {
    sessionId,
    nickname,
    color,
    role,
    isCreator: role === MEMBER_ROLES.HOST,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    revoked: false,
  };
}

function createActiveMember(session) {
  return {
    sessionId: session.sessionId,
    nickname: session.nickname,
    color: session.color,
    role: session.role,
    isCreator: session.isCreator,
    joinedAt: session.joinedAt,
    connectedAt: Date.now(),
  };
}

function getActiveSocketIdForSession(room, sessionId) {
  return Object.keys(room.members).find(
    (socketId) => room.members[socketId].sessionId === sessionId
  ) || null;
}

function removeActiveState(room, socketId) {
  const member = room.members[socketId];
  if (!member) return null;

  delete room.members[socketId];
  delete room.typingUsers[socketId];

  const wasInVoice = room.voiceParticipants?.delete(socketId) || false;
  const session = room.sessions[member.sessionId];

  if (session) {
    session.lastSeenAt = Date.now();
  }

  return { member, wasInVoice };
}

export function createRoom(socketId, nickname, password = null) {
  const code = generateCode();
  const sessionId = nanoid();
  const creatorSession = createSessionRecord({
    sessionId,
    nickname,
    color: MEMBER_COLORS[0],
    role: MEMBER_ROLES.HOST,
  });

  store.rooms[code] = {
    id: code,
    createdAt: Date.now(),
    creatorSessionId: sessionId,
    gracePeriodTimer: null,
    channels: {
      general: { messages: [], mediaBuffers: {} },
    },
    members: {
      [socketId]: createActiveMember(creatorSession),
    },
    sessions: {
      [sessionId]: creatorSession,
    },
    disappearTimers: {},
    typingUsers: {},
    password,
    voiceParticipants: new Set(),
    totalMediaBytes: 0,
  };

  return { code, room: store.rooms[code], sessionId };
}

export function joinRoom(code, socketId, nickname) {
  const room = store.rooms[code];
  if (!room) return { error: 'Room not found' };

  const taken = Object.values(room.sessions).some(
    (session) => !session.revoked
      && session.nickname.toLowerCase() === nickname.toLowerCase()
  );
  if (taken) return { error: 'Nickname already taken in this room' };

  if (Object.keys(room.members).length >= LIMITS.MAX_MEMBERS) {
    return { error: 'Room is full' };
  }

  const sessionId = nanoid();
  const session = createSessionRecord({
    sessionId,
    nickname,
    color: assignColor(room),
    role: MEMBER_ROLES.MEMBER,
  });

  room.sessions[sessionId] = session;
  room.members[socketId] = createActiveMember(session);

  return { room, sessionId };
}

export function resumeRoom(code, socketId, sessionId) {
  const room = store.rooms[code];
  if (!room) return { error: 'Room not found' };

  const session = room.sessions[sessionId];
  if (!session) return { error: 'Session not found' };
  if (session.revoked) return { error: 'Access revoked', kicked: true };

  const previousSocketId = getActiveSocketIdForSession(room, sessionId);
  let previousPresence = null;

  if (previousSocketId && previousSocketId !== socketId) {
    previousPresence = removeActiveState(room, previousSocketId);
  }

  session.isCreator = room.creatorSessionId === sessionId;
  session.role = session.isCreator ? MEMBER_ROLES.HOST : session.role;
  session.lastSeenAt = Date.now();
  room.members[socketId] = createActiveMember(session);

  if (room.creatorSessionId === sessionId && room.gracePeriodTimer) {
    clearTimeout(room.gracePeriodTimer);
    room.gracePeriodTimer = null;
  }

  return {
    room,
    member: room.members[socketId],
    previousSocketId,
    previousPresence,
    restoredHost: room.creatorSessionId === sessionId,
  };
}

export function leaveRoom(socketId) {
  for (const [code, room] of Object.entries(store.rooms)) {
    if (room.members[socketId]) {
      const activeState = removeActiveState(room, socketId);
      if (!activeState) return null;

      return {
        code,
        room,
        member: activeState.member,
        wasCreator: activeState.member.sessionId === room.creatorSessionId,
        wasInVoice: activeState.wasInVoice,
      };
    }
  }

  return null;
}

export function revokeMemberSession(code, socketId) {
  const room = store.rooms[code];
  if (!room?.members[socketId]) return null;

  const activeState = removeActiveState(room, socketId);
  if (!activeState) return null;

  const session = room.sessions[activeState.member.sessionId];
  if (session) {
    session.revoked = true;
    session.lastSeenAt = Date.now();
  }

  return {
    room,
    member: activeState.member,
    sessionId: activeState.member.sessionId,
    wasInVoice: activeState.wasInVoice,
  };
}

export function updateMemberRole(code, targetSocketId, role) {
  const room = store.rooms[code];
  if (!room?.members[targetSocketId]) return null;

  const member = room.members[targetSocketId];
  const session = room.sessions[member.sessionId];
  if (!session) return null;

  session.role = role;
  session.isCreator = role === MEMBER_ROLES.HOST;
  room.members[targetSocketId] = createActiveMember(session);

  return {
    room,
    member: room.members[targetSocketId],
    sessionId: session.sessionId,
  };
}

export function deleteRoom(code) {
  const room = store.rooms[code];
  if (!room) return;

  Object.values(room.disappearTimers).forEach(clearTimeout);

  if (room.gracePeriodTimer) clearTimeout(room.gracePeriodTimer);

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

  const messages = room.channels[channel].messages;
  messages.push(message);

  if (messages.length > LIMITS.MAX_MESSAGES_PER_CHANNEL) {
    messages.splice(0, messages.length - LIMITS.MAX_MESSAGES_PER_CHANNEL);
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
      Object.entries(room.channels).map(([name, channel]) => [
        name,
        { messages: channel.messages },
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
    .reduce((sum, channel) => sum + channel.messages.length, 0);

  return {
    mediaMB: (room.totalMediaBytes / (1024 * 1024)).toFixed(1),
    messageCount,
  };
}

export function resetStore() {
  for (const code of Object.keys(store.rooms)) {
    deleteRoom(code);
  }
}
