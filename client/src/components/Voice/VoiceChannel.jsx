import { useVoice } from '../../context/VoiceContext';
import { useRoom } from '../../context/RoomContext';

export default function VoiceChannel() {
  const { inVoice, muted, participants, error, joinVoice, leaveVoice, toggleMute } = useVoice();
  const { you } = useRoom();

  const participantList = Object.entries(participants);

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.icon}>🔊</span>
        <span style={styles.label}>VOICE</span>
        <span style={styles.count}>
          {inVoice ? participantList.length + 1 : participantList.length || ''}
        </span>
      </div>

      {/* Participants list */}
      <div style={styles.participants}>
        {/* Self — shown when in voice */}
        {inVoice && you && (
          <div style={styles.participant}>
            <span style={{ ...styles.speakingDot, background: you.color }} />
            <span style={{ color: you.color, flex: 1, fontSize: 12 }}>
              {you.nickname}
            </span>
            {muted
              ? <span style={styles.mutedIcon}>🔇</span>
              : <span style={styles.micIcon}>🎤</span>
            }
          </div>
        )}

        {/* Remote participants */}
        {participantList.map(([socketId, p]) => (
          <div key={socketId} style={styles.participant}>
            <span style={{
              ...styles.speakingDot,
              background: p.color,
              boxShadow: p.speaking ? `0 0 8px ${p.color}` : 'none',
              transform: p.speaking ? 'scale(1.3)' : 'scale(1)',
              transition: 'all 0.15s',
            }} />
            <span style={{ color: p.color, flex: 1, fontSize: 12 }}>{p.nickname}</span>
            {p.muted
              ? <span style={styles.mutedIcon}>🔇</span>
              : <span style={styles.micIcon}>🎤</span>
            }
          </div>
        ))}

        {/* Empty state */}
        {!inVoice && participantList.length === 0 && (
          <div style={styles.empty}>// empty</div>
        )}
      </div>

      {/* Error */}
      {error && <div style={styles.error}>✗ {error}</div>}

      {/* Controls */}
      <div style={styles.controls}>
        {!inVoice ? (
          <button style={styles.joinBtn} onClick={joinVoice}>
            + join voice
          </button>
        ) : (
          <div style={styles.activeControls}>
            <button style={muted ? styles.mutedBtn : styles.muteBtn} onClick={toggleMute}>
              {muted ? '🔇 unmute' : '🎤 mute'}
            </button>
            <button style={styles.leaveBtn} onClick={leaveVoice}>
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    padding: '8px 0',
    borderTop: '1px solid #30363D',
    marginTop: 8,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 16px 6px',
  },
  icon: { fontSize: 12 },
  label: {
    color: '#484F58',
    fontSize: 10,
    letterSpacing: '0.12em',
    fontWeight: 700,
    flex: 1,
  },
  count: { color: '#00FF41', fontSize: 11, fontWeight: 700 },
  participants: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 8px',
    minHeight: 20,
  },
  participant: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 8px',
    borderRadius: 4,
  },
  speakingDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  micIcon: { fontSize: 10, opacity: 0.6 },
  mutedIcon: { fontSize: 10 },
  empty: { color: '#484F58', fontSize: 11, padding: '2px 8px' },
  error: {
    color: '#FF4444',
    fontSize: 11,
    padding: '4px 16px',
  },
  controls: { padding: '6px 10px 2px' },
  joinBtn: {
    width: '100%',
    background: 'transparent',
    border: '1px solid #00FF4144',
    borderRadius: 4,
    color: '#00FF41',
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '5px 0',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  activeControls: {
    display: 'flex',
    gap: 6,
  },
  muteBtn: {
    flex: 1,
    background: '#161B22',
    border: '1px solid #30363D',
    borderRadius: 4,
    color: '#8B949E',
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '5px 0',
    cursor: 'pointer',
  },
  mutedBtn: {
    flex: 1,
    background: '#FF444418',
    border: '1px solid #FF444444',
    borderRadius: 4,
    color: '#FF4444',
    fontFamily: 'inherit',
    fontSize: 11,
    padding: '5px 0',
    cursor: 'pointer',
  },
  leaveBtn: {
    background: '#FF444418',
    border: '1px solid #FF444444',
    borderRadius: 4,
    color: '#FF4444',
    fontFamily: 'inherit',
    fontSize: 13,
    padding: '5px 10px',
    cursor: 'pointer',
  },
};
