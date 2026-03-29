import { useVoice } from '../../context/VoiceContext';
import { useRoom } from '../../context/RoomContext';

export default function VoicePanel() {
  const { inVoice, muted, participants, toggleMute, leaveVoice } = useVoice();
  const { you } = useRoom();

  if (!inVoice) return null;

  const participantList = Object.entries(participants);
  const total = participantList.length + 1; // +1 for self

  return (
    <div style={styles.panel}>
      {/* Left — status */}
      <div style={styles.left}>
        <span style={styles.liveDot} />
        <span style={styles.liveLabel}>VOICE</span>
        <span style={styles.count}>{total} connected</span>
      </div>

      {/* Middle — participant avatars */}
      <div style={styles.avatars}>
        {/* Self */}
        {you && (
          <div style={styles.avatar} title={you.nickname}>
            <div style={{ ...styles.avatarDot, background: you.color }} />
            <span style={{ color: you.color, fontSize: 11 }}>{you.nickname}</span>
            {muted && <span style={styles.muteTag}>🔇</span>}
          </div>
        )}

        {/* Others */}
        {participantList.slice(0, 4).map(([socketId, p]) => (
          <div key={socketId} style={styles.avatar} title={p.nickname}>
            <div style={{
              ...styles.avatarDot,
              background: p.color,
              boxShadow: p.speaking ? `0 0 10px ${p.color}` : 'none',
              animation: p.speaking ? 'pulse 0.8s ease-in-out infinite' : 'none',
            }} />
            <span style={{ color: p.color, fontSize: 11 }}>{p.nickname}</span>
            {p.muted && <span style={styles.muteTag}>🔇</span>}
          </div>
        ))}

        {/* Overflow */}
        {participantList.length > 4 && (
          <div style={styles.overflow}>+{participantList.length - 4}</div>
        )}
      </div>

      {/* Right — controls */}
      <div style={styles.controls}>
        <button
          style={muted ? styles.mutedBtn : styles.muteBtn}
          onClick={toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇 unmute' : '🎤 mute'}
        </button>
        <button style={styles.leaveBtn} onClick={leaveVoice} title="Leave voice">
          ✕ leave
        </button>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 20px',
    background: '#0A1628',
    borderTop: '1px solid #58A6FF33',
    gap: 16,
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  liveDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    background: '#00FF41',
    boxShadow: '0 0 8px #00FF41',
    animation: 'blink 2s ease-in-out infinite',
  },
  liveLabel: {
    color: '#00FF41',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
  },
  count: { color: '#8B949E', fontSize: 11 },
  avatars: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    overflow: 'hidden',
  },
  avatar: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  avatarDot: {
    width: 8, height: 8,
    borderRadius: '50%',
    transition: 'box-shadow 0.15s',
  },
  muteTag: { fontSize: 10 },
  overflow: {
    color: '#8B949E',
    fontSize: 11,
    padding: '0 4px',
  },
  controls: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  muteBtn: {
    background: 'transparent',
    border: '1px solid #30363D',
    borderRadius: 4,
    color: '#8B949E',
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  mutedBtn: {
    background: '#FF444418',
    border: '1px solid #FF444466',
    borderRadius: 4,
    color: '#FF4444',
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  leaveBtn: {
    background: '#FF444418',
    border: '1px solid #FF444466',
    borderRadius: 4,
    color: '#FF4444',
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
  },
};
