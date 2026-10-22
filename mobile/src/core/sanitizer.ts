/**
 * Client-Side Input Sanitizer & Payload Hardener
 * ===============================================
 * Hardens user inputs before transmitting to backend APIs or knowledge graph queries.
 * Prevents XSS, script injection, HTML smuggling, Cypher/SQL injection patterns,
 * control character corruption, and buffer overflow vectors.
 */

/**
 * Strips script tags, style blocks, iframes, objects, embeds, svgs and their contents,
 * dangerous DOM event attributes (onload, onerror), and all remaining HTML tags.
 */
export function stripHtmlAndScripts(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return (
    input
      // 1. Remove entire script blocks with executable content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 2. Remove entire style blocks
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // 3. Remove iframes, objects, embeds, svgs and their contents
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      // 4. Remove dangerous inline event handlers: onerror=, onclick=, onload=
      .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
      // 5. Remove dangerous URI schemes: javascript:, vbscript:, data:text/html
      .replace(/(?:javascript|vbscript|data):[^\s"']*/gi, '')
      // 6. Strip all remaining HTML/XML tags
      .replace(/<[^>]*>/g, '')
      // 7. Normalize whitespace
      .replace(/[ \t]+/g, ' ')
      .trim()
  );
}

/**
 * Escapes characters with special meaning in HTML to neutralize injection
 * when rendered in web views, emails, or reflected UI contexts.
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes a search query string.
 * Strips script blocks, HTML tags, Cypher/SQL comment/chaining delimiters (; -- /* *\/),
 * and ASCII control characters. Enforces maximum length.
 */
export function sanitizeSearchQuery(input: string, maxLength = 100): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = stripHtmlAndScripts(input)
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
 * Removes script blocks, harmful HTML tags, null bytes, and non-printable control characters
 * while preserving valid conversational punctuation, emojis, and newlines.
 */
export function sanitizeChatMessage(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = stripHtmlAndScripts(input)
    // Strip null bytes and non-printable control codes (preserving \n, \r, \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

export interface ReportSanitizeOptions {
  escapeEntities?: boolean;
}

/**
 * Sanitizes field report notes or anomaly descriptions.
 * Strips script tags with their bodies, HTML markup, and null bytes,
 * normalizes whitespace, optionally escapes entities, and truncates to maxLength.
 */
export function sanitizeReportDescription(
  input: string,
  maxLength = 2000,
  options: ReportSanitizeOptions = {},
): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = stripHtmlAndScripts(input)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (options.escapeEntities) {
    sanitized = escapeHtml(sanitized);
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
}

/**
 * Sanitizes and normalizes an email address.
 * Trims whitespace, lowercases, and strips script tags and illegal injection characters.
 */
export function sanitizeEmail(input: string, maxLength = 254): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = stripHtmlAndScripts(input)
    .trim()
    .toLowerCase()
    .replace(/[<>'";\\/]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '');

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

/**
 * Recursively sanitizes all string properties in a form payload object
 * before packaging into JSON or multipart forms for HTTP transmission.
 */
export function sanitizePayload<T>(payload: T, maxLength = 2000): T {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return stripHtmlAndScripts(payload)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .slice(0, maxLength) as unknown as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item, maxLength)) as unknown as T;
  }

  if (typeof payload === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      sanitizedObj[key] = sanitizePayload(value, maxLength);
    }
    return sanitizedObj as T;
  }

  return payload;
}
