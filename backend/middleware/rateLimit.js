/**
 * In-memory sliding-window rate limiter.
 * No external dependencies — suitable for single-instance deployments.
 * For multi-instance deployments, swap this for a Redis-backed implementation.
 */

class RateLimiter {
  /**
   * @param {number} maxRequests  Maximum requests allowed in the window.
   * @param {number} windowMs    Window size in milliseconds.
   */
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    /** @type {Map<string, number[]>} */
    this.clients = new Map();

    // Cleanup expired entries every 60 seconds to avoid memory leaks
    this.cleanupInterval = setInterval(() => this._cleanup(), 60_000);
    this.cleanupInterval.unref?.(); // Don't keep the process alive
  }

  /**
   * Check whether a key (e.g. IP) is rate-limited.
   * @param {string} key
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
   */
  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.clients.get(key) || [];
    // Drop entries outside the current window
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const retryAfterMs = timestamps[0] + this.windowMs - now;
      this.clients.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    timestamps.push(now);
    this.clients.set(key, timestamps);
    return { allowed: true, remaining: this.maxRequests - timestamps.length, retryAfterMs: 0 };
  }

  /** Remove all stale entries. */
  _cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.clients) {
      const active = timestamps.filter(t => t > windowStart);
      if (active.length === 0) this.clients.delete(key);
      else this.clients.set(key, active);
    }
  }

  /** Tear down the cleanup timer (for testing). */
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// ── Pre-built limiters ──

/** Auth endpoints: 10 attempts per 15 minutes per IP */
const authLimiter = new RateLimiter(10, 15 * 60 * 1000);

/** General API: 100 requests per minute per IP */
const apiLimiter = new RateLimiter(100, 60 * 1000);

/**
 * Express middleware factory.
 * @param {RateLimiter} limiter
 */
function rateLimitMiddleware(limiter) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const result = limiter.check(key);

    res.set('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    next();
  };
}

module.exports = {
  RateLimiter,
  authLimiter,
  apiLimiter,
  rateLimitMiddleware,
};
