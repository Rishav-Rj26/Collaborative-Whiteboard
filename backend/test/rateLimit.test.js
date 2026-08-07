const test = require('node:test');
const assert = require('node:assert/strict');
const { RateLimiter } = require('../middleware/rateLimit');

test('RateLimiter allows requests up to max', (t) => {
  const limiter = new RateLimiter(3, 10000);
  const ip = '127.0.0.1';

  let res = limiter.check(ip);
  assert.equal(res.allowed, true);
  assert.equal(res.remaining, 2);

  res = limiter.check(ip);
  assert.equal(res.allowed, true);
  assert.equal(res.remaining, 1);

  res = limiter.check(ip);
  assert.equal(res.allowed, true);
  assert.equal(res.remaining, 0);

  // Fourth should fail
  res = limiter.check(ip);
  assert.equal(res.allowed, false);
  assert.equal(res.remaining, 0);
  assert.ok(res.retryAfterMs > 0);

  limiter.destroy();
});
