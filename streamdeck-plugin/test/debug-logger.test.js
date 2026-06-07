const assert = require('node:assert/strict');
const test = require('node:test');
const { sanitizeForLog } = require('../bin/debug-logger');

test('sanitizeForLog redacts sensitive nested fields', () => {
  const sanitized = sanitizeForLog({
    httpUrl: 'https://example.test',
    httpHeaders: '{"Authorization":"Bearer abc"}',
    nested: {
      token: 'abc',
      publicValue: 'visible',
    },
  });

  assert.equal(sanitized.httpUrl, 'https://example.test');
  assert.equal(sanitized.httpHeaders, '[REDACTED]');
  assert.equal(sanitized.nested.token, '[REDACTED]');
  assert.equal(sanitized.nested.publicValue, 'visible');
});
