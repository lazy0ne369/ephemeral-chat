import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/constants';
import LetterGlitch from '../../components/LetterGlitch';
import BorderGlow from '../../components/BorderGlow';
import TargetCursor from '../../components/TargetCursor';

const HERO_LINES = [
  'No logs.',
  'No accounts.',
  'No trace.',
];

export default function Landing() {
  const socket = useSocket();
  const [mode, setMode] = useState(null);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const inputRef = useRef(null);

  const isCompact = viewportWidth < 980;
  const isNarrow = viewportWidth < 640;

  useEffect(() => {
    const match = window.location.pathname.match(/\/join\/([A-Z0-9]{6})/i);
    if (match) {
      setCode(match[1].toUpperCase());
      setMode('join');
    }
  }, []);

  useEffect(() => {
    if (mode && inputRef.current) inputRef.current.focus();
  }, [mode]);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleRoomError({ reason }) {
      setError(reason);
      setLoading(false);
    }

    function handlePasswordRequired() {
      setLoading(false);
      setShowPass(true);
      setError('This room is password protected');
    }

    socket.on(EVENTS.ROOM_ERROR, handleRoomError);
    socket.on(EVENTS.ROOM_PASSWORD_REQUIRED, handlePasswordRequired);

    return () => {
      socket.off(EVENTS.ROOM_ERROR, handleRoomError);
      socket.off(EVENTS.ROOM_PASSWORD_REQUIRED, handlePasswordRequired);
    };
  }, [socket]);

  function handleCreate() {
    if (!nickname.trim()) {
      setError('Nickname required');
      return;
    }

    setLoading(true);
    setError('');
    socket.emit(EVENTS.ROOM_CREATE, {
      nickname: nickname.trim(),
      password: password.trim() || undefined,
    });
  }

  function handleJoin() {
    if (!nickname.trim()) {
      setError('Nickname required');
      return;
    }

    if (!code.trim()) {
      setError('Room code required');
      return;
    }

    setLoading(true);
    setError('');
    socket.emit(EVENTS.ROOM_JOIN, {
      nickname: nickname.trim(),
      code: code.trim().toUpperCase(),
      password: password.trim() || undefined,
    });
  }

  function resetToMenu() {
    setMode(null);
    setError('');
    setPassword('');
    setShowPass(false);
    setCode('');
    setLoading(false);
  }

  const actionLabel = mode === 'create'
    ? (loading ? 'Initializing...' : 'Initialize Room')
    : (loading ? 'Connecting...' : 'Enter Room');

  return (
    <div style={styles.page}>
      <TargetCursor targetSelector=".cursor-target" spinDuration={2.4} />

      <div style={styles.backgroundLayer}>
        <LetterGlitch
          className="landing-letter-glitch"
          glitchColors={['#0f2f28', '#1fd8a4', '#63a6ff']}
          glitchSpeed={70}
          smooth
          outerVignette
          centerVignette={false}
        />
      </div>

      <div style={styles.noiseOverlay} />
      <div style={styles.radialGlowTop} />
      <div style={styles.radialGlowBottom} />

      <div
        style={{
          ...styles.contentWrap,
          ...(isCompact ? styles.contentWrapCompact : null),
        }}
      >
        <div
          style={{
            ...styles.heroColumn,
            ...(isCompact ? styles.heroColumnCompact : null),
          }}
        >
          <div style={styles.eyebrow} className="cursor-target">
            EPHEMERAL CHAT / SIGNAL ONLY
          </div>
          <h1 style={styles.heroTitle}>
            Private rooms with
            <br />
            zero residue.
          </h1>
          <div style={styles.heroStack}>
            {HERO_LINES.map((line, index) => (
              <div
                key={line}
                style={{
                  ...styles.heroLine,
                  animationDelay: `${index * 140}ms`,
                }}
              >
                {line}
              </div>
            ))}
          </div>
          <p style={styles.heroCopy}>
            Spin up a temporary room, pull in your squad, study group, or late-night stack,
            and let the whole thing evaporate when the session is over.
          </p>
          <div
            style={{
              ...styles.statRow,
              ...(isNarrow ? styles.statRowNarrow : (isCompact ? styles.statRowCompact : null)),
            }}
          >
            <div style={styles.statCard} className="cursor-target">
              <span style={styles.statValue}>Zero</span>
              <span style={styles.statLabel}>accounts required</span>
            </div>
            <div style={styles.statCard} className="cursor-target">
              <span style={styles.statValue}>60s</span>
              <span style={styles.statLabel}>host recovery window</span>
            </div>
            <div style={styles.statCard} className="cursor-target">
              <span style={styles.statValue}>Live</span>
              <span style={styles.statLabel}>chat, voice, stickers</span>
            </div>
          </div>
        </div>

        <BorderGlow
          className="cursor-target"
          glowColor="150 95 70"
          backgroundColor="rgba(8, 13, 20, 0.8)"
          borderRadius={30}
          glowRadius={28}
          glowIntensity={0.95}
          colors={['#00ff41', '#58a6ff', '#7ef5cf']}
          fillOpacity={0.18}
        >
          <div
            style={{
              ...styles.panel,
              ...(isNarrow ? styles.panelNarrow : null),
            }}
          >
            <div style={styles.panelHeader}>
              <div style={styles.panelDots}>
                <span style={{ ...styles.panelDot, background: '#ff6b6b' }} />
                <span style={{ ...styles.panelDot, background: '#ffe66d' }} />
                <span style={{ ...styles.panelDot, background: '#00ff41' }} />
              </div>
              <span style={styles.panelPath}>/transient/access-node</span>
            </div>

            <div style={styles.panelBody}>
              <div style={styles.titleRow}>
                <span style={styles.prompt}>&gt;</span>
                <span style={styles.title}>EPHEMERAL_CHAT</span>
                <span style={styles.version}>v1.1</span>
              </div>

              <p style={styles.subTitle}>
                Start a fresh room or jump into an invite with an alias only.
              </p>

              <div
                style={{
                  ...styles.modeRow,
                  ...(isNarrow ? styles.modeRowNarrow : null),
                }}
              >
                <ModeChip
                  active={mode === 'create'}
                  onClick={() => {
                    setMode('create');
                    setError('');
                  }}
                >
                  Create
                </ModeChip>
                <ModeChip
                  active={mode === 'join'}
                  onClick={() => {
                    setMode('join');
                    setError('');
                  }}
                >
                  Join
                </ModeChip>
              </div>

              <div style={styles.formBlock}>
                <Field label="Alias" hint="Visible only inside this room.">
                  <input
                    ref={inputRef}
                    className="cursor-target"
                    style={styles.input}
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (mode === 'create') handleCreate();
                        if (mode === 'join') handleJoin();
                      }
                    }}
                    placeholder="enter alias..."
                    maxLength={20}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </Field>

                {mode === 'join' && (
                  <Field label="Room Code" hint="Six-character invite code.">
                    <input
                      className="cursor-target"
                      style={{ ...styles.input, ...styles.codeInput }}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        setError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      placeholder="XXXXXX"
                      maxLength={6}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </Field>
                )}

                {(mode === 'create' || showPass) && (
                  <Field
                    label={mode === 'create' ? 'Password (optional)' : 'Locked Room Password'}
                    hint={mode === 'create'
                      ? 'Leave blank for an open room.'
                      : 'Access required by the current host.'}
                  >
                    <input
                      className="cursor-target"
                      style={styles.input}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (mode === 'create') handleCreate();
                          if (mode === 'join') handleJoin();
                        }
                      }}
                      placeholder={mode === 'create' ? 'optional access key...' : 'enter password...'}
                      type="password"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </Field>
                )}

                {error && <div style={styles.errorBox}>x {error}</div>}
              </div>

              <div
                style={{
                  ...styles.actionRow,
                  ...(isNarrow ? styles.actionRowNarrow : null),
                }}
              >
                {mode === null && (
                  <>
                    <ActionButton primary onClick={() => setMode('create')}>
                      Create Room
                    </ActionButton>
                    <ActionButton onClick={() => setMode('join')}>
                      Join Room
                    </ActionButton>
                  </>
                )}

                {mode !== null && (
                  <>
                    <ActionButton
                      primary
                      disabled={loading}
                      onClick={mode === 'create' ? handleCreate : handleJoin}
                    >
                      {actionLabel}
                    </ActionButton>
                    <TextButton onClick={resetToMenu}>Back</TextButton>
                  </>
                )}
              </div>

              <div style={styles.footer}>
                <span style={styles.footerLabel}>Protocol notes</span>
                <div style={styles.footerList}>
                  <span>Rooms auto-delete when the host is gone too long.</span>
                  <span>Reconnect attempts will restore your active room session.</span>
                </div>
              </div>
            </div>
          </div>
        </BorderGlow>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={styles.fieldWrap}>
      <div style={styles.fieldHeader}>
        <label style={styles.fieldLabel}>{label}</label>
        <span style={styles.fieldHint}>{hint}</span>
      </div>
      <div style={styles.fieldShell}>
        <span style={styles.fieldPrompt}>&gt;</span>
        {children}
      </div>
    </div>
  );
}

