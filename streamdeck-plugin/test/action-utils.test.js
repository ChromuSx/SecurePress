const assert = require('node:assert/strict');
const test = require('node:test');
const { parseArgumentString, parseHotkeyKeys } = require('../bin/action-utils');

test('parseArgumentString keeps quoted arguments together', () => {
  assert.deepEqual(
    parseArgumentString('--profile "Streaming Mode" --flag value'),
    ['--profile', 'Streaming Mode', '--flag', 'value']
  );
});

test('parseArgumentString supports escaped quotes', () => {
  assert.deepEqual(
    parseArgumentString('--message "Say \\"hello\\""'),
    ['--message', 'Say "hello"']
  );
});

test('parseArgumentString rejects unclosed quotes', () => {
  assert.throws(
    () => parseArgumentString('--name "unfinished'),
    /unclosed quote/
  );
});

test('parseHotkeyKeys normalizes modifiers and aliases', () => {
  assert.deepEqual(
    parseHotkeyKeys('Ctrl+Shift+Esc'),
    { modifiers: ['CTRL', 'SHIFT'], mainKey: 'ESC' }
  );
});

test('parseHotkeyKeys rejects unsupported keys', () => {
  assert.throws(
    () => parseHotkeyKeys('Ctrl+MediaPlayPause'),
    /Unsupported hotkey key/
  );
});
