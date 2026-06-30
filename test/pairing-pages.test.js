'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const pairPages = fs.readdirSync(path.join(repoRoot, 'drivers'), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(repoRoot, 'drivers', entry.name, 'pair', 'pair.html'))
  .filter(file => fs.existsSync(file));

test('all pairing pages default to sunberry.local and enable connection check', () => {
  assert.ok(pairPages.length > 0);

  for (const file of pairPages) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /DEFAULT_HOST\s*=\s*'sunberry\.local'/, file);
    assert.match(html, /value="sunberry\.local"/, file);
    assert.doesNotMatch(html, /id="check-button"[^>]*disabled/, file);
  }
});

test('all pairing pages use compact status messages for checking, success, and recoverable errors', () => {
  for (const file of pairPages) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /id="status-message"/, file);
    assert.match(html, /Checking connection/, file);
    assert.match(html, /Device found/, file);
    assert.match(html, /Try a different IP address or try again later/, file);
    assert.match(html, /\.status-message[^{]*{[^}]*font-size:\s*0\.875rem/s, file);
  }
});
