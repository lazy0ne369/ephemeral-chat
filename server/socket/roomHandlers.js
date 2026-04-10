import { EVENTS, LIMITS, MEMBER_ROLES } from '../../shared/constants.js';
import {
  createRoom, joinRoom, resumeRoom, leaveRoom, revokeMemberSession, updateMemberRole, deleteRoom,
  getRoom, getRoomBySocket, getRoomSnapshot, setTyping
} from '../store/memoryStore.js';
import { registerMessageHandlers } from './messageHandlers.js';
import { registerHostHandlers } from './hostHandlers.js';

export function registerRoomHandlers(io, socket) {

  // CREATE ROOM
  socket.on(EVENTS.ROOM_CREATE, ({ nickname, password }) => {
    if (!nickname?.trim()) return;
    nickname = nickname.trim().slice(0, LIMITS.NICKNAME_MAX_LENGTH);
    const { code, room, sessionId } = createRoom(socket.id, nickname, password?.trim() || null);
    socket.join(code);
    emitRoomJoined(socket, code, room, room.members[socket.id], sessionId);
    console.log(`[ROOM] Created: ${code} by ${nickname}${room.password ? ' (locked)' : ''}`);
  });

  // JOIN ROOM
  socket.on(EVENTS.ROOM_JOIN, ({ code, nickname, password }) => {
    if (!code?.trim() || !nickname?.trim()) return;
    code = code.trim().toUpperCase();
    nickname = nickname.trim().slice(0, LIMITS.NICKNAME_MAX_LENGTH);

    const existingRoom = getRoom(code);
    if (!existingRoom) { socket.emit(EVENTS.ROOM_ERROR, { reason: 'Room not found' }); return; }

    if (existingRoom.password) {
      if (!password?.trim()) { socket.emit(EVENTS.ROOM_PASSWORD_REQUIRED, { code }); return; }
      if (password.trim() !== existingRoom.password) { socket.emit(EVENTS.ROOM_ERROR, { reason: 'Incorrect password' }); return; }
    }

    const result = joinRoom(code, socket.id, nickname);
    if (result.error) { socket.emit(EVENTS.ROOM_ERROR, { reason: result.error }); return; }

    const { room, sessionId } = result;
    socket.join(code);
    emitRoomJoined(socket, code, room, room.members[socket.id], sessionId);
    socket.to(code).emit(EVENTS.MEMBER_JOINED, {
      socketId: socket.id,
      nickname,
      color: room.members[socket.id].color,
      role: room.members[socket.id].role,
      isCreator: room.members[socket.id].isCreator,
    });
    console.log(`[ROOM] ${nickname} joined: ${code}`);
  });

  // RESUME ROOM
  socket.on(EVENTS.ROOM_RESUME, ({ code, memberSessionId }) => {
    if (!code?.trim() || !memberSessionId?.trim()) return;

    const normalizedCode = code.trim().toUpperCase();
    const result = resumeRoom(normalizedCode, socket.id, memberSessionId.trim());

    if (result?.error) {
      if (result.kicked) {
        socket.emit(EVENTS.ROOM_KICKED);
        return;
      }

      socket.emit(EVENTS.ROOM_RESUME_FAILED, { reason: result.error });
      return;
    }

    const {
      room,
      member,
      previousSocketId,
      previousPresence,
      restoredHost,
    } = result;

    if (previousSocketId) {
      io.sockets.sockets.get(previousSocketId)?.leave(normalizedCode);

      if (previousPresence?.member) {
        io.to(normalizedCode).emit(EVENTS.MEMBER_LEFT, {
          nickname: previousPresence.member.nickname,
        });
      }

      if (previousPresence?.wasInVoice) {
        io.to(normalizedCode).emit('voice:userLeft', { socketId: previousSocketId });
      }

      if (previousPresence?.member) {
        io.to(normalizedCode).emit(EVENTS.TYPING_UPDATE, {
          nickname: previousPresence.member.nickname,
          isTyping: false,
        });
      }
    }

    socket.join(normalizedCode);
    emitRoomJoined(socket, normalizedCode, room, member, memberSessionId.trim(), true);
    socket.to(normalizedCode).emit(EVENTS.MEMBER_JOINED, {
      socketId: socket.id,
      nickname: member.nickname,
      color: member.color,
      role: member.role,
      isCreator: member.isCreator,
    });

    if (restoredHost) {
      io.to(normalizedCode).emit(EVENTS.ROOM_HOST_BACK);
    }

    console.log(`[ROOM] Resumed: ${normalizedCode} by ${member.nickname}`);
  });

  // LEAVE
  socket.on(EVENTS.ROOM_LEAVE, () => handleLeave(io, socket));
  socket.on('disconnect', () => handleLeave(io, socket));

  // ADD CHANNEL (creator only)
  socket.on(EVENTS.CHANNEL_CREATE, ({ name }) => {
    if (!name?.trim()) return;
    name = name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, LIMITS.CHANNEL_NAME_MAX_LENGTH);
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const actor = room.members[socket.id];
    if (!canManageChannels(actor, room)) return;
    if (room.channels[name]) return;
    if (Object.keys(room.channels).length >= LIMITS.MAX_CHANNELS) return;
    room.channels[name] = { messages: [], mediaBuffers: {} };
    io.to(code).emit(EVENTS.CHANNEL_ADDED, { name });
  });

  // KICK (creator only)
  socket.on(EVENTS.MEMBER_KICK, ({ socketId: targetId }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const actor = room.members[socket.id];
    const target = room.members[targetId];
    if (!target || !canKickMember(actor, target, room)) return;

    const revoked = revokeMemberSession(code, targetId);
    if (!revoked) return;

    const targetSocket = io.sockets.sockets.get(targetId);
    targetSocket?.leave(code);

    io.to(targetId).emit(EVENTS.ROOM_KICKED);
    io.to(code).emit(EVENTS.MEMBER_LEFT, { nickname: revoked.member.nickname });
    io.to(code).emit(EVENTS.TYPING_UPDATE, {
      nickname: revoked.member.nickname,
      isTyping: false,
    });

    if (revoked.wasInVoice) {
      io.to(code).emit('voice:userLeft', { socketId: targetId });
    }
  });

  // ROLE UPDATE (host only)
  socket.on(EVENTS.MEMBER_ROLE_UPDATE, ({ socketId: targetId, role }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const actor = room.members[socket.id];
    const target = room.members[targetId];
    if (!actor || !target) return;
    if (room.creatorSessionId !== actor.sessionId) return;
    if (target.sessionId === room.creatorSessionId) return;
    if (![MEMBER_ROLES.MEMBER, MEMBER_ROLES.MODERATOR].includes(role)) return;

    const updated = updateMemberRole(code, targetId, role);
    if (!updated) return;

    io.to(code).emit(EVENTS.MEMBER_ROLE_UPDATED, {
      socketId: targetId,
      role: updated.member.role,
      isCreator: updated.member.isCreator,
    });
  });

  // DELETE ROOM (host only)
  socket.on(EVENTS.ROOM_DELETE, () => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const actor = room.members[socket.id];
    if (!actor || room.creatorSessionId !== actor.sessionId) return;

    deleteRoom(code);
    io.to(code).emit(EVENTS.ROOM_DELETED);
  });

  // TYPING
  socket.on(EVENTS.TYPING_START, () => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const member = room.members[socket.id];
    if (!member) return;
    setTyping(code, socket.id, true);
    socket.to(code).emit(EVENTS.TYPING_UPDATE, { nickname: member.nickname, isTyping: true });
  });

  socket.on(EVENTS.TYPING_STOP, () => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const member = room.members[socket.id];
    if (!member) return;
    setTyping(code, socket.id, false);
    socket.to(code).emit(EVENTS.TYPING_UPDATE, { nickname: member.nickname, isTyping: false });
  });

  registerMessageHandlers(io, socket);
  registerHostHandlers(io, socket);
}

