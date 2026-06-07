const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SecureSettingsStorage } = require('../bin/secure-settings');

test('SecureSettingsStorage keeps sensitive values out of persisted settings', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('DPAPI storage is Windows-only');
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'securepress-storage-test-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const storage = new SecureSettingsStorage(tempDir);
  const sanitized = await storage.sanitizeForPersistence('test-context', {
    actionType: 'http',
    httpUrl: 'https://example.test/hook',
    httpHeaders: '{"Authorization":"Bearer secret"}',
    httpBody: '{"hidden":true}',
  });

  assert.equal(sanitized.httpHeaders, undefined);
  assert.equal(sanitized.httpBody, undefined);
  assert.match(sanitized.secureSecretRefs.httpHeaders, /^dpapi:v1:/);
  assert.match(sanitized.secureSecretRefs.httpBody, /^dpapi:v1:/);

  const materialized = await storage.materialize(sanitized);
  assert.equal(materialized.httpHeaders, '{"Authorization":"Bearer secret"}');
  assert.equal(materialized.httpBody, '{"hidden":true}');
});