function ModeChip({ active, children, onClick }) {
  return (
    <button
      className="cursor-target"
      style={{
        ...styles.modeChip,
        ...(active ? styles.modeChipActive : null),
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ActionButton({ primary = false, disabled = false, children, onClick }) {
  return (
    <BorderGlow
      className="cursor-target"
      glowColor={primary ? '145 95 72' : '210 90 70'}
      backgroundColor={primary ? 'rgba(0, 255, 65, 0.16)' : 'rgba(19, 28, 40, 0.84)'}
      borderRadius={18}
      glowRadius={18}
      glowIntensity={0.85}
      colors={primary ? ['#00ff41', '#7ef5cf', '#58a6ff'] : ['#58a6ff', '#7fb2ff', '#00ff41']}
      fillOpacity={0.14}
    >
      <button
        className="cursor-target"
        style={{
          ...styles.actionButton,
          ...(primary ? styles.actionButtonPrimary : styles.actionButtonSecondary),
          ...(disabled ? styles.actionButtonDisabled : null),
        }}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </BorderGlow>
  );
}

function TextButton({ children, onClick }) {
  return (
    <button className="cursor-target" style={styles.textButton} onClick={onClick}>
      {children}
    </button>
  );
}

const styles = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    width: '100%',
    overflow: 'hidden',
    background: '#03070b',
  },
  backgroundLayer: {
    position: 'absolute',
    inset: 0,
    opacity: 0.44,
  },
  noiseOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
    backgroundSize: '140px 140px',
    mixBlendMode: 'soft-light',
    opacity: 0.22,
    pointerEvents: 'none',
  },
  radialGlowTop: {
    position: 'absolute',
    top: '-10%',
    left: '-8%',
    width: '40rem',
    height: '40rem',
    background: 'radial-gradient(circle, rgba(0,255,65,0.18) 0%, rgba(0,255,65,0) 68%)',
    pointerEvents: 'none',
  },
  radialGlowBottom: {
    position: 'absolute',
    right: '-12%',
    bottom: '-18%',
    width: '42rem',
    height: '42rem',
    background: 'radial-gradient(circle, rgba(88,166,255,0.20) 0%, rgba(88,166,255,0) 72%)',
    pointerEvents: 'none',
  },
  contentWrap: {
    position: 'relative',
    zIndex: 2,
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(360px, 540px)',
    gap: '3rem',
    alignItems: 'center',
    padding: '3rem clamp(1.25rem, 3vw, 3.25rem)',
  },
  contentWrapCompact: {
    gridTemplateColumns: '1fr',
    gap: '2rem',
    alignItems: 'start',
  },
  heroColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '42rem',
  },
  heroColumnCompact: {
    maxWidth: 'unset',
  },
  eyebrow: {
    alignSelf: 'flex-start',
    padding: '0.4rem 0.8rem',
    border: '1px solid rgba(126,245,207,0.3)',
    borderRadius: '999px',
    background: 'rgba(5, 14, 17, 0.6)',
    color: '#8deccc',
    fontSize: '0.72rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    backdropFilter: 'blur(10px)',
  },
  heroTitle: {
    margin: 0,
    color: '#effff7',
    fontSize: 'clamp(2.8rem, 6vw, 5.3rem)',
    lineHeight: 0.9,
    letterSpacing: '-0.05em',
    fontWeight: 720,
    textTransform: 'uppercase',
  },
  heroStack: {
    display: 'flex',
    gap: '0.85rem',
    flexWrap: 'wrap',
    marginTop: '0.4rem',
  },
  heroLine: {
    color: '#7ef5cf',
    fontSize: '1rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: 0,
    animation: 'fadeIn 0.45s ease-out forwards',
  },
  heroCopy: {
    maxWidth: '34rem',
    color: 'rgba(230,237,243,0.82)',
    fontSize: '1rem',
    lineHeight: 1.75,
    margin: '0.25rem 0 0',
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.9rem',
    marginTop: '1rem',
  },
  statRowCompact: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  statRowNarrow: {
    gridTemplateColumns: '1fr',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '1rem 1rem 1.1rem',
    borderRadius: '1.2rem',
    background: 'rgba(7, 12, 19, 0.66)',
    border: '1px solid rgba(126, 245, 207, 0.08)',
    backdropFilter: 'blur(10px)',
  },
  statValue: {
    color: '#ffffff',
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  statLabel: {
    color: '#8b949e',
    fontSize: '0.78rem',
    lineHeight: 1.5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  panel: {
    width: '100%',
    background: 'linear-gradient(180deg, rgba(13,17,23,0.96) 0%, rgba(7,11,16,0.94) 100%)',
    borderRadius: '30px',
    backdropFilter: 'blur(18px)',
  },
  panelNarrow: {
    minWidth: 0,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  panelDots: {
    display: 'flex',
    gap: '0.45rem',
  },
  panelDot: {
    width: '0.65rem',
    height: '0.65rem',
    borderRadius: '50%',
    boxShadow: '0 0 16px currentColor',
  },
  panelPath: {
    color: '#708090',
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  panelBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1.5rem',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  prompt: {
    color: '#00ff41',
    fontWeight: 800,
    fontSize: '1rem',
  },
  title: {
    color: '#effff7',
    fontSize: '1.35rem',
    fontWeight: 760,
    letterSpacing: '0.08em',
  },
  version: {
    color: '#7ef5cf',
    fontSize: '0.74rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  subTitle: {
    margin: 0,
    color: '#90a1ae',
    lineHeight: 1.7,
  },
  modeRow: {
    display: 'flex',
    gap: '0.7rem',
    flexWrap: 'wrap',
  },
  modeRowNarrow: {
    flexDirection: 'column',
  },
  modeChip: {
    padding: '0.7rem 1rem',
    borderRadius: '999px',
    border: '1px solid rgba(88,166,255,0.16)',
    background: 'rgba(12, 18, 26, 0.8)',
    color: '#86b8ff',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  modeChipActive: {
    background: 'linear-gradient(135deg, rgba(0,255,65,0.18) 0%, rgba(88,166,255,0.14) 100%)',
    color: '#effff7',
    border: '1px solid rgba(126,245,207,0.28)',
  },
  formBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.45rem',
  },
  fieldHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.8rem',
  },
  fieldLabel: {
    color: '#dbe5eb',
    fontSize: '0.83rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  fieldHint: {
    color: '#6e7c87',
    fontSize: '0.72rem',
  },
  fieldShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    minHeight: '3.4rem',
    padding: '0 1rem',
    borderRadius: '1rem',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(5, 9, 13, 0.9)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  },
  fieldPrompt: {
    color: '#00ff41',
    fontWeight: 700,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#effff7',
    fontFamily: 'inherit',
    fontSize: '0.96rem',
    caretColor: '#00ff41',
  },
  codeInput: {
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
  },
  errorBox: {
    padding: '0.85rem 1rem',
    borderRadius: '0.95rem',
    border: '1px solid rgba(255,68,68,0.22)',
    background: 'rgba(255,68,68,0.10)',
    color: '#ff8b8b',
    fontSize: '0.88rem',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9rem',
    flexWrap: 'wrap',
  },
  actionRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  actionButton: {
    minWidth: '11.5rem',
    minHeight: '3.35rem',
    padding: '0.9rem 1.35rem',
    border: 'none',
    background: 'transparent',
    color: '#effff7',
    fontFamily: 'inherit',
    fontSize: '0.88rem',
    fontWeight: 760,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  actionButtonPrimary: {
    color: '#03110a',
    textShadow: 'none',
  },
  actionButtonSecondary: {
    color: '#c7defe',
  },
  actionButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  textButton: {
    border: 'none',
    background: 'transparent',
    color: '#9db1bd',
    fontFamily: 'inherit',
    fontSize: '0.84rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    padding: '0.6rem 0.2rem',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  footerLabel: {
    color: '#7ef5cf',
    fontSize: '0.74rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  footerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    color: '#7b8b96',
    fontSize: '0.82rem',
    lineHeight: 1.6,
  },
};