function canManageChannels(actor, room) {
  if (!actor) return false;
  if (room.creatorSessionId === actor.sessionId) return true;
  return actor.role === MEMBER_ROLES.MODERATOR;
}

function canKickMember(actor, target, room) {
  if (!actor || !target) return false;

  const actorIsHost = room.creatorSessionId === actor.sessionId;
  const actorIsModerator = actor.role === MEMBER_ROLES.MODERATOR;
  const targetIsHost = room.creatorSessionId === target.sessionId;
  const targetIsModerator = target.role === MEMBER_ROLES.MODERATOR;

  if (actorIsHost) {
    return !targetIsHost;
  }

  if (actorIsModerator) {
    return !targetIsHost && !targetIsModerator;
  }

  return false;
}

function handleLeave(io, socket) {
  const result = leaveRoom(socket.id);
  if (!result) return;
  const { code, room, member, wasCreator, wasInVoice } = result;
  socket.leave(code);
  io.to(code).emit(EVENTS.MEMBER_LEFT, { nickname: member.nickname });
  io.to(code).emit(EVENTS.TYPING_UPDATE, { nickname: member.nickname, isTyping: false });

  if (wasInVoice) {
    io.to(code).emit('voice:userLeft', { socketId: socket.id });
  }

  if (!room) return;

  if (wasCreator) {
    if (room.gracePeriodTimer) {
      clearTimeout(room.gracePeriodTimer);
    }

    io.to(code).emit(EVENTS.ROOM_HOST_WARNING, {
      secondsLeft: Math.floor(LIMITS.GRACE_PERIOD_MS / 1000),
    });
    console.log(`[ROOM] Creator left ${code} — grace period`);
    room.gracePeriodTimer = setTimeout(() => {
      deleteRoom(code);
      io.to(code).emit(EVENTS.ROOM_DELETED);
      console.log(`[ROOM] Deleted (grace expired): ${code}`);
    }, LIMITS.GRACE_PERIOD_MS);
  } else {
    if (Object.keys(room.members).length === 0 && !room.gracePeriodTimer) {
      deleteRoom(code);
      console.log(`[ROOM] Deleted (empty): ${code}`);
    }
  }
}

function emitRoomJoined(socket, code, room, member, memberSessionId, resumed = false) {
  socket.emit(EVENTS.ROOM_JOINED, {
    code,
    roomState: getRoomSnapshot(code),
    you: {
      nickname: member.nickname,
      color: member.color,
      role: member.role,
      isCreator: member.isCreator,
    },
    hasPassword: !!room.password,
    memberSessionId,
    resumed,
  });
}
