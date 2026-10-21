import {
  sanitizeSearchQuery,
  sanitizeChatMessage,
  sanitizeReportDescription,
  sanitizeEmail,
} from '../src/core/sanitizer';

describe('Client-Side Input Sanitizer', () => {
  describe('sanitizeSearchQuery', () => {
    test('preserves clean search terms', () => {
      expect(sanitizeSearchQuery('Bogo City')).toBe('Bogo City');
      expect(sanitizeSearchQuery('24HH0043')).toBe('24HH0043');
      expect(sanitizeSearchQuery('flood mitigation revetment')).toBe('flood mitigation revetment');
    });

    test('strips HTML/script tags and angle brackets', () => {
      const malicious = '<script>alert("pwned")</script>Cebu City';
      expect(sanitizeSearchQuery(malicious)).not.toContain('<');
      expect(sanitizeSearchQuery(malicious)).not.toContain('>');
      expect(sanitizeSearchQuery(malicious)).toContain('Cebu City');
    });

    test('neutralizes SQL / Cypher comment injection and semicolons', () => {
      const injection = 'Lahug; MATCH (n) DETACH DELETE n; --';
      const clean = sanitizeSearchQuery(injection);
      expect(clean).not.toContain(';');
      expect(clean).not.toContain('--');
      expect(clean).not.toContain('/*');
      expect(clean).not.toContain('*/');
    });

    test('strips null bytes and control characters', () => {
      const dirty = 'Consolacion\x00\x08\x1bHighway';
      expect(sanitizeSearchQuery(dirty)).toBe('ConsolacionHighway');
    });

    test('truncates search queries exceeding max length', () => {
      const longInput = 'A'.repeat(250);
      const sanitized = sanitizeSearchQuery(longInput, 50);
      expect(sanitized.length).toBe(50);
    });
  });

  describe('sanitizeChatMessage', () => {
    test('preserves valid user questions with punctuation', () => {
      const prompt = 'What is the total budget for QM BUILDERS in 2024?';
      expect(sanitizeChatMessage(prompt)).toBe(prompt);
    });

    test('strips malicious HTML and scripts from chat inputs', () => {
      const input = '<img src=x onerror=alert(1)> Tell me about Bogo flood control';
      const result = sanitizeChatMessage(input);
      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
      expect(result).toContain('Tell me about Bogo flood control');
    });

    test('removes null bytes and non-printable control codes while keeping newlines', () => {
      const input = 'First line\nSecond line\0\x07';
      const clean = sanitizeChatMessage(input);
      expect(clean).toBe('First line\nSecond line');
    });

    test('enforces max length on chat input', () => {
      const bigMsg = 'Hello '.repeat(300);
      const clean = sanitizeChatMessage(bigMsg, 200);
      expect(clean.length).toBeLessThanOrEqual(200);
    });
  });

  describe('sanitizeReportDescription', () => {
    test('cleans description text and strips dangerous tags', () => {
      const desc = 'Site inspection: <b>crack observed</b> on revetment wall.';
      const clean = sanitizeReportDescription(desc);
      expect(clean).not.toContain('<b>');
      expect(clean).not.toContain('</b>');
      expect(clean).toContain('crack observed on revetment wall');
    });

    test('handles empty or null-like inputs safely', () => {
      expect(sanitizeReportDescription('')).toBe('');
      expect(sanitizeReportDescription('   ')).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    test('normalizes email casing and trims whitespace', () => {
      expect(sanitizeEmail('  Auditor.Cebu@DPWH.GOV.PH  ')).toBe('auditor.cebu@dpwh.gov.ph');
    });

    test('removes dangerous characters from email string', () => {
      expect(sanitizeEmail('bad<script>@domain.com')).toBe('badscript@domain.com');
    });
  });
});
