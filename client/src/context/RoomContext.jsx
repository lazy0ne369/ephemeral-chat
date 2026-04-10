import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { EVENTS } from '../../../shared/constants';

const RoomContext = createContext(null);
const STORAGE_KEY = 'ephemeral-chat:session';

function getStoredSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function buildMessages(roomState) {
  return Object.fromEntries(
    Object.entries(roomState.channels).map(([channelName, channelState]) => [
      channelName,
      channelState.messages,
    ])
  );
}

export function RoomProvider({ children }) {
  const socket = useSocket();
  const [roomCode, setRoomCode] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [you, setYou] = useState(null);
  const [messages, setMessages] = useState({});
  const [members, setMembers] = useState({});
  const [activeChannel, setActiveChannel] = useState('general');
  const [typingUsers, setTypingUsers] = useState([]);
  const [hostWarning, setHostWarning] = useState(null);
  const [roomStatus, setRoomStatus] = useState('idle');
  const [connectionState, setConnectionState] = useState(
    socket?.connected ? 'connected' : 'connecting'
  );

  const resetRoom = useCallback(() => {
    clearStoredSession();
    setRoomCode(null);
    setRoomState(null);
    setYou(null);
    setMessages({});
    setMembers({});
    setActiveChannel('general');
    setTypingUsers([]);
    setHostWarning(null);
    setRoomStatus('idle');
    setConnectionState(socket?.connected ? 'connected' : 'connecting');
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleJoined = ({
      code,
      roomState: snapshot,
      you: joinedUser,
      memberSessionId,
    }) => {
      setRoomCode(code);
      setRoomState(snapshot);
      setYou(joinedUser);
      setMembers(snapshot.members);
      setMessages(buildMessages(snapshot));
      setTypingUsers([]);
      setHostWarning(null);
      setRoomStatus('active');
      setConnectionState('connected');

      if (memberSessionId) {
        storeSession({
          roomCode: code,
          memberSessionId,
        });
      }

      setActiveChannel((currentChannel) => (
        snapshot.channels[currentChannel] ? currentChannel : 'general'
      ));
    };

    const handleResumeFailed = ({ reason }) => {
      clearStoredSession();

      if (reason === 'Room not found') {
        setRoomStatus('deleted');
        return;
      }

      resetRoom();
    };

    socket.on(EVENTS.ROOM_JOINED, handleJoined);

    socket.on(EVENTS.MESSAGE_NEW, ({ message }) => {
      setMessages((prev) => ({
        ...prev,
        [message.channel]: [...(prev[message.channel] || []), message],
      }));
    });

    socket.on(EVENTS.MESSAGE_EXPIRED, ({ messageId }) => {
      setMessages((prev) => {
        const next = { ...prev };
        for (const channelName of Object.keys(next)) {
          next[channelName] = next[channelName].filter(
            (message) => message.id !== messageId
          );
        }
        return next;
      });
    });

    socket.on(EVENTS.MEMBER_JOINED, ({
      socketId,
      nickname,
      color,
      role = 'member',
      isCreator = false,
    }) => {
      setMembers((prev) => ({
        ...prev,
        [socketId]: { nickname, color, role, isCreator },
      }));
    });

    socket.on(EVENTS.MEMBER_LEFT, ({ nickname }) => {
      setMembers((prev) => {
        const next = { ...prev };
        const socketId = Object.keys(next).find(
          (id) => next[id].nickname === nickname
        );

        if (socketId) delete next[socketId];
        return next;
      });
    });

    socket.on(EVENTS.CHANNEL_ADDED, ({ name }) => {
      setMessages((prev) => ({ ...prev, [name]: prev[name] || [] }));
    });

    socket.on(EVENTS.MEMBER_ROLE_UPDATED, ({ socketId, role, isCreator }) => {
      setMembers((prev) => (
        prev[socketId]
          ? { ...prev, [socketId]: { ...prev[socketId], role, isCreator } }
          : prev
      ));

      if (socketId === socket.id) {
        setYou((prev) => (
          prev ? { ...prev, role, isCreator } : prev
        ));
      }
    });

    socket.on(EVENTS.TYPING_UPDATE, ({ nickname, isTyping }) => {
      setTypingUsers((prev) => (
        isTyping
          ? (prev.includes(nickname) ? prev : [...prev, nickname])
          : prev.filter((name) => name !== nickname)
      ));
    });

    socket.on(EVENTS.ROOM_HOST_WARNING, ({ secondsLeft }) => {
      setHostWarning(secondsLeft);
    });

    socket.on(EVENTS.ROOM_HOST_BACK, () => {
      setHostWarning(null);
    });

    socket.on(EVENTS.ROOM_DELETED, () => {
      clearStoredSession();
      setRoomStatus('deleted');
    });

    socket.on(EVENTS.ROOM_KICKED, () => {
      clearStoredSession();
      setRoomStatus('kicked');
    });

    socket.on(EVENTS.ROOM_RESUME_FAILED, handleResumeFailed);

    socket.on(EVENTS.MESSAGE_REACTION_UPDATED, ({ messageId, reactions }) => {
      setMessages((prev) => {
        const next = { ...prev };
        for (const channelName of Object.keys(next)) {
          next[channelName] = next[channelName].map((message) => (
            message.id === messageId ? { ...message, reactions } : message
          ));
        }
        return next;
      });
    });

    socket.on(EVENTS.HOST_TRANSFERRED, ({ fromSocketId, toSocketId }) => {
      setMembers((prev) => {
        const next = { ...prev };
        if (next[fromSocketId]) {
          next[fromSocketId] = {
            ...next[fromSocketId],
            role: 'member',
            isCreator: false,
          };
        }
        if (next[toSocketId]) {
          next[toSocketId] = {
            ...next[toSocketId],
            role: 'host',
            isCreator: true,
          };
        }
        return next;
      });

      setYou((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          role: socket.id === toSocketId ? 'host' : 'member',
          isCreator: socket.id === toSocketId,
        };
      });
    });

    return () => {
      socket.off(EVENTS.ROOM_JOINED, handleJoined);
      socket.off(EVENTS.MESSAGE_NEW);
      socket.off(EVENTS.MESSAGE_EXPIRED);
      socket.off(EVENTS.MEMBER_JOINED);
      socket.off(EVENTS.MEMBER_LEFT);
      socket.off(EVENTS.CHANNEL_ADDED);
      socket.off(EVENTS.MEMBER_ROLE_UPDATED);
      socket.off(EVENTS.TYPING_UPDATE);
      socket.off(EVENTS.ROOM_HOST_WARNING);
      socket.off(EVENTS.ROOM_HOST_BACK);
      socket.off(EVENTS.ROOM_DELETED);
      socket.off(EVENTS.ROOM_KICKED);
      socket.off(EVENTS.ROOM_RESUME_FAILED, handleResumeFailed);
      socket.off(EVENTS.MESSAGE_REACTION_UPDATED);
      socket.off(EVENTS.HOST_TRANSFERRED);
    };
  }, [resetRoom, socket]);

  useEffect(() => {
    if (!hostWarning) return undefined;

    const timer = window.setInterval(() => {
      setHostWarning((current) => {
        if (current === null) return null;
        if (current <= 1) return null;
        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hostWarning]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnectionState('connected');
      const storedSession = getStoredSession();
      if (!storedSession?.roomCode || !storedSession?.memberSessionId) return;

      socket.emit(EVENTS.ROOM_RESUME, {
        code: storedSession.roomCode,
        memberSessionId: storedSession.memberSessionId,
      });
    };

    const handleDisconnect = () => {
      setConnectionState((roomCode || roomStatus === 'active') ? 'reconnecting' : 'disconnected');
    };

    const handleReconnectAttempt = () => {
      setConnectionState('reconnecting');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);

    if (socket.connected) {
      handleConnect();
    } else {
      handleReconnectAttempt();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
    };
  }, [roomCode, roomStatus, socket]);

  const channels = roomState
    ? Object.keys(messages)
    : [];

  return (
    <RoomContext.Provider value={{
      roomCode,
      roomState,
      you,
      messages,
      members,
      activeChannel,
      setActiveChannel,
      typingUsers,
      hostWarning,
      roomStatus,
      connectionState,
      channels,
      resetRoom,
    }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  return useContext(RoomContext);
}
