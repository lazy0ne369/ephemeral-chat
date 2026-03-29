import { EVENTS } from '../../shared/constants.js';
import { getRoomBySocket } from '../store/memoryStore.js';

export function registerHostHandlers(io, socket) {

  // ── HOST TRANSFER ──────────────────────────────────────────────────────────
  socket.on(EVENTS.HOST_TRANSFER, ({ targetSocketId }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;

    // Only current host can transfer
    if (room.creatorSocketId !== socket.id) return;
    if (!room.members[targetSocketId]) return;
    if (targetSocketId === socket.id) return;

    const oldHost = room.members[socket.id];
    const newHost = room.members[targetSocketId];

    // Swap roles
    room.members[socket.id].isCreator    = false;
    room.members[targetSocketId].isCreator = true;
    room.creatorSocketId = targetSocketId;

    io.to(code).emit(EVENTS.HOST_TRANSFERRED, {
      fromSocketId:   socket.id,
      toSocketId:     targetSocketId,
      fromNickname:   oldHost.nickname,
      toNickname:     newHost.nickname,
    });

    console.log(`[HOST] ${oldHost.nickname} → ${newHost.nickname} in ${code}`);
  });
}
