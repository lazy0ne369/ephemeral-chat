import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useRoom } from '../../context/RoomContext';
import { EVENTS, DISAPPEAR_OPTIONS, MEMBER_ROLES } from '../../../../shared/constants';
import BorderGlow from '../BorderGlow';
import EmojiPicker from '../Emoji/EmojiPicker';
import StickerPicker, { STICKERS } from '../Stickers/StickerPicker';
import ImageUpload from '../Media/ImageUpload';
import VoiceChannel from '../Voice/VoiceChannel';
import VoicePanel from '../Voice/VoicePanel';

const ROLE_LABELS = {
  [MEMBER_ROLES.HOST]: 'HOST',
  [MEMBER_ROLES.MODERATOR]: 'MOD',
  [MEMBER_ROLES.MEMBER]: 'MEMBER',
};

const ROLE_ORDER = {
  [MEMBER_ROLES.HOST]: 0,
  [MEMBER_ROLES.MODERATOR]: 1,
  [MEMBER_ROLES.MEMBER]: 2,
};

const STICKER_LABELS = Object.fromEntries(
  STICKERS.map((sticker) => [sticker.id, sticker.label.toUpperCase()])
);

export default function Room() {
  const socket = useSocket();
  const {
    roomCode,
    you,
    messages,
    members,
    activeChannel,
    setActiveChannel,
    typingUsers,
    hostWarning,
    connectionState,
    channels,
    resetRoom,
  } = useRoom();

  const [inputText, setInputText] = useState('');
  const [disappearAfter, setDisappearAfter] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const endRef = useRef(null);
  const inputRef = useRef(null);
  const settingsRef = useRef(null);

  const isCompact = viewportWidth < 960;
  const isNarrow = viewportWidth < 820;
  const isConnected = connectionState === 'connected';
  const canManageRoom = you?.role === MEMBER_ROLES.HOST;
  const canModerate = canManageRoom || you?.role === MEMBER_ROLES.MODERATOR;
  const activeMessages = messages[activeChannel] || [];
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (normalizedSearch.length < 2) return [];

    const hits = [];

    Object.entries(messages).forEach(([channel, channelMessages]) => {
      (channelMessages || []).forEach((message) => {
        const bodyText = message.type === 'text'
          ? message.text || ''
          : message.type === 'sticker'
            ? `sticker ${STICKER_LABELS[message.stickerId] || message.stickerId || ''}`
            : message.type === 'image'
              ? `image ${message.filename || ''}`
              : '';

        const haystack = `${message.nickname || ''} ${bodyText}`.toLowerCase();

        if (haystack.includes(normalizedSearch)) {
          hits.push({
            id: message.id,
            channel,
            nickname: message.nickname,
            type: message.type,
            preview: bodyText,
            timestamp: message.timestamp,
          });
        }
      });
    });

    return hits
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 60);
  }, [messages, normalizedSearch]);

  const memberEntries = useMemo(() => (
    Object.entries(members).sort(([, left], [, right]) => {
      const roleGap = (ROLE_ORDER[left.role] ?? 99) - (ROLE_ORDER[right.role] ?? 99);
      if (roleGap !== 0) return roleGap;
      return left.nickname.localeCompare(right.nickname);
    })
  ), [members]);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Scroll only within the messageRail, not the window
    if (endRef.current) {
      endRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeChannel, activeMessages.length, typingUsers.length]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleMediaTooLarge({ maxMB, roomLimit }) {
      setMediaError(
        roomLimit
          ? `Room media budget reached (${maxMB}MB).`
          : `Image too large. Max ${maxMB}MB.`
      );
    }

    socket.on(EVENTS.MEDIA_TOO_LARGE, handleMediaTooLarge);

    return () => {
      socket.off(EVENTS.MEDIA_TOO_LARGE, handleMediaTooLarge);
    };
  }, [socket]);

  useEffect(() => {
    if (!copied) return undefined;

    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!settingsOpen) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [settingsOpen]);

  function handleInputChange(event) {
    const nextValue = event.target.value;
    setInputText(nextValue);
    setMediaError('');

    if (!socket) return;

    if (nextValue.trim()) {
      socket.emit(EVENTS.TYPING_START);
    } else {
      socket.emit(EVENTS.TYPING_STOP);
    }
  }

  function sendMessage() {
    if (!socket || !inputText.trim() || !isConnected) return;

    socket.emit(EVENTS.MESSAGE_SEND, {
      channel: activeChannel,
      text: inputText.trim(),
      disappearAfter: disappearAfter ? Number(disappearAfter) : null,
      replyTo: null,
      type: 'text',
    });

    setInputText('');
    setMediaError('');
    socket.emit(EVENTS.TYPING_STOP);
    inputRef.current?.focus();
  }

  function sendSticker(stickerId) {
    if (!socket || !isConnected) return;

    socket.emit(EVENTS.MESSAGE_SEND, {
      channel: activeChannel,
      type: 'sticker',
      stickerId,
    });

    setShowStickers(false);
  }

  function addEmoji(emoji) {
    const nextValue = `${inputText}${emoji}`;
    setInputText(nextValue);
    inputRef.current?.focus();

    if (socket) {
      socket.emit(nextValue.trim() ? EVENTS.TYPING_START : EVENTS.TYPING_STOP);
    }
  }

  function addChannel() {
    if (!socket || !newChannelName.trim()) return;

    socket.emit(EVENTS.CHANNEL_CREATE, { name: newChannelName.trim() });
    setNewChannelName('');
    setShowAddChannel(false);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${roomCode}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function leaveRoom() {
    if (!socket) return;

    socket.emit(EVENTS.ROOM_LEAVE);
    resetRoom();
  }

  function kickMember(socketId, nickname) {
    if (!socket) return;
    if (!window.confirm(`Remove ${nickname} from this room?`)) return;
    socket.emit(EVENTS.MEMBER_KICK, { socketId });
  }

  function transferHost(socketId, nickname) {
    if (!socket) return;
    if (!window.confirm(`Transfer host control to ${nickname}?`)) return;
    socket.emit(EVENTS.HOST_TRANSFER, { targetSocketId: socketId });
  }

  function updateRole(socketId, role) {
    if (!socket) return;
    socket.emit(EVENTS.MEMBER_ROLE_UPDATE, { socketId, role });
  }

  function deleteRoom() {
    if (!socket) return;
    if (!window.confirm('Delete this room now? This removes everyone immediately.')) return;
    socket.emit(EVENTS.ROOM_DELETE);
  }

  function canKickTarget(member) {
    if (!member || !you) return false;
    if (member.nickname === you.nickname) return false;
    if (you.role === MEMBER_ROLES.HOST) return member.role !== MEMBER_ROLES.HOST;
    if (you.role === MEMBER_ROLES.MODERATOR) return member.role === MEMBER_ROLES.MEMBER;
    return false;
  }

  function handleSelectSearchResult(result) {
    setActiveChannel(result.channel);
    setShowSearchResults(false);
    setSearchOpen(false);
  }

  const composerDisabled = !isConnected;
  return (
    <div style={styles.page}>
      <div style={styles.backdropGlowA} />
      <div style={styles.backdropGlowB} />

      <div style={styles.shell}>
        <HeaderBar
          roomCode={roomCode}
          you={you}
          memberCount={memberEntries.length}
          connectionState={connectionState}
          copied={copied}
          onCopyInvite={copyInvite}
          onLeave={leaveRoom}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          canManageRoom={canManageRoom}
          canModerate={canModerate}
          memberEntries={memberEntries}
          deleteRoom={deleteRoom}
          canKickTarget={canKickTarget}
          updateRole={updateRole}
          transferHost={transferHost}
          kickMember={kickMember}
        />

        <div style={{ ...styles.body, ...(isCompact ? styles.bodyCompact : null) }}>
          <Sidebar
            channels={channels}
            activeChannel={activeChannel}
            setActiveChannel={setActiveChannel}
            canModerate={canModerate}
            showAddChannel={showAddChannel}
            setShowAddChannel={setShowAddChannel}
            newChannelName={newChannelName}
            setNewChannelName={setNewChannelName}
            addChannel={addChannel}
            isNarrow={isNarrow}
          />

          <main style={styles.chatColumn}>
            {connectionState !== 'connected' && (
              <Banner tone="blue">
                {connectionState === 'reconnecting'
                  ? 'Reconnecting and restoring your room session...'
                  : 'Connecting to the room...'}
              </Banner>
            )}

            {hostWarning !== null && (
              <Banner tone="amber">
                Host disconnected. Room deletes in {hostWarning}s unless the host returns.
              </Banner>
            )}

            <div style={styles.chatPanelFrame}>
              <div style={styles.chatSurface}>
                <div style={styles.chatCard}>
                  <div style={styles.chatTopbar}>
                    <div>
                      <div style={styles.channelEyebrow}>ACTIVE CHANNEL</div>
                      <div style={styles.channelTitle}>#{activeChannel}</div>
                    </div>
                    <div style={styles.chatTopbarRight}>
                      <div style={styles.chatMetaRow}>
                        <div style={styles.chatMeta}>
                          <span style={styles.chatMetaText}>{activeMessages.length} messages</span>
                          <span style={styles.chatMetaDivider} />
                          <span style={styles.chatMetaText}>{memberEntries.length} online</span>
                        </div>

                        <button
                          style={{
                            ...styles.searchIconButton,
                            ...(searchOpen ? styles.searchIconButtonActive : null),
                          }}
                          onClick={() => {
                            const nextOpen = !searchOpen;
                            setSearchOpen(nextOpen);
                            if (!nextOpen) {
                              setShowSearchResults(false);
                            }
                          }}
                          aria-label="Search earlier chats"
                          title="Search earlier chats"
                        >
                          🔍
                        </button>
                      </div>

                      {searchOpen && (
                        <div style={styles.searchShell}>
                          <input
                            value={searchQuery}
                            onChange={(event) => {
                              const next = event.target.value;
                              setSearchQuery(next);
                              setShowSearchResults(next.trim().length >= 2);
                            }}
                            onFocus={() => {
                              if (searchQuery.trim().length >= 2) {
                                setShowSearchResults(true);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') {
                                setShowSearchResults(false);
                                setSearchOpen(false);
                              }

                              if (event.key === 'Enter' && searchResults.length > 0) {
                                handleSelectSearchResult(searchResults[0]);
                              }
                            }}
                            placeholder="Search earlier chats..."
                            style={styles.searchInput}
                          />
                          <button
                            style={styles.searchCloseButton}
                            onClick={() => {
                              setSearchQuery('');
                              setShowSearchResults(false);
                            }}
                            aria-label="Clear search"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {showSearchResults && normalizedSearch.length >= 2 && (
                    <div style={styles.searchResultsPanel}>
                      {searchResults.length === 0 && (
                        <div style={styles.searchEmpty}>No earlier chats found.</div>
                      )}

                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          style={styles.searchResultRow}
                          onClick={() => handleSelectSearchResult(result)}
                        >
                          <div style={styles.searchResultHeader}>
                            <span style={styles.searchResultChannel}>#{result.channel}</span>
                            <span style={styles.searchResultMeta}>
                              {result.nickname} · {formatTime(result.timestamp)}
                            </span>
                          </div>
                          <div style={styles.searchResultText}>{result.preview || result.type}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={styles.messageRail}>
                    {activeMessages.length === 0 && (
                      <div style={styles.emptyState}>
                        <div style={styles.emptyTitle}>No traffic yet.</div>
                        <div style={styles.emptyText}>
                          Start the channel with a message, sticker, or image drop.
                        </div>
                      </div>
                    )}

                    {activeMessages.map((message) => (
                      <MessageCard
                        key={message.id}
                        message={message}
                        isOwn={message.nickname === you?.nickname}
                        role={getRoleForMessage(message, members)}
                      />
                    ))}

                    {typingUsers.length > 0 && (
                      <div style={styles.typingRow}>
                        {typingUsers.join(', ')} typing...
                      </div>
                    )}

                    <div ref={endRef} />
                  </div>

                  <div style={styles.composerWrap}>
                    <div style={styles.composerCard}>
                      <div style={styles.composerShell}>
                        <div style={styles.composerToolbar}>
                          <div style={styles.toolCluster}>
                            <button
                              style={styles.toolButton}
                              onClick={() => {
                                setShowEmoji((current) => !current);
                                setShowStickers(false);
                              }}
                              disabled={composerDisabled}
                            >
                              Emoji
                            </button>
                            <button
                              style={styles.toolButton}
                              onClick={() => {
                                setShowStickers((current) => !current);
                                setShowEmoji(false);
                              }}
                              disabled={composerDisabled}
                            >
                              Sticker
                            </button>
                            <ImageUpload onError={setMediaError} />
                          </div>

                          <select
                            value={disappearAfter}
                            onChange={(event) => setDisappearAfter(event.target.value)}
                            style={styles.disappearSelect}
                            disabled={composerDisabled}
                          >
                            <option value="">Persist</option>
                            {DISAPPEAR_OPTIONS.map((option) => (
                              <option key={String(option.value)} value={option.value ?? ''}>
                                Burn {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={styles.inputRow}>
                          <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                sendMessage();
                              }
                            }}
                            placeholder={composerDisabled
                              ? 'Connection unstable...'
                              : `Message #${activeChannel}`}
                            style={styles.textarea}
                            disabled={composerDisabled}
                          />
                          <button
                            style={{
                              ...styles.sendButton,
                              ...(composerDisabled || !inputText.trim() ? styles.sendButtonDisabled : null),
                            }}
                            onClick={sendMessage}
                            disabled={composerDisabled || !inputText.trim()}
                          >
                            Send
                          </button>
                        </div>

                        {mediaError && <div style={styles.errorText}>{mediaError}</div>}

                        <div style={styles.popoverRow}>
                          {showEmoji && (
                            <EmojiPicker
                              onSelect={addEmoji}
                              onClose={() => setShowEmoji(false)}
                            />
                          )}

                          {showStickers && (
                            <StickerPicker
                              onSelect={sendSticker}
                              onClose={() => setShowStickers(false)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <VoicePanel />
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  channels,
  activeChannel,
  setActiveChannel,
  canModerate,
  showAddChannel,
  setShowAddChannel,
  newChannelName,
  setNewChannelName,
  addChannel,
  isNarrow,
}) {
  return (
    <aside style={{ ...styles.sidebar, ...(isNarrow ? styles.sidebarNarrow : null) }}>
      <div style={styles.sidebarSurface}>
        <div style={styles.sidebarPanel}>
          <div style={styles.sidebarMain}>
            <SectionTitle title="Channels" meta={`${channels.length} open`} />

            <div style={styles.channelList}>
              {channels.map((channel) => (
                <button
                  key={channel}
                  style={{
                    ...styles.channelButton,
                    ...(channel === activeChannel ? styles.channelButtonActive : null),
                  }}
                  onClick={() => setActiveChannel(channel)}
                >
                  <span style={styles.channelHash}>#</span>
                  <span>{channel}</span>
                </button>
              ))}
            </div>

            {canModerate && (
              <div style={styles.addChannelBlock}>
                {!showAddChannel ? (
                  <button style={styles.secondaryAction} onClick={() => setShowAddChannel(true)}>
                    Add channel
                  </button>
                ) : (
                  <div style={styles.addChannelForm}>
                    <input
                      value={newChannelName}
                      onChange={(event) => setNewChannelName(event.target.value)}
                      placeholder="channel-name"
                      style={styles.inlineInput}
                    />
                    <div style={styles.inlineActions}>
                      <button style={styles.secondaryAction} onClick={addChannel}>
                        Save
                      </button>
                      <button
                        style={styles.ghostAction}
                        onClick={() => {
                          setShowAddChannel(false);
                          setNewChannelName('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.sidebarFooter}>
            <VoiceChannel />
          </div>
        </div>
      </div>
    </aside>
  );
}

function MessageCard({ message, isOwn, role }) {
  const reactions = Object.entries(message.reactions || {});

  return (
    <div
      style={{
        ...styles.messageCard,
        ...(isOwn ? styles.messageCardOwn : null),
      }}
    >
      <div style={styles.messageHeader}>
        <div style={styles.messageAuthorRow}>
          <span style={{ ...styles.messageAuthor, color: message.color }}>
            {message.nickname}
          </span>
          <RoleBadge role={role} compact />
        </div>
        <span style={styles.messageTime}>{formatTime(message.timestamp)}</span>
      </div>

      {message.type === 'text' && <div style={styles.messageText}>{message.text}</div>}

      {message.type === 'sticker' && (
        <div style={styles.stickerMessage}>
          STICKER // {STICKER_LABELS[message.stickerId] || message.stickerId}
        </div>
      )}

      {message.type === 'image' && (
        <div style={styles.imageWrap}>
          <img
            src={`data:${message.mimeType};base64,${message.base64}`}
            alt={message.filename || 'upload'}
            style={styles.messageImage}
          />
          <div style={styles.imageCaption}>{message.filename || 'image upload'}</div>
        </div>
      )}

      {message.disappearAfter && (
        <div style={styles.expiryTag}>
          burns after {readableBurn(message.disappearAfter)}
        </div>
      )}

      {reactions.length > 0 && (
        <div style={styles.reactionRow}>
          {reactions.map(([emoji, names]) => (
            <div key={emoji} style={styles.reactionPill}>
              <span>{emoji}</span>
              <span>{names.length}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ControlStrip({
  member,
  socketId,
  canManageRoom,
  canKick,
  onPromoteModerator,
  onDemoteMember,
  onTransferHost,
  onKick,
}) {
  const isHost = member.role === MEMBER_ROLES.HOST;
  const isModerator = member.role === MEMBER_ROLES.MODERATOR;

  return (
    <div style={styles.controlStrip}>
      {canManageRoom && !isHost && !isModerator && (
        <button style={styles.ghostAction} onClick={onPromoteModerator}>
          Set mod
        </button>
      )}

      {canManageRoom && isModerator && (
        <button style={styles.ghostAction} onClick={onDemoteMember}>
          Set member
        </button>
      )}

      {canManageRoom && !isHost && (
        <button style={styles.secondaryAction} onClick={onTransferHost}>
          Make host
        </button>
      )}

      {canKick && (
        <button
          style={styles.dangerActionSmall}
          onClick={onKick}
          data-socket-id={socketId}
        >
          Kick
        </button>
      )}
    </div>
  );
}

function HeaderBar({
  roomCode,
  you,
  memberCount,
  connectionState,
  copied,
  onCopyInvite,
  onLeave,
  settingsOpen,
  setSettingsOpen,
  canManageRoom,
  canModerate,
  memberEntries,
  deleteRoom,
  canKickTarget,
  updateRole,
  transferHost,
  kickMember,
}) {
  const isOnline = connectionState === 'connected';
  
  return (
    <div style={styles.headerShell}>
      <header style={styles.header}>
        <div style={styles.headerTitleSection}>
          <div style={styles.headerMainTitle}>{roomCode}</div>
          <div style={styles.headerSubtitle}>
            {memberCount} member{memberCount !== 1 ? 's' : ''} online
          </div>
        </div>

        <div style={styles.headerIcons}>
          <button 
            style={{
              ...styles.headerIconButton,
              ...(settingsOpen ? styles.headerIconButtonActive : null),
            }} 
            onClick={() => setSettingsOpen(!settingsOpen)}
            title="Room controls"
          >
            <span style={styles.headerIcon}>⋮</span>
          </button>
        </div>
      </header>
      
      {settingsOpen && (
        <div style={styles.headerDropdown}>
          <BorderGlow
            glowColor="150 95 70"
            backgroundColor="rgba(8, 12, 18, 0.95)"
            borderRadius={16}
            glowRadius={14}
            glowIntensity={0.66}
            colors={['#00ff41', '#7ef5cf', '#58a6ff']}
            fillOpacity={0.1}
          >
            <div style={styles.headerDropdownContent}>
              {/* Quick Actions */}
              <div style={styles.dropdownActions}>
                <button style={styles.secondaryAction} onClick={onCopyInvite}>
                  {copied ? '✓ Invite copied' : 'Copy invite'}
                </button>
              </div>

              {/* Members Section */}
              <div style={styles.dropdownSection}>
                <div style={styles.dropdownLabel}>Members ({memberEntries.length})</div>
                <div style={styles.dropdownMemberList}>
                  {memberEntries.map(([socketId, member]) => (
                    <div key={socketId} style={styles.memberCardCompact}>
                      <div style={styles.memberCompactInfo}>
                        <span style={{ ...styles.dropdownMemberDot, background: member.color }} />
                        <div style={styles.memberCompactText}>
                          <div style={styles.memberCompactName}>
                            {member.nickname}
                            {member.nickname === you?.nickname && (
                              <span style={styles.youTag}>YOU</span>
                            )}
                          </div>
                          <RoleBadge role={member.role} compact />
                        </div>
                      </div>
                      {canModerate && (
                        <div style={styles.memberCompactActions}>
                          {canManageRoom && member.nickname !== you?.nickname && (
                            <>
                              <button 
                                style={styles.ghostActionSmall} 
                                onClick={() => updateRole(socketId, member.role === MEMBER_ROLES.MODERATOR ? MEMBER_ROLES.MEMBER : MEMBER_ROLES.MODERATOR)}
                              >
                                {member.role === MEMBER_ROLES.MODERATOR ? 'Unmod' : 'Mod'}
                              </button>
                              {member.role !== MEMBER_ROLES.HOST && (
                                <button 
                                  style={styles.ghostActionSmall}
                                  onClick={() => transferHost(socketId, member.nickname)}
                                >
                                  Make host
                                </button>
                              )}
                            </>
                          )}
                          {canKickTarget(member) && (
                            <button 
                              style={styles.dangerActionSmall} 
                              onClick={() => kickMember(socketId, member.nickname)}
                            >
                              Kick
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Host Controls */}
              {canManageRoom && (
                <div style={{...styles.dropdownSection, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem'}}>
                  <div style={styles.dropdownLabel}>Host Controls</div>
                  <button style={styles.dangerAction} onClick={deleteRoom}>
                    Delete room
                  </button>
                </div>
              )}
              
              {/* Leave Button */}
              <button style={styles.ghostAction} onClick={onLeave}>
                Leave room
              </button>
            </div>
          </BorderGlow>
        </div>
      )}
    </div>
  );
}

function Banner({ children, tone }) {
  const toneStyles = tone === 'amber' ? styles.bannerAmber : styles.bannerBlue;
  return <div style={{ ...styles.banner, ...toneStyles }}>{children}</div>;
}

function SectionTitle({ title, meta }) {
  return (
    <div style={styles.sectionTitle}>
      <span style={styles.sectionTitleText}>{title}</span>
      <span style={styles.sectionMeta}>{meta}</span>
    </div>
  );
}

function RoleBadge({ role, compact = false }) {
  const visual = getRoleVisual(role);

  return (
    <span
      style={{
        ...styles.roleBadge,
        ...(compact ? styles.roleBadgeCompact : null),
        background: visual.background,
        borderColor: visual.border,
        color: visual.text,
      }}
    >
      {ROLE_LABELS[role] || ROLE_LABELS[MEMBER_ROLES.MEMBER]}
    </span>
  );
}

function getRoleForMessage(message, members) {
  const match = Object.values(members).find((member) => member.nickname === message.nickname);
  return match?.role || MEMBER_ROLES.MEMBER;
}

function getRoleVisual(role) {
  if (role === MEMBER_ROLES.HOST) {
    return {
      background: 'rgba(0,255,65,0.13)',
      border: 'rgba(0,255,65,0.3)',
      text: '#7ef5cf',
    };
  }

  if (role === MEMBER_ROLES.MODERATOR) {
    return {
      background: 'rgba(88,166,255,0.14)',
      border: 'rgba(88,166,255,0.34)',
      text: '#a7cbff',
    };
  }

  return {
    background: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
    text: '#9eb0bc',
  };
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function readableBurn(value) {
  const option = DISAPPEAR_OPTIONS.find((entry) => entry.value === value);
  return option ? option.label : `${Math.round(value / 1000)}s`;
}

const styles = {
  page: {
    position: 'relative',
    height: '100vh',
    background: 'linear-gradient(180deg, #02060a 0%, #06111b 100%)',
    overflow: 'hidden',
  },
  backdropGlowA: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '40rem',
    height: '40rem',
    background: 'radial-gradient(circle, rgba(0,255,65,0.14) 0%, rgba(0,255,65,0) 70%)',
    pointerEvents: 'none',
  },
  backdropGlowB: {
    position: 'absolute',
    right: '-14%',
    bottom: '-18%',
    width: '46rem',
    height: '46rem',
    background: 'radial-gradient(circle, rgba(88,166,255,0.18) 0%, rgba(88,166,255,0) 72%)',
    pointerEvents: 'none',
  },
  shell: {
    position: 'relative',
    zIndex: 1,
    height: '100vh',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    gap: '0.7rem',
    padding: '0.8rem 1rem',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.9rem',
    padding: '0.75rem 1.1rem',
    flexWrap: 'nowrap',
    flexShrink: 0,
    alignItems: 'center',
  },
  headerShell: {
    borderRadius: '1.4rem',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.98) 0%, rgba(8, 12, 18, 0.94) 100%)',
    boxShadow: '0 14px 34px rgba(0,0,0,0.3)',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'nowrap',
    alignItems: 'center',
    flex: 1,
  },
  roomCodeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  headerLabel: {
    color: '#7a8f9e',
    fontSize: '0.78rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  roomCode: {
    color: '#effff7',
    fontSize: '1.65rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
  },
  headerIdentity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  headerIdentityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    flexWrap: 'nowrap',
  },
  headerDot: {
    width: '0.8rem',
    height: '0.8rem',
    borderRadius: '50%',
    boxShadow: '0 0 20px currentColor',
    flexShrink: 0,
  },
  headerName: {
    color: '#e6f0f5',
    fontWeight: 700,
    fontSize: '1.1rem',
  },
  headerRight: {
    display: 'flex',
    gap: '1.8rem',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statusCluster: {
    display: 'flex',
    gap: '0.8rem',
    flexWrap: 'nowrap',
  },
  statusPill: {
    padding: '0.6rem 1rem',
    borderRadius: '999px',
    border: '1px solid rgba(88,166,255,0.32)',
    background: 'rgba(88,166,255,0.14)',
    color: '#c0dcff',
    fontSize: '0.8rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  memberCountPill: {
    padding: '0.6rem 1rem',
    borderRadius: '999px',
    border: '1px solid rgba(0,255,65,0.24)',
    background: 'rgba(0,255,65,0.1)',
    color: '#9effc4',
    fontSize: '0.8rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  headerActions: {
    display: 'flex',
    gap: '0.8rem',
    flexWrap: 'nowrap',
  },
  headerTitleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.18rem',
    flex: 1,
  },
  headerMainTitle: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#f0fffe',
    letterSpacing: '0.02em',
  },
  headerSubtitle: {
    fontSize: '0.72rem',
    color: '#8fa5b0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  onlineIndicator: {
    color: '#00ff41',
    fontSize: '1rem',
    lineHeight: '0.8',
  },
  offlineIndicator: {
    color: '#8fa5b0',
    fontSize: '1rem',
    lineHeight: '0.8',
  },
  headerIcons: {
    display: 'flex',
    gap: '0.35rem',
    alignItems: 'center',
  },
  headerIconButton: {
    width: '1.8rem',
    height: '1.8rem',
    borderRadius: '50%',
    border: '1px solid rgba(88,166,255,0.18)',
    background: 'rgba(88,166,255,0.08)',
    color: '#b4d0ff',
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  headerIconButtonActive: {
    borderColor: 'rgba(0,255,65,0.24)',
    background: 'rgba(0,255,65,0.12)',
    color: '#7ef5cf',
  },
  headerDropdown: {
    position: 'absolute',
    top: '100%',
    right: '0.8rem',
    marginTop: '0.8rem',
    zIndex: 20,
    width: 'min(34rem, calc(100vw - 2.4rem))',
    maxHeight: '78vh',
    overflowY: 'auto',
  },
  headerDropdownContent: {
    padding: '1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  dropdownSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    paddingBottom: '0.9rem',
  },
  dropdownLabel: {
    color: '#8fa5b0',
    fontSize: '0.72rem',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  dropdownMemberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  dropdownMember: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.6rem',
    borderRadius: '0.7rem',
    background: 'rgba(255,255,255,0.03)',
    color: '#dce6ec',
    fontSize: '0.85rem',
  },
  memberDot: {
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '50%',
    flexShrink: 0,
  },
  dropdownMore: {
    color: '#8fa5b0',
    fontSize: '0.8rem',
    padding: '0.4rem 0.6rem',
  },
  dropdownActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  },
  dropdownMemberDot: {
    width: '0.6rem',
    height: '0.6rem',
    borderRadius: '50%',
    flexShrink: 0,
    boxShadow: '0 0 10px currentColor',
  },
  memberCardCompact: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '0.78rem 0.82rem',
    borderRadius: '0.85rem',
    background: 'rgba(255,255,255,0.035)',
    gap: '0.75rem',
  },
  memberCompactInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    flex: 1,
    minWidth: 0,
  },
  memberCompactText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    minWidth: 0,
  },
  memberCompactName: {
    color: '#dce6ec',
    fontSize: '0.92rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  memberCompactActions: {
    display: 'flex',
    gap: '0.48rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '13rem',
  },
  ghostActionSmall: {
    padding: '0.42rem 0.68rem',
    borderRadius: '0.6rem',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#b5c8d4',
    fontFamily: 'inherit',
    fontSize: '0.72rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '300px minmax(0, 1fr)',
    gap: '1.2rem',
    minHeight: 0,
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  bodyCompact: {
    gridTemplateColumns: '1fr',
    gridTemplateRows: '220px minmax(0, 1fr)',
  },
  sidebar: {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebarNarrow: {
    order: 2,
  },
  sidebarPanel: {
    height: '100%',
    minHeight: 0,
    padding: '1.2rem',
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr) auto',
    gap: '1.2rem',
  },
  sidebarMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
    minHeight: 0,
  },
  sidebarSurface: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '1.75rem',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'linear-gradient(180deg, rgba(7, 11, 17, 0.97) 0%, rgba(5, 9, 14, 0.96) 100%)',
    boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  sidebarFooter: {
    marginTop: 'auto',
  },
  chatColumn: {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.95rem',
    overflow: 'hidden',
  },
  chatPanelFrame: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    overflow: 'hidden',
  },
  chatSurface: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '1.75rem',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.99) 0%, rgba(6, 10, 15, 0.97) 100%)',
    boxShadow: '0 24px 56px rgba(0,0,0,0.32)',
    overflow: 'hidden',
  },
  sideColumn: {
    minWidth: 0,
  },
  sideColumnCompact: {
    order: 3,
  },
  banner: {
    padding: '0.85rem 1rem',
    borderRadius: '1rem',
    border: '1px solid transparent',
    fontSize: '0.88rem',
    lineHeight: 1.5,
  },
  bannerBlue: {
    background: 'rgba(88,166,255,0.11)',
    borderColor: 'rgba(88,166,255,0.2)',
    color: '#b3d2ff',
  },
  bannerAmber: {
    background: 'rgba(255,209,102,0.10)',
    borderColor: 'rgba(255,209,102,0.22)',
    color: '#ffe9ab',
  },
  chatCard: {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    height: '100%',
    minHeight: 0,
  },
  chatTopbar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.9rem',
    flexWrap: 'wrap',
    padding: '0.7rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  chatTopbarRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.35rem',
    minWidth: '14rem',
  },
  chatMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
  },
  channelEyebrow: {
    color: '#778a98',
    fontSize: '0.76rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  channelTitle: {
    marginTop: '0.35rem',
    color: '#f0fffe',
    fontSize: '1.55rem',
    fontWeight: 800,
  },
  chatMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  chatMetaText: {
    color: '#8da0ac',
    fontSize: '0.8rem',
  },
  chatMetaDivider: {
    width: '0.3rem',
    height: '0.3rem',
    borderRadius: '50%',
    background: '#2f3f4a',
  },
  searchShell: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: 'min(22rem, 100%)',
  },
  searchIconButton: {
    width: '1.9rem',
    height: '1.9rem',
    borderRadius: '0.65rem',
    border: '1px solid rgba(88,166,255,0.2)',
    background: 'rgba(88,166,255,0.08)',
    color: '#b4d0ff',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconButtonActive: {
    borderColor: 'rgba(0,255,65,0.24)',
    background: 'rgba(0,255,65,0.1)',
    color: '#8cf7bf',
  },
  searchInput: {
    flex: 1,
    height: '1.95rem',
    borderRadius: '0.8rem',
    border: '1px solid rgba(88,166,255,0.22)',
    background: 'rgba(9,16,24,0.95)',
    color: '#dce7ee',
    fontFamily: 'inherit',
    fontSize: '0.76rem',
    padding: '0 0.75rem',
    outline: 'none',
  },
  searchCloseButton: {
    height: '1.95rem',
    padding: '0 0.7rem',
    borderRadius: '0.75rem',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#b9c8d1',
    fontFamily: 'inherit',
    fontSize: '0.7rem',
    cursor: 'pointer',
  },
  searchResultsPanel: {
    margin: '0.5rem 1rem 0',
    maxHeight: '13.5rem',
    overflowY: 'auto',
    borderRadius: '1rem',
    border: '1px solid rgba(88,166,255,0.2)',
    background: 'rgba(6, 11, 17, 0.97)',
    boxShadow: '0 16px 32px rgba(0,0,0,0.28)',
    padding: '0.45rem',
  },
  searchEmpty: {
    padding: '0.75rem 0.8rem',
    color: '#8da0ac',
    fontSize: '0.82rem',
  },
  searchResultRow: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0.3rem',
    padding: '0.62rem 0.7rem',
    borderRadius: '0.7rem',
    border: '1px solid transparent',
    background: 'rgba(255,255,255,0.02)',
    color: '#dce7ee',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '0.35rem',
    fontFamily: 'inherit',
  },
  searchResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.6rem',
  },
  searchResultChannel: {
    color: '#7ef5cf',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  searchResultMeta: {
    color: '#88a0ad',
    fontSize: '0.72rem',
  },
  searchResultText: {
    color: '#d2e0e8',
    fontSize: '0.82rem',
    lineHeight: 1.45,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  messageRail: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '1.2rem 1.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  emptyState: {
    margin: 'auto',
    width: '100%',
    maxWidth: '28rem',
    padding: '2rem',
    borderRadius: '1.2rem',
    border: '1px dashed rgba(126,245,207,0.16)',
    background: 'rgba(6,10,15,0.66)',
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#effff7',
    fontSize: '1rem',
    fontWeight: 700,
  },
  emptyText: {
    marginTop: '0.5rem',
    color: '#7f919d',
    lineHeight: 1.6,
  },
  messageCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.95rem 1rem',
    borderRadius: '1.1rem',
    background: 'rgba(9,14,20,0.92)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  },
  messageCardOwn: {
    borderColor: 'rgba(0,255,65,0.14)',
    background: 'linear-gradient(135deg, rgba(0,255,65,0.07) 0%, rgba(9,14,20,0.96) 40%)',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.8rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  messageAuthorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  messageAuthor: {
    fontSize: '0.94rem',
    fontWeight: 700,
  },
  messageTime: {
    color: '#6e828d',
    fontSize: '0.75rem',
  },
  messageText: {
    color: '#e8eef2',
    lineHeight: 1.75,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  stickerMessage: {
    padding: '0.9rem 1rem',
    borderRadius: '0.95rem',
    background: 'rgba(88,166,255,0.10)',
    border: '1px solid rgba(88,166,255,0.18)',
    color: '#c6deff',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  imageWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  messageImage: {
    width: '100%',
    maxWidth: '28rem',
    borderRadius: '1rem',
    border: '1px solid rgba(255,255,255,0.08)',
    objectFit: 'cover',
  },
  imageCaption: {
    color: '#8092a0',
    fontSize: '0.76rem',
  },
  expiryTag: {
    alignSelf: 'flex-start',
    padding: '0.35rem 0.55rem',
    borderRadius: '999px',
    background: 'rgba(255,209,102,0.10)',
    border: '1px solid rgba(255,209,102,0.18)',
    color: '#ffd166',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  reactionRow: {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },
  reactionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.55rem',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#d9e3ea',
    fontSize: '0.78rem',
  },
  typingRow: {
    color: '#89a0ad',
    fontSize: '0.82rem',
    padding: '0.2rem 0.2rem 0.6rem',
  },
  composerWrap: {
    padding: '1rem 1.4rem 1.2rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  composerShell: {
    position: 'relative',
    padding: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  composerCard: {
    borderRadius: '1.4rem',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(5, 10, 16, 0.96)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  composerToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.85rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  toolCluster: {
    display: 'flex',
    gap: '0.55rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toolButton: {
    padding: '0.48rem 0.7rem',
    borderRadius: '0.8rem',
    border: '1px solid rgba(88,166,255,0.18)',
    background: 'rgba(88,166,255,0.09)',
    color: '#c4ddff',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  disappearSelect: {
    minWidth: '9rem',
    height: '2.55rem',
    padding: '0 0.7rem',
    borderRadius: '0.8rem',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#09111a',
    color: '#dce7ee',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
  },
  inputRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 9rem',
    gap: '0.8rem',
    alignItems: 'stretch',
  },
  textarea: {
    minHeight: '4.3rem',
    maxHeight: '8.5rem',
    resize: 'none',
    borderRadius: '1rem',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(4,8,13,0.96)',
    color: '#f1f7fb',
    padding: '0.9rem 1rem',
    fontFamily: 'inherit',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    outline: 'none',
  },
  sendButton: {
    width: '100%',
    minHeight: '4.3rem',
    padding: '0.9rem 1rem',
    borderRadius: '1rem',
    border: '1px solid rgba(0,255,65,0.18)',
    background: 'linear-gradient(135deg, rgba(0,255,65,0.20) 0%, rgba(88,166,255,0.14) 100%)',
    color: '#edfff4',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: '0.88rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorText: {
    color: '#ff9b9b',
    fontSize: '0.82rem',
  },
  popoverRow: {
    position: 'relative',
    minHeight: 0,
  },
  popupDock: {
    position: 'fixed',
    left: '1rem',
    bottom: '1rem',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.75rem',
    maxWidth: 'min(24rem, calc(100vw - 2rem))',
  },
  popupDockNarrow: {
    left: '0.8rem',
    right: '0.8rem',
    bottom: '0.8rem',
    maxWidth: 'none',
  },
  popupPanel: {
    width: '24rem',
    maxHeight: 'min(70vh, 42rem)',
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  popupPanelNarrow: {
    width: '100%',
    maxHeight: '62vh',
  },
  popupHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  popupEyebrow: {
    color: '#6f8795',
    fontSize: '0.72rem',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  popupTitle: {
    marginTop: '0.3rem',
    color: '#effff7',
    fontSize: '1.2rem',
    fontWeight: 740,
    letterSpacing: '0.08em',
  },
  popupTopActions: {
    display: 'flex',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  popupHint: {
    color: '#85a0ad',
    fontSize: '0.82rem',
    lineHeight: 1.6,
  },
  popupSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  popupMemberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  popupTrigger: {
    minWidth: '11rem',
    padding: '0.8rem 0.95rem',
    borderRadius: '1rem',
    border: '1px solid rgba(88,166,255,0.18)',
    background: 'linear-gradient(135deg, rgba(8,14,20,0.95) 0%, rgba(13,22,32,0.94) 100%)',
    color: '#effff7',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.2rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
  },
  popupTriggerActive: {
    borderColor: 'rgba(0,255,65,0.24)',
    background: 'linear-gradient(135deg, rgba(0,255,65,0.14) 0%, rgba(13,22,32,0.96) 100%)',
  },
  popupTriggerLabel: {
    fontSize: '0.88rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  popupTriggerMeta: {
    color: '#8ea5b1',
    fontSize: '0.74rem',
  },
  membersPanel: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  sectionTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sectionTitleText: {
    color: '#ddebeb',
    fontSize: '0.9rem',
    fontWeight: 720,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  sectionMeta: {
    color: '#6f8795',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  },
  memberCard: {
    padding: '0.8rem',
    borderRadius: '1rem',
    background: 'rgba(7,11,16,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  memberIdentity: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
  memberDot: {
    width: '0.7rem',
    height: '0.7rem',
    borderRadius: '50%',
    marginTop: '0.38rem',
    flexShrink: 0,
  },
  memberTextBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    minWidth: 0,
  },
  memberNameRow: {
    display: 'flex',
    gap: '0.45rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  memberName: {
    color: '#effff7',
    fontWeight: 650,
    wordBreak: 'break-word',
  },
  youTag: {
    padding: '0.2rem 0.4rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    color: '#9cb0bc',
    fontSize: '0.68rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: '0.32rem 0.58rem',
    borderRadius: '999px',
    border: '1px solid transparent',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  roleBadgeCompact: {
    padding: '0.22rem 0.45rem',
    fontSize: '0.64rem',
  },
  controlStrip: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  lifecycleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  lifecycleGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  lifecycleHint: {
    color: '#7d909c',
    fontSize: '0.8rem',
    lineHeight: 1.6,
  },
  channelList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  channelButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    width: '100%',
    padding: '0.88rem 1rem',
    borderRadius: '0.95rem',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(7,11,16,0.78)',
    color: '#b5c8d4',
    fontFamily: 'inherit',
    fontSize: '0.92rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  channelButtonActive: {
    color: '#effff7',
    borderColor: 'rgba(0,255,65,0.18)',
    background: 'linear-gradient(135deg, rgba(0,255,65,0.10) 0%, rgba(88,166,255,0.10) 100%)',
  },
  channelHash: {
    color: '#7ef5cf',
  },
  addChannelBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  },
  addChannelForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  inlineInput: {
    width: '100%',
    padding: '0.75rem 0.85rem',
    borderRadius: '0.9rem',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#081019',
    color: '#effff7',
    fontFamily: 'inherit',
    fontSize: '0.84rem',
    outline: 'none',
  },
  inlineActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  secondaryAction: {
    padding: '0.58rem 0.82rem',
    borderRadius: '0.85rem',
    border: '1px solid rgba(88,166,255,0.22)',
    background: 'rgba(88,166,255,0.10)',
    color: '#c6deff',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  ghostAction: {
    padding: '0.58rem 0.82rem',
    borderRadius: '0.85rem',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#cad7de',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  dangerAction: {
    padding: '0.62rem 0.86rem',
    borderRadius: '0.85rem',
    border: '1px solid rgba(255,107,107,0.28)',
    background: 'rgba(255,107,107,0.12)',
    color: '#ffb0b0',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
  dangerActionSmall: {
    padding: '0.58rem 0.78rem',
    borderRadius: '0.85rem',
    border: '1px solid rgba(255,107,107,0.24)',
    background: 'rgba(255,107,107,0.10)',
    color: '#ffadad',
    fontFamily: 'inherit',
    fontSize: '0.76rem',
    cursor: 'pointer',
  },
};
