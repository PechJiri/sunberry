'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Homey app icon uses deterministic inline fills without CSS dependencies', () => {
  const icon = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.svg'), 'utf8');

  assert.match(icon, /<svg\b[^>]*viewBox="0 0 512 512"/);
  assert.doesNotMatch(icon, /<!DOCTYPE/i);
  assert.doesNotMatch(icon, /<style\b/i);
  assert.doesNotMatch(icon, /\bstyle="/i);
  assert.doesNotMatch(icon, /\bclass="/i);
  assert.doesNotMatch(icon, /fill:\s*#/i);
  assert.doesNotMatch(icon, /currentColor/i);
  assert.doesNotMatch(icon, /<rect\b[^>]*fill="/i);

  const fills = Array.from(icon.matchAll(/\bfill="([^"]+)"/gi), match => match[1].toLowerCase());
  assert.ok(fills.length > 0);
  assert.deepEqual(new Set(fills), new Set(['#000']));
});
