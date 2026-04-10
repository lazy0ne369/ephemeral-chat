/**
 * Simple token-bucket rate limiter keyed by socket ID.
 * Each socket starts with `capacity` tokens, refilled at `refillRate`
 * tokens per second. Returns true when the call is allowed and
 * false when the socket is over limit.
 */
export function createRateLimiter({ capacity, refillRate }) {
  // Map<socketId, { tokens: number, lastRefill: number }>
  const buckets = new Map();

  function consume(socketId) {
    const now = Date.now();
    let bucket = buckets.get(socketId);

    if (!bucket) {
      bucket = { tokens: capacity - 1, lastRefill: now };
      buckets.set(socketId, bucket);
      return true;
    }

    // Refill proportional to elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }

  function remove(socketId) {
    buckets.delete(socketId);
  }

  return { consume, remove };
}
