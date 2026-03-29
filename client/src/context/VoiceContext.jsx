import {
  createContext, useContext, useState,
  useEffect, useRef, useCallback
} from 'react';
import { useSocket } from '../hooks/useSocket';

const VoiceContext = createContext(null);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function VoiceProvider({ children }) {
  const socket = useSocket();

  // ── State ─────────────────────────────────────────────────────────────────
  const [inVoice, setInVoice]               = useState(false);
  const [muted, setMuted]                   = useState(false);
  const [participants, setParticipants]     = useState({}); // socketId → { nickname, color, muted, speaking }
  const [error, setError]                   = useState(null);

  // ── Refs (don't trigger re-renders) ──────────────────────────────────────
  const localStreamRef  = useRef(null);   // my mic MediaStream
  const peersRef        = useRef({});     // socketId → RTCPeerConnection
  const speakingTimers  = useRef({});     // debounce speaking detection
  const analyserRef     = useRef(null);
  const animFrameRef    = useRef(null);

  // ── Create a peer connection ──────────────────────────────────────────────
  const createPeer = useCallback((targetSocketId, isInitiator) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks to peer
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidates → relay via server
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('voice:signal', {
          targetId: targetSocketId,
          signal: { type: 'ice', candidate },
        });
      }
    };

    // Remote audio arrives
    pc.ontrack = ({ streams }) => {
      const audio = document.getElementById(`audio-${targetSocketId}`);
      if (audio) {
        audio.srcObject = streams[0];
        audio.play().catch(() => {});
      } else {
        // Create audio element dynamically
        const el = document.createElement('audio');
        el.id = `audio-${targetSocketId}`;
        el.srcObject = streams[0];
        el.autoplay = true;
        el.style.display = 'none';
        document.body.appendChild(el);
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        removePeer(targetSocketId);
      }
    };

    if (isInitiator) {
      // Create offer
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('voice:signal', {
            targetId: targetSocketId,
            signal: { type: 'offer', sdp: pc.localDescription },
          });
        })
        .catch(err => console.error('[VOICE] Offer error:', err));
    }

    peersRef.current[targetSocketId] = pc;
    return pc;
  }, [socket]);

  // ── Handle incoming signal ────────────────────────────────────────────────
  const handleSignal = useCallback(async ({ fromId, signal }) => {
    let pc = peersRef.current[fromId];

    if (signal.type === 'offer') {
      if (!pc) pc = createPeer(fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:signal', {
        targetId: fromId,
        signal: { type: 'answer', sdp: pc.localDescription },
      });
    } else if (signal.type === 'answer') {
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if (signal.type === 'ice') {
      if (pc && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      }
    }
  }, [createPeer, socket]);

  // ── Remove a peer ─────────────────────────────────────────────────────────
  const removePeer = useCallback((socketId) => {
    const pc = peersRef.current[socketId];
    if (pc) {
      pc.close();
      delete peersRef.current[socketId];
    }
    const el = document.getElementById(`audio-${socketId}`);
    if (el) el.remove();

    setParticipants(prev => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  // ── Speaking detection (Web Audio API) ────────────────────────────────────
  const startSpeakingDetection = useCallback((stream) => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    let wasSpeaking = false;

    const detect = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const isSpeaking = avg > 15;

      if (isSpeaking !== wasSpeaking) {
        wasSpeaking = isSpeaking;
        socket.emit('voice:speaking', { isSpeaking });
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  }, [socket]);

  // ── Join voice channel ────────────────────────────────────────────────────
  const joinVoice = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      localStreamRef.current = stream;
      startSpeakingDetection(stream);
      socket.emit('voice:join');
      setInVoice(true);
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : 'Could not access microphone');
    }
  }, [socket, startSpeakingDetection]);

  // ── Leave voice channel ───────────────────────────────────────────────────
  const leaveVoice = useCallback(() => {
    // Stop mic
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    // Close all peers
    Object.keys(peersRef.current).forEach(id => removePeer(id));

    // Stop speaking detection
    cancelAnimationFrame(animFrameRef.current);

    socket.emit('voice:leave');
    setInVoice(false);
    setParticipants({});
    setMuted(false);
  }, [socket, removePeer]);

  // ── Toggle mute ───────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
    socket.emit('voice:mute', { muted: !track.enabled });
  }, []);

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Existing participants when we join
    socket.on('voice:currentParticipants', (existing) => {
      existing.forEach(({ socketId, nickname, color }) => {
        setParticipants(prev => ({
          ...prev,
          [socketId]: { nickname, color, muted: false, speaking: false },
        }));
        // We are the initiator for each existing member
        createPeer(socketId, true);
      });
    });

    // New person joined after us
    socket.on('voice:userJoined', ({ socketId, nickname, color }) => {
      setParticipants(prev => ({
        ...prev,
        [socketId]: { nickname, color, muted: false, speaking: false },
      }));
      // They will initiate — we are non-initiator, peer created on signal
    });

    // Someone left
    socket.on('voice:userLeft', ({ socketId }) => {
      removePeer(socketId);
    });

    // Signal relay
    socket.on('voice:signal', handleSignal);

    // Mute update
    socket.on('voice:muteUpdate', ({ socketId, muted }) => {
      setParticipants(prev => prev[socketId]
        ? { ...prev, [socketId]: { ...prev[socketId], muted } }
        : prev
      );
    });

    // Speaking update
    socket.on('voice:speakingUpdate', ({ socketId, isSpeaking }) => {
      setParticipants(prev => prev[socketId]
        ? { ...prev, [socketId]: { ...prev[socketId], speaking: isSpeaking } }
        : prev
      );
    });

    return () => {
      socket.off('voice:currentParticipants');
      socket.off('voice:userJoined');
      socket.off('voice:userLeft');
      socket.off('voice:signal');
      socket.off('voice:muteUpdate');
      socket.off('voice:speakingUpdate');
    };
  }, [socket, createPeer, removePeer, handleSignal]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (inVoice) leaveVoice();
    };
  }, []);

  return (
    <VoiceContext.Provider value={{
      inVoice, muted, participants, error,
      joinVoice, leaveVoice, toggleMute,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  return useContext(VoiceContext);
}
