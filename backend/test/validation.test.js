const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_CHAT_LENGTH, isNonEmptyString, validChatMessage, validEmail, sanitizeString } = require('../lib/validation');
const { canEdit, VALID_ROLES } = require('../lib/boardAccess');

test('validates bounded, non-empty user input', () => {
  assert.equal(isNonEmptyString(' Board '), true);
  assert.equal(isNonEmptyString('   '), false);
  assert.equal(isNonEmptyString('x'.repeat(256)), false);
  assert.equal(validChatMessage('x'.repeat(MAX_CHAT_LENGTH)), true);
  assert.equal(validChatMessage('x'.repeat(MAX_CHAT_LENGTH + 1)), false);
});

test('only owners and editors can modify boards', () => {
  assert.equal(canEdit('owner'), true);
  assert.equal(canEdit('editor'), true);
  assert.equal(canEdit('viewer'), false);
  assert.deepEqual([...VALID_ROLES].sort(), ['editor', 'owner', 'viewer']);
});

test('validates emails correctly', () => {
  assert.equal(validEmail('user@example.com'), true);
  assert.equal(validEmail('user.name+tag@example.co.uk'), true);
  assert.equal(validEmail('invalid-email'), false);
  assert.equal(validEmail('user@'), false);
  assert.equal(validEmail('@example.com'), false);
  assert.equal(validEmail(null), false);
});

test('sanitizes strings properly', () => {
  assert.equal(sanitizeString('Hello <script>alert(1)</script> World'), 'Hello alert(1) World');
  assert.equal(sanitizeString('<b>Bold</b>'), 'Bold');
  assert.equal(sanitizeString(null), '');
  assert.equal(sanitizeString(123), '');
});
