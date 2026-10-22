import {
  sanitizeSearchQuery,
  sanitizeChatMessage,
  sanitizeReportDescription,
  sanitizeEmail,
  stripHtmlAndScripts,
  escapeHtml,
  sanitizePayload,
} from '../src/core/sanitizer';

describe('Client-Side Input Sanitizer', () => {
  describe('stripHtmlAndScripts', () => {
    test('removes entire script tags and their inner executable contents', () => {
      const malicious = 'Normal text <script>alert("pwned")</script> more text';
      const clean = stripHtmlAndScripts(malicious);
      expect(clean).toBe('Normal text more text');
      expect(clean).not.toContain('alert');
      expect(clean).not.toContain('script');
    });

    test('removes styles, iframes, objects, embeds, and svgs with contents', () => {
      const malicious =
        '<style>body{display:none}</style><iframe src="javascript:alert(1)"></iframe><svg onload=alert(2)></svg>Civil works in progress';
      const clean = stripHtmlAndScripts(malicious);
      expect(clean).toBe('Civil works in progress');
      expect(clean).not.toContain('iframe');
      expect(clean).not.toContain('style');
      expect(clean).not.toContain('svg');
    });

    test('strips dangerous event handlers and javascript URIs', () => {
      const malicious = '<a href="javascript:doEvil()" onclick="steal()">Click me</a>';
      const clean = stripHtmlAndScripts(malicious);
      expect(clean).toBe('Click me');
      expect(clean).not.toContain('javascript');
      expect(clean).not.toContain('onclick');
    });
  });

  describe('escapeHtml', () => {
    test('escapes special HTML entities', () => {
      expect(escapeHtml('<div>"Hello" & \'World\' /</div>')).toBe(
        '&lt;div&gt;&quot;Hello&quot; &amp; &#x27;World&#x27; &#x2F;&lt;&#x2F;div&gt;',
      );
    });

    test('handles empty or non-string inputs safely', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null as any)).toBe('');
    });
  });

  describe('sanitizeSearchQuery', () => {
    test('preserves clean search terms', () => {
      expect(sanitizeSearchQuery('Bogo City')).toBe('Bogo City');
      expect(sanitizeSearchQuery('24HH0043')).toBe('24HH0043');
      expect(sanitizeSearchQuery('flood mitigation revetment')).toBe('flood mitigation revetment');
    });

    test('strips HTML/script tags and angle brackets', () => {
      const malicious = '<script>alert("pwned")</script>Cebu City';
      const clean = sanitizeSearchQuery(malicious);
      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('Cebu City');
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

    test('strips malicious HTML and entire scripts from chat inputs', () => {
      const input = '<script>fetch("http://evil.com/cookie")</script><img src=x onerror=alert(1)> Tell me about Bogo flood control';
      const result = sanitizeChatMessage(input);
      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('fetch');
      expect(result).not.toContain('evil.com');
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
    test('cleans description text and strips dangerous script tags and body', () => {
      const desc =
        'Site inspection: <script>document.location="http://evil.com"</script><b>crack observed</b> on revetment wall.';
      const clean = sanitizeReportDescription(desc);
      expect(clean).not.toContain('<b>');
      expect(clean).not.toContain('</b>');
      expect(clean).not.toContain('evil.com');
      expect(clean).not.toContain('script');
      expect(clean).toContain('Site inspection: crack observed on revetment wall.');
    });

    test('handles empty or null-like inputs safely', () => {
      expect(sanitizeReportDescription('')).toBe('');
      expect(sanitizeReportDescription('   ')).toBe('');
    });

    test('escapes HTML entities when escapeEntities option is true', () => {
      const desc = 'Bridge gap > 5cm & cracking observed';
      const escaped = sanitizeReportDescription(desc, 2000, { escapeEntities: true });
      expect(escaped).toBe('Bridge gap &gt; 5cm &amp; cracking observed');
    });
  });

  describe('sanitizeEmail', () => {
    test('normalizes email casing and trims whitespace', () => {
      expect(sanitizeEmail('  Auditor.Cebu@DPWH.GOV.PH  ')).toBe('auditor.cebu@dpwh.gov.ph');
    });

    test('removes dangerous characters from email string', () => {
      expect(sanitizeEmail('bad<script>@domain.com')).toBe('bad@domain.com');
    });
  });

  describe('sanitizePayload', () => {
    test('sanitizes all string fields in an outbound form payload', () => {
      const payload = {
        projectId: '24HD0012<script>alert(1)</script>',
        description: 'Road repair <script>steal()</script>with deep potholes',
        category: 'delay',
        latitude: 10.3157,
        longitude: 123.8854,
        isAnonymous: true,
      };

      const clean = sanitizePayload(payload);
      expect(clean.projectId).toBe('24HD0012');
      expect(clean.description).toBe('Road repair with deep potholes');
      expect(clean.category).toBe('delay');
      expect(clean.latitude).toBe(10.3157);
      expect(clean.longitude).toBe(123.8854);
      expect(clean.isAnonymous).toBe(true);
    });

    test('sanitizes nested arrays and objects in payloads', () => {
      const payload = {
        query: 'Cebu <script>alert(1)</script>',
        filters: ['active<script>', 'delayed'],
        author: {
          name: 'Jane Doe <img src=x onerror=alert(2)>',
          email: '  JANE@EXAMPLE.COM  ',
        },
      };

      const clean = sanitizePayload(payload);
      expect(clean.query).toBe('Cebu');
      expect(clean.filters).toEqual(['active', 'delayed']);
      expect(clean.author.name).toBe('Jane Doe');
      expect(clean.author.email).toBe('JANE@EXAMPLE.COM');
    });
  });
});
