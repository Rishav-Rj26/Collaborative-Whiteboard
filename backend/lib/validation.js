const MAX_CHAT_LENGTH = 2_000;
const MAX_TITLE_LENGTH = 255;
const MAX_ELEMENT_POINTS = 50_000; // Safety cap for freehand paths
const MAX_ELEMENT_JSON_SIZE = 512_000; // ~500 KB per element

const isNonEmptyString = (value, maxLength = MAX_TITLE_LENGTH) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

const validChatMessage = (value) => isNonEmptyString(value, MAX_CHAT_LENGTH);

/**
 * Validates an email address using a pragmatic regex.
 * Covers 99%+ of real-world email formats.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const validEmail = (value) =>
  typeof value === 'string' && value.length <= 255 && EMAIL_REGEX.test(value);

/**
 * Strip HTML/script tags from a string to prevent stored XSS.
 * Preserves the text content.
 */
const sanitizeString = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim();
};

/**
 * Validate an element payload received over a socket.
 * Ensures the element has the minimum required fields and respects size limits.
 */
const validElementPayload = (element) => {
  if (!element || typeof element !== 'object') return false;
  if (typeof element.id !== 'string' || element.id.length > 100) return false;
  if (typeof element.tool !== 'string') return false;

  // Check points array size
  if (Array.isArray(element.points) && element.points.length > MAX_ELEMENT_POINTS) return false;

  // Check total JSON size
  const jsonSize = JSON.stringify(element).length;
  if (jsonSize > MAX_ELEMENT_JSON_SIZE) return false;

  return true;
};

module.exports = {
  MAX_CHAT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_ELEMENT_POINTS,
  MAX_ELEMENT_JSON_SIZE,
  isNonEmptyString,
  validChatMessage,
  validEmail,
  sanitizeString,
  validElementPayload,
};
