import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/constants';

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const socket = useSocket();
  const [roomCode, setRoomCode] = useState(null);
  const [roomState, setRoomState] = useState(null); // channels + members snapshot
  const [you, setYou] = useState(null); // { nickname, color, isCreator }
  const [messages, setMessages] = useState({}); // { channelName: [msg, ...] }
  const [members, setMembers] = useState({});
  const [activeChannel, setActiveChannel] = useState('general');
  const [typingUsers, setTypingUsers] = useState([]); // nicknames currently typing
  const [hostWarning, setHostWarning] = useState(null); // secondsLeft
  const [roomStatus, setRoomStatus] = useState('idle'); // idle | active | deleted | kicked

  useEffect(() => {
    if (!socket) return;

    // ── Joined room ─────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_JOINED, ({ code, roomState, you }) => {
      setRoomCode(code);
      setYou(you);
      setMembers(roomState.members);
      setRoomStatus('active');
      setActiveChannel('general');

      // Hydrate messages from snapshot
      const msgs = {};
      for (const [ch, data] of Object.entries(roomState.channels)) {
        msgs[ch] = data.messages;
      }
      setMessages(msgs);
      setRoomState(roomState);
    });

    // ── New message ──────────────────────────────────────────────────────────
    socket.on(EVENTS.MESSAGE_NEW, ({ message }) => {
      setMessages(prev => ({
        ...prev,
        [message.channel]: [...(prev[message.channel] || []), message],
      }));
    });

    // ── Message expired ──────────────────────────────────────────────────────
    socket.on(EVENTS.MESSAGE_EXPIRED, ({ messageId }) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const ch of Object.keys(next)) {
          next[ch] = next[ch].filter(m => m.id !== messageId);
        }
        return next;
      });
    });

    // ── Member joined ────────────────────────────────────────────────────────
    socket.on(EVENTS.MEMBER_JOINED, ({ socketId, nickname, color }) => {
      setMembers(prev => ({
        ...prev,
        [socketId]: { nickname, color, isCreator: false },
      }));
    });

    // ── Member left ──────────────────────────────────────────────────────────
    socket.on(EVENTS.MEMBER_LEFT, ({ nickname }) => {
      setMembers(prev => {
        const next = { ...prev };
        const id = Object.keys(next).find(k => next[k].nickname === nickname);
        if (id) delete next[id];
        return next;
      });
    });

    // ── Channel added ────────────────────────────────────────────────────────
    socket.on(EVENTS.CHANNEL_ADDED, ({ name }) => {
      setMessages(prev => ({ ...prev, [name]: prev[name] || [] }));
    });

    // ── Typing ───────────────────────────────────────────────────────────────
    socket.on(EVENTS.TYPING_UPDATE, ({ nickname, isTyping }) => {
      setTypingUsers(prev =>
        isTyping
          ? prev.includes(nickname) ? prev : [...prev, nickname]
          : prev.filter(n => n !== nickname)
      );
    });

    // ── Host warning ─────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_HOST_WARNING, ({ secondsLeft }) => {
      setHostWarning(secondsLeft);
    });

    socket.on(EVENTS.ROOM_HOST_BACK, () => {
      setHostWarning(null);
    });

    // ── Room deleted ─────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_DELETED, () => {
      setRoomStatus('deleted');
    });

    // ── Kicked ───────────────────────────────────────────────────────────────
    socket.on(EVENTS.ROOM_KICKED, () => {
      setRoomStatus('kicked');
    });

    // ── Reactions ────────────────────────────────────────────────────────────
    socket.on(EVENTS.MESSAGE_REACTION_UPDATED, ({ messageId, reactions }) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const ch of Object.keys(next)) {
          next[ch] = next[ch].map(m =>
            m.id === messageId ? { ...m, reactions } : m
          );
        }
        return next;
      });
    });

    // ── Host transferred ─────────────────────────────────────────────────────
    socket.on(EVENTS.HOST_TRANSFERRED, ({ fromSocketId, toSocketId }) => {
      setMembers(prev => {
        const next = { ...prev };
        if (next[fromSocketId]) next[fromSocketId] = { ...next[fromSocketId], isCreator: false };
        if (next[toSocketId])   next[toSocketId]   = { ...next[toSocketId],   isCreator: true  };
        return next;
      });
      setYou(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          isCreator: socket.id === toSocketId,
        };
      });
    });

    return () => {
      socket.off(EVENTS.HOST_TRANSFERRED);
      socket.off(EVENTS.ROOM_JOINED);
      socket.off(EVENTS.MESSAGE_NEW);
      socket.off(EVENTS.MESSAGE_EXPIRED);
      socket.off(EVENTS.MEMBER_JOINED);
      socket.off(EVENTS.MEMBER_LEFT);
      socket.off(EVENTS.CHANNEL_ADDED);
      socket.off(EVENTS.TYPING_UPDATE);
      socket.off(EVENTS.ROOM_HOST_WARNING);
      socket.off(EVENTS.ROOM_HOST_BACK);
      socket.off(EVENTS.ROOM_DELETED);
      socket.off(EVENTS.ROOM_KICKED);
      socket.off(EVENTS.MESSAGE_REACTION_UPDATED);
    };
  }, [socket]);

  const resetRoom = useCallback(() => {
    setRoomCode(null);
    setRoomState(null);
    setYou(null);
    setMessages({});
    setMembers({});
    setActiveChannel('general');
    setTypingUsers([]);
    setHostWarning(null);
    setRoomStatus('idle');
  }, []);

  const channels = roomState
    ? Object.keys(messages)
    : [];

  return (
    <RoomContext.Provider value={{
      roomCode, roomState, you, messages, members,
      activeChannel, setActiveChannel,
      typingUsers, hostWarning, roomStatus,
      channels, resetRoom,
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  return useContext(RoomContext);
}
