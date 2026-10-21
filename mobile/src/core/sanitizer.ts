/**
 * Client-Side Input Sanitizer
 * ===========================
 * Hardens user inputs before transmitting to backend APIs or knowledge graph queries.
 * Prevents Cypher/SQL injection patterns, script injection, control character
 * corruption, and buffer overflow vectors.
 */

/**
 * Sanitizes a search query string.
 * Strips HTML tags, Cypher/SQL comment/chaining delimiters (; -- /* *\/),
 * and ASCII control characters. Enforces maximum length.
 */
export function sanitizeSearchQuery(input: string, maxLength = 100): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    // Strip HTML/XML tags
    .replace(/<[^>]*>/g, '')
    // Strip SQL / Cypher comment delimiters and query chaining semicolons
    .replace(/;|--|\/\*|\*\//g, ' ')
    // Strip null bytes and non-printable control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize excessive spaces
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

/**
 * Sanitizes an interactive chat message prompt.
 * Removes script/HTML tags, null bytes, and non-printable control characters
 * while preserving valid conversational punctuation, emojis, and newlines.
 */
export function sanitizeChatMessage(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    // Strip HTML tags and dangerous script event attributes
    .replace(/<[^>]*>/g, '')
    .replace(/\bon\w+\s*=/gi, '')
    // Strip null bytes and control codes (preserving \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

/**
 * Sanitizes field report notes or anomaly descriptions.
 * Strips HTML tags and null bytes, normalizes whitespace, and truncates to maxLength.
 */
export function sanitizeReportDescription(input: string, maxLength = 2000): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

/**
 * Sanitizes and normalizes an email address.
 * Trims whitespace, lowercases, and strips illegal injection characters.
 */
export function sanitizeEmail(input: string, maxLength = 254): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    .trim()
    .toLowerCase()
    .replace(/[<>'";\\/]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '');

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}
