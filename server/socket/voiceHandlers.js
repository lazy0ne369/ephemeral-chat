import { getRoomBySocket } from '../store/memoryStore.js';

export function registerVoiceHandlers(io, socket) {

  // ── JOIN VOICE ────────────────────────────────────────────────────────────
  socket.on('voice:join', () => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    const member = room.members[socket.id];
    if (!member) return;

    if (!room.voiceParticipants) room.voiceParticipants = new Set();

    room.voiceParticipants.add(socket.id);

    // Tell the joiner who's already in voice so they can initiate peers
    const existing = [...room.voiceParticipants]
      .filter(id => id !== socket.id)
      .map(id => ({
        socketId: id,
        nickname: room.members[id]?.nickname,
        color:    room.members[id]?.color,
      }));

    socket.emit('voice:currentParticipants', existing);

    // Tell everyone else this person joined voice
    socket.to(code).emit('voice:userJoined', {
      socketId: socket.id,
      nickname: member.nickname,
      color:    member.color,
    });

    console.log(`[VOICE] ${member.nickname} joined voice in ${code}`);
  });

  // ── LEAVE VOICE ───────────────────────────────────────────────────────────
  socket.on('voice:leave', () => handleVoiceLeave(io, socket));

  // ── SIGNAL RELAY (SDP + ICE) ──────────────────────────────────────────────
  // Server never inspects signal content — pure relay
  socket.on('voice:signal', ({ targetId, signal }) => {
    io.to(targetId).emit('voice:signal', {
      fromId: socket.id,
      signal,
    });
  });

  // ── MUTE TOGGLE ───────────────────────────────────────────────────────────
  socket.on('voice:mute', ({ muted }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code } = result;
    socket.to(code).emit('voice:muteUpdate', {
      socketId: socket.id,
      muted,
    });
  });

  // ── SPEAKING INDICATOR ────────────────────────────────────────────────────
  socket.on('voice:speaking', ({ isSpeaking }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code } = result;
    socket.to(code).emit('voice:speakingUpdate', {
      socketId: socket.id,
      isSpeaking,
    });
  });

  // ── CLEANUP ON DISCONNECT ─────────────────────────────────────────────────
  socket.on('disconnect', () => handleVoiceLeave(io, socket));
}

function handleVoiceLeave(io, socket) {
  const result = getRoomBySocket(socket.id);
  if (!result) return;
  const { code, room } = result;

  if (!room.voiceParticipants?.has(socket.id)) return;

  room.voiceParticipants.delete(socket.id);

  io.to(code).emit('voice:userLeft', { socketId: socket.id });

  const member = room.members[socket.id];
  console.log(`[VOICE] ${member?.nickname ?? socket.id} left voice in ${code}`);
}
