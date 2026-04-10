import { EVENTS, MEMBER_ROLES } from '../../shared/constants.js';
import { getRoomBySocket } from '../store/memoryStore.js';

export function registerHostHandlers(io, socket) {

  // ── HOST TRANSFER ──────────────────────────────────────────────────────────
  socket.on(EVENTS.HOST_TRANSFER, ({ targetSocketId }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const oldHost = room.members[socket.id];
    const newHost = room.members[targetSocketId];

    // Only current host can transfer
    if (!oldHost || room.creatorSessionId !== oldHost.sessionId) return;
    if (!newHost) return;
    if (targetSocketId === socket.id) return;

    // Swap roles
    room.members[socket.id].isCreator    = false;
    room.members[socket.id].role = MEMBER_ROLES.MEMBER;
    room.members[targetSocketId].isCreator = true;
    room.members[targetSocketId].role = MEMBER_ROLES.HOST;
    room.sessions[oldHost.sessionId].isCreator = false;
    room.sessions[oldHost.sessionId].role = MEMBER_ROLES.MEMBER;
    room.sessions[newHost.sessionId].isCreator = true;
    room.sessions[newHost.sessionId].role = MEMBER_ROLES.HOST;
    room.creatorSessionId = newHost.sessionId;

    io.to(code).emit(EVENTS.HOST_TRANSFERRED, {
      fromSocketId:   socket.id,
      toSocketId:     targetSocketId,
      fromNickname:   oldHost.nickname,
      toNickname:     newHost.nickname,
    });

    console.log(`[HOST] ${oldHost.nickname} → ${newHost.nickname} in ${code}`);
  });
}
