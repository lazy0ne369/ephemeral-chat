import { randomBytes } from 'node:crypto';

export function nanoid(size = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(size);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}
