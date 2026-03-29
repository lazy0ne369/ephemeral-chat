import { EVENTS } from '../../shared/constants.js';
import { getRoomBySocket, addMessage, getRoom } from '../store/memoryStore.js';
import { nanoid } from '../utils/nanoid.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ROOM_MEDIA  = 50 * 1024 * 1024;

export function registerMessageHandlers(io, socket) {

  // IMAGE UPLOAD
  socket.on(EVENTS.MEDIA_UPLOAD, ({ channel, base64, mimeType, filename }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    if (!room.channels[channel]) return;
    const member = room.members[socket.id];
    if (!member) return;

    const bytes = Math.ceil((base64.length * 3) / 4);
    if (bytes > MAX_IMAGE_BYTES) { socket.emit(EVENTS.MEDIA_TOO_LARGE, { maxMB: 5, roomLimit: false }); return; }
    room.totalMediaBytes = (room.totalMediaBytes || 0);
    if (room.totalMediaBytes + bytes > MAX_ROOM_MEDIA) { socket.emit(EVENTS.MEDIA_TOO_LARGE, { maxMB: 50, roomLimit: true }); return; }
    room.totalMediaBytes += bytes;

    const mediaId = nanoid();
    if (!room.channels[channel].mediaBuffers) room.channels[channel].mediaBuffers = {};
    room.channels[channel].mediaBuffers[mediaId] = { base64, mimeType };

    const message = {
      id: nanoid(), channel, type: 'image', mediaId, base64, mimeType,
      filename: filename || 'image', nickname: member.nickname, color: member.color,
      timestamp: Date.now(), reactions: {}, replyTo: null,
    };
    addMessage(code, channel, message);
    io.to(code).emit(EVENTS.MESSAGE_NEW, { message });
  });

  // TEXT / STICKER
  socket.on(EVENTS.MESSAGE_SEND, ({ channel, text, disappearAfter, replyTo, type, stickerId }) => {
    const result = getRoomBySocket(socket.id);
    if (!result) return;
    const { code, room } = result;
    if (!room.channels[channel]) return;
    const member = room.members[socket.id];
    if (!member) return;

    if (type === 'sticker') {
      if (!stickerId) return;
      const message = {
        id: nanoid(), channel, type: 'sticker', stickerId,
        nickname: member.nickname, color: member.color,
        timestamp: Date.now(), reactions: {}, replyTo: null,
      };
      addMessage(code, channel, message);
      io.to(code).emit(EVENTS.MESSAGE_NEW, { message });
      return;
    }

    if (!text?.trim()) return;
    const message = {
      id: nanoid(), channel, type: 'text',
      nickname: member.nickname, color: member.color,
      text: text.trim(), timestamp: Date.now(),
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
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(member.nickname);
    if (idx === -1) msg.reactions[emoji].push(member.nickname);
    else { msg.reactions[emoji].splice(idx, 1); if (!msg.reactions[emoji].length) delete msg.reactions[emoji]; }
    io.to(code).emit(EVENTS.MESSAGE_REACTION_UPDATED, { messageId, reactions: msg.reactions });
  });
}
