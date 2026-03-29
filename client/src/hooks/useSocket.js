import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;
const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';

export function useSocket() {
  const socketRef = useRef(null);

  if (!socketInstance) {
    socketInstance = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });
  }

  socketRef.current = socketInstance;

  useEffect(() => {
    return () => {
      // Don't disconnect on unmount — keep alive across re-renders
      // Only disconnect when user explicitly leaves
    };
  }, []);

  return socketRef.current;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
