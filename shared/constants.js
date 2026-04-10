// Shared between client and server
export const EVENTS = {
  // Client -> Server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_RESUME: 'room:resume',
  ROOM_DELETE: 'room:delete',
  ROOM_LEAVE: 'room:leave',
  MESSAGE_SEND: 'message:send',
  MESSAGE_REACT: 'message:react',
  MEDIA_UPLOAD: 'media:upload',
  CHANNEL_CREATE: 'channel:create',
  MEMBER_KICK: 'member:kick',
  MEMBER_ROLE_UPDATE: 'member:roleUpdate',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Server -> Client
  ROOM_JOINED: 'room:joined',
  ROOM_DELETED: 'room:deleted',
  ROOM_KICKED: 'room:kicked',
  ROOM_HOST_WARNING: 'room:hostWarning',
  ROOM_HOST_BACK: 'room:hostBack',
  ROOM_RESUME_FAILED: 'room:resumeFailed',
  ROOM_STATS_UPDATED: 'room:statsUpdated',
  ROOM_MEMBERS_UPDATED: 'room:membersUpdated',
  ROOM_ERROR: 'room:error',
  MESSAGE_NEW: 'message:new',
  MESSAGE_EXPIRED: 'message:expired',
  MESSAGE_REACTION_UPDATED: 'message:reactionUpdated',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  MEMBER_ROLE_UPDATED: 'member:roleUpdated',
  CHANNEL_ADDED: 'channel:added',
  TYPING_UPDATE: 'typing:update',
  MEDIA_TOO_LARGE: 'media:tooLarge',

  HOST_TRANSFER: 'host:transfer',
  HOST_TRANSFERRED: 'host:transferred',
  ROOM_PASSWORD_REQUIRED: 'room:passwordRequired',
};

export const LIMITS = {
  MAX_MESSAGES_PER_CHANNEL: 500,
  MAX_MEDIA_MB: 50,
  MAX_MEMBERS: 50,
  MAX_CHANNELS: 20,
  GRACE_PERIOD_MS: 60000,
  NICKNAME_MAX_LENGTH: 20,
  CHANNEL_NAME_MAX_LENGTH: 32,
  MESSAGE_TEXT_MAX_LENGTH: 4000,
  PASSWORD_MAX_LENGTH: 128,
  // Maximum message events a socket may emit per second before being silently dropped
  RATE_LIMIT_MESSAGES_PER_SECOND: 5,
};

// Allowed image MIME types for media uploads
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]);

export const DISAPPEAR_OPTIONS = [
  { label: '10s', value: 10000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
  { label: '1hr', value: 3600000 },
  { label: 'never', value: null },
];

export const MEMBER_COLORS = [
  '#00FF41', '#58A6FF', '#FF6B6B', '#FFE66D',
  '#4ECDC4', '#FF8CC8', '#C084FC', '#FB923C',
  '#34D399', '#F87171', '#A78BFA', '#FBBF24',
];

export const MEMBER_ROLES = {
  HOST: 'host',
  MODERATOR: 'moderator',
  MEMBER: 'member',
};
