export function RoomDeleted({ onReset }) {
  return (
    <div style={styles.container}>
      <div style={styles.terminal}>
        <div style={styles.line}>
          <span style={styles.red}>✗</span>
          <span style={styles.text}> CONNECTION_TERMINATED</span>
        </div>
        <div style={styles.spacer} />
        <div style={styles.muted}>// host left the room</div>
        <div style={styles.muted}>// all messages have been wiped</div>
        <div style={styles.muted}>// room code is now invalid</div>
        <div style={styles.spacer} />
        <button style={styles.btn} onClick={onReset}>
          + initialize new room
        </button>
      </div>
    </div>
  );
}

export function Kicked({ onReset }) {
  return (
    <div style={styles.container}>
      <div style={styles.terminal}>
        <div style={styles.line}>
          <span style={styles.yellow}>⚠</span>
          <span style={styles.text}> ACCESS_REVOKED</span>
        </div>
        <div style={styles.spacer} />
        <div style={styles.muted}>// you were removed by the host</div>
        <div style={styles.spacer} />
        <button style={styles.btn} onClick={onReset}>
          + initialize new room
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0D1117',
    fontFamily: 'var(--font-mono, monospace)',
  },
  terminal: {
    padding: '40px 48px',
    background: '#161B22',
    border: '1px solid #30363D',
    borderRadius: 8,
    minWidth: 360,
  },
  line: { display: 'flex', alignItems: 'center', gap: 8 },
  text: { color: '#E6EDF3', fontWeight: 700, fontSize: 16, letterSpacing: '0.06em' },
  red: { color: '#FF4444', fontSize: 18, fontWeight: 700 },
  yellow: { color: '#FFE66D', fontSize: 18 },
  spacer: { height: 20 },
  muted: { color: '#8B949E', fontSize: 12, marginBottom: 4 },
  btn: {
    marginTop: 12,
    background: 'transparent',
    border: '1px solid #00FF41',
    borderRadius: 4,
    color: '#00FF41',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    padding: '10px 20px',
    cursor: 'pointer',
    letterSpacing: '0.08em',
  },
};
