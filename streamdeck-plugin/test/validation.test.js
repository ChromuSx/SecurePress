const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { validateSettings } = require('../bin/validation');

test('validateSettings rejects invalid HTTP headers', () => {
  const result = validateSettings({
    actionType: 'http',
    httpUrl: 'https://example.test',
    httpHeaders: '{bad json',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /valid JSON/);
});

test('validateSettings accepts a configured text action', () => {
  const result = validateSettings({
    actionType: 'text',
    textContent: 'hello',
    textMode: 'paste',
    sessionDurationMinutes: 5,
  });

  assert.equal(result.valid, true);
});

test('validateSettings warns when GET has a body', () => {
  const result = validateSettings({
    actionType: 'http',
    httpUrl: 'https://example.test',
    httpMethod: 'GET',
    httpBody: '{"ignored":true}',
  });

  assert.equal(result.valid, true);
  assert.match(result.warnings.join('\n'), /ignored for GET/);
});

test('validateSettings resolves relative program paths against workingDirectory', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'securepress-validation-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  fs.writeFileSync(path.join(tempDir, 'tool.exe'), '');

  const result = validateSettings({
    actionType: 'program',
    programPath: '.\\tool.exe',
    workingDirectory: tempDir,
  });

  assert.equal(result.valid, true);
});
