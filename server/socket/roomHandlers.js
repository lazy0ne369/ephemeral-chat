import { EVENTS, LIMITS } from '../../shared/constants.js';
import {
  createRoom, joinRoom, leaveRoom, deleteRoom,
  getRoom, getRoomBySocket, getRoomSnapshot, setTyping
} from '../store/memoryStore.js';
import { registerMessageHandlers } from './messageHandlers.js';
import { registerHostHandlers } from './hostHandlers.js';

export function registerRoomHandlers(io, socket) {

  // CREATE ROOM
  socket.on(EVENTS.ROOM_CREATE, ({ nickname, password }) => {
    if (!nickname?.trim()) return;
    nickname = nickname.trim().slice(0, LIMITS.NICKNAME_MAX_LENGTH);
    const { code, room } = createRoom(socket.id, nickname, password?.trim() || null);
    socket.join(code);
    socket.emit(EVENTS.ROOM_JOINED, {
      code,
      roomState: getRoomSnapshot(code),
      you: { nickname, color: room.members[socket.id].color, isCreator: true },
      hasPassword: !!room.password,
    });
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

    const { room } = result;
    socket.join(code);
    socket.emit(EVENTS.ROOM_JOINED, {
      code,
      roomState: getRoomSnapshot(code),
      you: { nickname, color: room.members[socket.id].color, isCreator: false },
      hasPassword: !!room.password,
    });
    socket.to(code).emit(EVENTS.MEMBER_JOINED, {
      socketId: socket.id, nickname, color: room.members[socket.id].color,
    });
    console.log(`[ROOM] ${nickname} joined: ${code}`);
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
    if (room.creatorSocketId !== socket.id) return;
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
    if (room.creatorSocketId !== socket.id) return;
    if (!room.members[targetId]) return;
    const target = room.members[targetId];
    delete room.members[targetId];
    io.to(targetId).emit(EVENTS.ROOM_KICKED);
    io.to(code).emit(EVENTS.MEMBER_LEFT, { nickname: target.nickname });
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

function handleLeave(io, socket) {
  const result = leaveRoom(socket.id);
  if (!result) return;
  const { code, member, wasCreator } = result;
  const room = getRoom(code);
  socket.leave(code);
  io.to(code).emit(EVENTS.MEMBER_LEFT, { nickname: member.nickname });
  if (!room) return;

  if (wasCreator) {
    const membersLeft = Object.keys(room.members).length;
    if (membersLeft === 0) { deleteRoom(code); console.log(`[ROOM] Deleted (empty): ${code}`); return; }
    io.to(code).emit(EVENTS.ROOM_HOST_WARNING, { secondsLeft: 60 });
    console.log(`[ROOM] Creator left ${code} — grace period`);
    room.gracePeriodTimer = setTimeout(() => {
      deleteRoom(code);
      io.to(code).emit(EVENTS.ROOM_DELETED);
      console.log(`[ROOM] Deleted (grace expired): ${code}`);
    }, 60000);
  } else {
    if (Object.keys(room.members).length === 0) { deleteRoom(code); console.log(`[ROOM] Deleted (empty): ${code}`); }
  }
}
