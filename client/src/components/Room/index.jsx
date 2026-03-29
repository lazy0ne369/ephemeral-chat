import { useState, useEffect, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useSocket } from '../../hooks/useSocket';
import { EVENTS } from '../../../../shared/constants';
import VoiceChannel from '../Voice/VoiceChannel';
import VoicePanel from '../Voice/VoicePanel';
import EmojiPicker from '../Emoji/EmojiPicker';
import StickerPicker, { STICKERS } from '../Stickers/StickerPicker';
import ImageUpload from '../Media/ImageUpload';

export default function Room() {
  const socket = useSocket();
  const {
    roomCode,
    you,
    members,
    messages,
    activeChannel,
    setActiveChannel,
    typingUsers,
    hostWarning,
    channels,
  } = useRoom();

  const [inputText, setInputText] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [memberMenu, setMemberMenu] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  useEffect(() => {
    if (!memberMenu) return;

    function handleClick() {
      setMemberMenu(null);
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [memberMenu]);

  useEffect(() => {
    if (!socket) return;

    function handleMediaTooLarge({ maxMB, roomLimit }) {
      setMediaError(
        roomLimit
          ? `Room media limit reached - max ${maxMB}MB total`
          : `Image too large - max ${maxMB}MB`
      );
    }

    socket.on(EVENTS.MEDIA_TOO_LARGE, handleMediaTooLarge);
    return () => socket.off(EVENTS.MEDIA_TOO_LARGE, handleMediaTooLarge);
  }, [socket]);

  function sendMessage() {
    if (!inputText.trim()) return;

    socket.emit(EVENTS.MESSAGE_SEND, {
      channel: activeChannel,
      text: inputText.trim(),
    });
    setInputText('');
    socket.emit(EVENTS.TYPING_STOP);
    clearTimeout(typingTimerRef.current);
    inputRef.current?.focus();
  }

  function sendSticker(id) {
    socket.emit(EVENTS.MESSAGE_SEND, {
      channel: activeChannel,
      type: 'sticker',
      stickerId: id,
    });
    inputRef.current?.focus();
  }

  function handleInputChange(e) {
    setInputText(e.target.value);
    socket.emit(EVENTS.TYPING_START);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket.emit(EVENTS.TYPING_STOP), 2000);
  }

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addChannel() {
    if (!newChannelName.trim()) return;
    socket.emit(EVENTS.CHANNEL_CREATE, { name: newChannelName.trim() });
    setNewChannelName('');
    setShowAddChannel(false);
  }

  function kickMember(socketId) {
    socket.emit(EVENTS.MEMBER_KICK, { socketId });
    setMemberMenu(null);
  }

  function transferHost(socketId) {
    if (!window.confirm(`Pass host to ${members[socketId]?.nickname}?`)) return;
    socket.emit(EVENTS.HOST_TRANSFER, { targetSocketId: socketId });
    setMemberMenu(null);
  }

  function renderMessage(msg) {
    const meta = (
      <>
        <span style={{ color: msg.color, fontWeight: 600, minWidth: 100, flexShrink: 0 }}>
          {msg.nickname}
        </span>
        <span style={s.msgTime}>{fmtTime(msg.timestamp)}</span>
      </>
    );

    if (msg.type === 'image') {
      return (
        <div key={msg.id} style={s.message}>
          {meta}
          <img
            src={`data:${msg.mimeType};base64,${msg.base64}`}
            alt={msg.filename}
            style={s.imageMsg}
            onClick={e => window.open(e.target.src, '_blank')}
          />
        </div>
      );
    }

    if (msg.type === 'sticker') {
      const sticker = STICKERS.find(item => item.id === msg.stickerId);
      return (
        <div key={msg.id} style={s.message}>
          {meta}
          <span style={{ fontSize: 48 }}>{sticker?.emoji || '🎭'}</span>
        </div>
      );
    }

    return (
      <div key={msg.id} style={s.message}>
        {meta}
        <span style={s.msgText}>{msg.text}</span>
      </div>
    );
  }

  const activeMessages = messages[activeChannel] || [];
  const memberList = Object.entries(members);

  return (
    <div style={s.container}>
      {hostWarning && (
        <div style={s.hostWarning}>
          ⚠ Host disconnected - room self-destructs if they don't return
        </div>
      )}
      {mediaError && (
        <div style={s.mediaError} onClick={() => setMediaError('')}>
          ✗ {mediaError} <span style={{ opacity: 0.5 }}>click to dismiss</span>
        </div>
      )}

      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.roomLabel}>ROOM</span>
          <span style={s.roomCode}>{roomCode}</span>
          {you?.isCreator && <span style={s.creatorBadge}>HOST</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={s.copyBtn} onClick={copyInvite}>
            {copied ? '✓ copied' : '📋 copy invite'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8B949E', fontSize: 12 }}>
            <span style={s.dot} />
            {memberList.length} online
          </div>
        </div>
      </div>

      <div style={s.body}>
        <div style={s.sidebar}>
          <div style={s.sectionHeader}>CHANNELS</div>
          {channels.map(ch => (
            <div
              key={ch}
              style={{ ...s.channelItem, ...(ch === activeChannel ? s.channelItemActive : {}) }}
              onClick={() => setActiveChannel(ch)}
            >
              <span style={{ color: '#484F58', fontWeight: 700 }}>#</span>
              <span>{ch}</span>
            </div>
          ))}

          {you?.isCreator && (
            showAddChannel ? (
              <div style={{ padding: '4px 10px' }}>
                <input
                  style={s.sidebarInput}
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addChannel();
                    if (e.key === 'Escape') setShowAddChannel(false);
                  }}
                  placeholder="channel-name"
                  autoFocus
                  maxLength={32}
                />
              </div>
            ) : (
              <div style={s.addChannelBtn} onClick={() => setShowAddChannel(true)}>
                <span style={{ color: '#8B949E' }}>+</span> add channel
              </div>
            )
          )}

          <div style={s.sidebarDivider} />
          <div style={s.sectionHeader}>MEMBERS - {memberList.length}</div>
          {memberList.map(([socketId, member]) => (
            <div key={socketId} style={{ position: 'relative' }}>
              <div
                style={s.memberItem}
                onClick={e => {
                  e.stopPropagation();
                  if (you?.isCreator && !member.isCreator) {
                    setMemberMenu(memberMenu === socketId ? null : socketId);
                  }
                }}
              >
                <span style={{ ...s.memberDot, background: member.color }} />
                <span style={{ color: member.color, flex: 1 }}>
                  {member.isCreator ? '👑 ' : ''}
                  {member.nickname}
                </span>
                {you?.isCreator && !member.isCreator && (
                  <span style={{ color: '#484F58', fontSize: 14 }}>⋮</span>
                )}
              </div>
              {memberMenu === socketId && (
                <div style={s.memberMenu} onClick={e => e.stopPropagation()}>
                  <div style={s.menuItem} onClick={() => transferHost(socketId)}>
                    👑 Make Host
                  </div>
                  <div style={{ ...s.menuItem, color: '#FF4444' }} onClick={() => kickMember(socketId)}>
                    ✕ Kick
                  </div>
                </div>
              )}
            </div>
          ))}
          <VoiceChannel />
        </div>

        <div style={s.chat}>
          <div style={s.channelHeader}>
            <span style={{ color: '#8B949E' }}>#</span>
            <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{activeChannel}</span>
          </div>

          <div style={s.messageList}>
            {activeMessages.length === 0 && (
              <div style={s.emptyState}>
                <span style={{ color: '#484F58' }}>// no messages yet - say something</span>
              </div>
            )}
            {activeMessages.map(msg => renderMessage(msg))}
            {typingUsers.length > 0 && (
              <div style={{ padding: '4px 8px', fontSize: 12, color: '#8B949E' }}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
                <span style={{ animation: 'blink 1s step-end infinite' }}>...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <VoicePanel />

          <div style={s.inputBar}>
            <span style={s.inputPrompt}>{you?.nickname || '>'}</span>
            <div style={{ position: 'relative', display: 'flex', gap: 2, flexShrink: 0 }}>
              {showEmoji && (
                <EmojiPicker
                  onSelect={emoji => setInputText(text => text + emoji)}
                  onClose={() => setShowEmoji(false)}
                />
              )}
              {showStickers && (
                <StickerPicker
                  onSelect={stickerId => {
                    sendSticker(stickerId);
                    setShowStickers(false);
                  }}
                  onClose={() => setShowStickers(false)}
                />
              )}
              <button
                style={s.toolBtn}
                onClick={() => {
                  setShowEmoji(value => !value);
                  setShowStickers(false);
                }}
              >
                😊
              </button>
              <button
                style={s.toolBtn}
                onClick={() => {
                  setShowStickers(value => !value);
                  setShowEmoji(false);
                }}
              >
                🎭
              </button>
              <ImageUpload onError={setMediaError} />
            </div>
            <input
              ref={inputRef}
              style={s.input}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`message #${activeChannel}...`}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              style={inputText.trim() ? s.sendBtn : s.sendBtnDisabled}
              onClick={sendMessage}
              disabled={!inputText.trim()}
            >
              SEND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fmtTime = timestamp =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const s = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0D1117',
    fontFamily: 'var(--font-mono, monospace)',
  },
  hostWarning: {
    background: '#FFE66D18',
    border: '1px solid #FFE66D44',
    borderRadius: 4,
    margin: '8px 12px 0',
    padding: '8px 16px',
    fontSize: 12,
    color: '#FFE66D',
  },
  mediaError: {
    background: '#FF444418',
    border: '1px solid #FF444444',
    borderRadius: 4,
    margin: '4px 12px 0',
    padding: '6px 16px',
    fontSize: 12,
    color: '#FF4444',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid #30363D',
    background: '#161B22',
  },
  roomLabel: { color: '#8B949E', fontSize: 10, letterSpacing: '0.15em' },
  roomCode: { color: '#00FF41', fontWeight: 700, fontSize: 15, letterSpacing: '0.1em' },
  creatorBadge: {
    background: '#00FF4118',
    color: '#00FF41',
    border: '1px solid #00FF4144',
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 700,
  },
  copyBtn: {
    background: 'transparent',
    border: '1px solid #30363D',
    borderRadius: 4,
    color: '#58A6FF',
    fontFamily: 'inherit',
    fontSize: 12,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#00FF41',
    boxShadow: '0 0 6px #00FF41',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 220,
    background: '#010409',
    borderRight: '1px solid #30363D',
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  },
  sectionHeader: {
    color: '#484F58',
    fontSize: 10,
    letterSpacing: '0.12em',
    fontWeight: 700,
    padding: '8px 16px 4px',
  },
  channelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 16px',
    cursor: 'pointer',
    color: '#8B949E',
    fontSize: 13,
    borderRadius: 4,
    margin: '0 6px',
  },
  channelItemActive: { background: '#161B22', color: '#E6EDF3' },
  addChannelBtn: {
    padding: '5px 16px',
    cursor: 'pointer',
    color: '#484F58',
    fontSize: 12,
    margin: '0 6px',
  },
  sidebarInput: {
    width: '100%',
    background: '#161B22',
    border: '1px solid #30363D',
    borderRadius: 4,
    color: '#E6EDF3',
    fontFamily: 'inherit',
    fontSize: 12,
    padding: '5px 8px',
    outline: 'none',
  },
  sidebarDivider: { height: 1, background: '#30363D', margin: '10px 16px' },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 16px',
    fontSize: 12,
    cursor: 'pointer',
  },
  memberDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  memberMenu: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '100%',
    background: '#1F2937',
    border: '1px solid #30363D',
    borderRadius: 6,
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: '0 8px 24px #00000066',
  },
  menuItem: {
    padding: '8px 14px',
    fontSize: 12,
    cursor: 'pointer',
    color: '#E6EDF3',
  },
  chat: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  channelHeader: {
    padding: '12px 20px',
    borderBottom: '1px solid #30363D',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#0D1117',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
  },
  message: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '3px 8px',
    borderRadius: 4,
    flexWrap: 'wrap',
    animation: 'fadeIn 0.15s ease-out',
  },
  msgTime: { color: '#484F58', fontSize: 11, flexShrink: 0 },
  msgText: { color: '#E6EDF3', flex: 1, wordBreak: 'break-word', lineHeight: 1.5 },
  imageMsg: {
    maxWidth: 300,
    maxHeight: 240,
    borderRadius: 6,
    border: '1px solid #30363D',
    cursor: 'pointer',
    display: 'block',
    marginTop: 4,
  },
  inputBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid #30363D',
    background: '#161B22',
  },
  inputPrompt: {
    color: '#00FF41',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: '4px 5px',
    borderRadius: 4,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    background: '#0D1117',
    border: '1px solid #30363D',
    borderRadius: 4,
    color: '#E6EDF3',
    fontFamily: 'inherit',
    fontSize: 13,
    padding: '8px 12px',
    outline: 'none',
    caretColor: '#00FF41',
  },
  sendBtn: {
    background: '#00FF41',
    color: '#0D1117',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.08em',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    background: '#30363D',
    color: '#484F58',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'not-allowed',
    flexShrink: 0,
  },
};
