const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', 'test');
const testFiles = fs
  .readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .sort()
  .map(file => path.join('test', file));

if (testFiles.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
