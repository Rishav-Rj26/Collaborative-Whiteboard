const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_CHAT_LENGTH, isNonEmptyString, validChatMessage } = require('../lib/validation');
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
