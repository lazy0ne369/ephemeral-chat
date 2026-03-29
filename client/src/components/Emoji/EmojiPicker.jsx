import { useState, useRef, useEffect } from 'react';

const EMOJI_GROUPS = {
  '😊': ['😀','😂','🥹','😊','😍','🤩','😎','🥳','😏','😒','😭','😤','🤔','🫡','🤯','😴','🤢','👻','💀','🔥'],
  '👍': ['👍','👎','👏','🙌','🤝','✌️','🤞','💪','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💯','⚡','✨'],
  '🐱': ['🐱','🐶','🐸','🐼','🦊','🐨','🦁','🐯','🐻','🦝','🐧','🦆','🦋','🐙','🦈','🌸','🌈','⭐','🌙','☀️'],
  '🍕': ['🍕','🍔','🌮','🍜','🍣','🍩','🧁','🍫','☕','🧃','🍺','🥂','🎂','🍓','🥑','🌶️','🧄','🍪','🥐','🍦'],
};

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeGroup, setActiveGroup] = useState('😊');
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
      {/* Group tabs */}
      <div style={styles.tabs}>
        {Object.keys(EMOJI_GROUPS).map(g => (
          <button
            key={g}
            style={{ ...styles.tab, ...(g === activeGroup ? styles.tabActive : {}) }}
            onClick={() => setActiveGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div style={styles.grid}>
        {EMOJI_GROUPS[activeGroup].map(emoji => (
          <button
            key={emoji}
            style={styles.emojiBtn}
            onClick={() => { onSelect(emoji); onClose(); }}
            title={emoji}
          >
            {emoji}
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
    padding: 10,
    width: 280,
    zIndex: 100,
    boxShadow: '0 8px 32px #00000066',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 8,
    borderBottom: '1px solid #30363D',
    paddingBottom: 8,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 16,
    opacity: 0.5,
  },
  tabActive: { opacity: 1, background: '#30363D' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: 2,
  },
  emojiBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    padding: 3,
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    transition: 'background 0.1s',
  },
};
