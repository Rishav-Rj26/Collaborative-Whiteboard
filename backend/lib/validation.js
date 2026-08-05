const MAX_CHAT_LENGTH = 2_000;
const MAX_TITLE_LENGTH = 255;

const isNonEmptyString = (value, maxLength = MAX_TITLE_LENGTH) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

const validChatMessage = (value) => isNonEmptyString(value, MAX_CHAT_LENGTH);

module.exports = { MAX_CHAT_LENGTH, MAX_TITLE_LENGTH, isNonEmptyString, validChatMessage };
