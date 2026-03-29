import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useRoom } from '../../context/RoomContext';
import { EVENTS } from '../../../../shared/constants';

export default function Landing() {
  const socket = useSocket();
  const { roomStatus } = useRoom();

  const [mode, setMode]           = useState(null); // null | 'create' | 'join'
  const [nickname, setNickname]   = useState('');
  const [code, setCode]           = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false); // password prompt for locked rooms
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const match = window.location.pathname.match(/\/join\/([A-Z0-9]{6})/i);
    if (match) { setCode(match[1].toUpperCase()); setMode('join'); }
  }, []);

  useEffect(() => {
    if (mode && inputRef.current) inputRef.current.focus();
  }, [mode]);

  useEffect(() => {
    if (!socket) return;

    socket.on(EVENTS.ROOM_ERROR, ({ reason }) => {
      setError(reason);
      setLoading(false);
    });

    socket.on(EVENTS.ROOM_PASSWORD_REQUIRED, () => {
      setLoading(false);
      setShowPass(true);
      setError('This room is password protected');
    });

    return () => {
      socket.off(EVENTS.ROOM_ERROR);
      socket.off(EVENTS.ROOM_PASSWORD_REQUIRED);
    };
  }, [socket]);

  function handleCreate() {
    if (!nickname.trim()) return setError('Nickname required');
    setLoading(true); setError('');
    socket.emit(EVENTS.ROOM_CREATE, { nickname: nickname.trim(), password: password.trim() || undefined });
  }

  function handleJoin() {
    if (!nickname.trim()) return setError('Nickname required');
    if (!code.trim())     return setError('Room code required');
    setLoading(true); setError('');
    socket.emit(EVENTS.ROOM_JOIN, {
      nickname: nickname.trim(),
      code: code.trim().toUpperCase(),
      password: password.trim() || undefined,
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.scanline} />
      <div style={styles.terminal}>
        <div style={styles.header}>
          <span style={styles.prompt}>{'>'}</span>
          <span style={styles.title}>EPHEMERAL_CHAT</span>
          <span style={styles.version}>v1.0</span>
          <span style={{ color: '#00FF41', animation: 'blink 1s step-end infinite' }}>█</span>
        </div>
        <div style={styles.divider}>{'─'.repeat(36)}</div>
        <div style={{ marginTop: 8 }}>
          <span style={styles.muted}>// no logs. no accounts. no trace.</span>
        </div>

        <div style={{ height: 24 }} />

        {/* Nickname */}
        <Field label="NICKNAME">
          <input
            ref={inputRef}
            style={styles.input}
            value={nickname}
            onChange={e => { setNickname(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : mode === 'join' ? handleJoin() : null)}
            placeholder="enter alias..."
            maxLength={20} spellCheck={false} autoComplete="off"
          />
        </Field>

        {/* Code (join) */}
        {mode === 'join' && (
          <Field label="ROOM CODE" style={{ marginTop: 12 }}>
            <input
              style={{ ...styles.input, textTransform: 'uppercase', letterSpacing: '0.2em' }}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="XXXXXX"
              maxLength={6} spellCheck={false} autoComplete="off"
            />
          </Field>
        )}

        {/* Password — create: optional, join: shown if room is locked */}
        {(mode === 'create' || showPass) && (
          <Field
            label={mode === 'create' ? 'PASSWORD (optional)' : '🔒 ROOM PASSWORD'}
            style={{ marginTop: 12 }}
          >
            <input
              style={styles.input}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
              placeholder={mode === 'create' ? 'leave blank for open room...' : 'enter password...'}
              type="password"
              spellCheck={false} autoComplete="off"
            />
          </Field>
        )}

        {error && (
          <div style={styles.error}><span style={{ fontWeight: 700 }}>✗</span> {error}</div>
        )}

        <div style={{ height: 24 }} />

        {/* Buttons */}
        {mode === null && (
          <div style={styles.btnRow}>
            <Btn primary onClick={() => setMode('create')}>+ CREATE ROOM</Btn>
            <span style={styles.or}>or</span>
            <Btn onClick={() => setMode('join')}>→ JOIN ROOM</Btn>
          </div>
        )}

        {mode === 'create' && (
          <div style={styles.btnRow}>
            <Btn primary disabled={loading} onClick={handleCreate}>
              {loading ? '...' : '⚡ INITIALIZE ROOM'}
            </Btn>
            <Btn ghost onClick={() => { setMode(null); setError(''); setPassword(''); }}>← back</Btn>
          </div>
        )}

        {mode === 'join' && (
          <div style={styles.btnRow}>
            <Btn disabled={loading} onClick={handleJoin}>
              {loading ? '...' : '→ ENTER ROOM'}
            </Btn>
            <Btn ghost onClick={() => { setMode(null); setError(''); setPassword(''); setShowPass(false); setCode(''); }}>← back</Btn>
          </div>
        )}

        <div style={{ height: 32 }} />
        <div style={styles.footer}>
          <span style={styles.muted}>// rooms auto-destruct when host leaves</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label style={{ color: '#8B949E', fontSize: 11, letterSpacing: '0.12em' }}>
        <span style={{ color: '#00FF41' }}>$</span> {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0D1117', border: '1px solid #30363D', borderRadius: 4, padding: '8px 12px' }}>
        <span style={{ color: '#00FF41', fontWeight: 700 }}>{'>'}</span>
        {children}
      </div>
    </div>
  );
}

function Btn({ primary, ghost, disabled, onClick, children }) {
  if (ghost) return (
    <button style={{ background: 'transparent', border: 'none', color: '#8B949E', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '8px 4px' }} onClick={onClick}>{children}</button>
  );
  return (
    <button
      style={{
        background: disabled ? '#30363D' : primary ? '#00FF41' : 'transparent',
        color: disabled ? '#8B949E' : primary ? '#0D1117' : '#58A6FF',
        border: primary || disabled ? 'none' : '1px solid #58A6FF',
        borderRadius: 4, padding: '10px 20px',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.08em', cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const styles = {
  container: { height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D1117', position: 'relative', overflow: 'hidden' },
  scanline: { position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(transparent, #00FF4120, transparent)', animation: 'scanline 8s linear infinite', pointerEvents: 'none' },
  terminal: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, padding: '40px 48px', background: '#161B22', border: '1px solid #30363D', borderRadius: 8, boxShadow: '0 0 60px #00FF4108, 0 0 120px #00FF4104' },
  header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  prompt: { color: '#00FF41', fontWeight: 700 },
  title: { color: '#E6EDF3', fontWeight: 700, fontSize: 16, letterSpacing: '0.08em' },
  version: { color: '#8B949E', fontSize: 11 },
  divider: { color: '#30363D', fontSize: 11 },
  muted: { color: '#8B949E', fontSize: 12 },
  input: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#E6EDF3', fontFamily: 'var(--font-mono, monospace)', fontSize: 13, caretColor: '#00FF41' },
  error: { marginTop: 10, color: '#FF4444', fontSize: 12 },
  btnRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  or: { color: '#8B949E', fontSize: 12 },
  footer: { borderTop: '1px solid #30363D', paddingTop: 16 },
};
