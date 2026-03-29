import { useRef, useEffect } from 'react';

// Stickers as large emoji with IDs — easy to extend with real SVGs later
export const STICKERS = [
  { id: 'wave',      emoji: '👋', label: 'wave' },
  { id: 'fire',      emoji: '🔥', label: 'fire' },
  { id: '100',       emoji: '💯', label: '100' },
  { id: 'skull',     emoji: '💀', label: 'skull' },
  { id: 'eyes',      emoji: '👀', label: 'eyes' },
  { id: 'thinking',  emoji: '🤔', label: 'thinking' },
  { id: 'exploding', emoji: '🤯', label: 'mind blown' },
  { id: 'ghost',     emoji: '👻', label: 'ghost' },
  { id: 'alien',     emoji: '👽', label: 'alien' },
  { id: 'robot',     emoji: '🤖', label: 'robot' },
  { id: 'clown',     emoji: '🤡', label: 'clown' },
  { id: 'salute',    emoji: '🫡', label: 'salute' },
  { id: 'hacker',    emoji: '💻', label: 'hacker' },
  { id: 'zap',       emoji: '⚡', label: 'zap' },
  { id: 'lock',      emoji: '🔐', label: 'locked' },
  { id: 'nerd',      emoji: '🤓', label: 'nerd' },
];

export default function StickerPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} style={styles.picker}>
      <div style={styles.header}>STICKERS</div>
      <div style={styles.grid}>
        {STICKERS.map(s => (
          <button
            key={s.id}
            style={styles.stickerBtn}
            onClick={() => { onSelect(s.id); onClose(); }}
            title={s.label}
          >
            <span style={styles.stickerEmoji}>{s.emoji}</span>
            <span style={styles.stickerLabel}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  picker: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 8,
    background: '#161B22',
    border: '1px solid #30363D',
    borderRadius: 8,
    padding: 12,
    width: 280,
    zIndex: 100,
    boxShadow: '0 8px 32px #00000066',
  },
  header: {
    color: '#484F58',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    marginBottom: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
  },
  stickerBtn: {
    background: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: 6,
    padding: '8px 4px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'border-color 0.1s, background 0.1s',
  },
  stickerEmoji: { fontSize: 28, lineHeight: 1 },
  stickerLabel: { color: '#8B949E', fontSize: 9, fontFamily: 'inherit' },
};
