'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeHost,
  toSunberryBaseUrl,
} = require('../lib/SunberryHostResolver');

test('normalizeHost accepts plain hosts and strips URL protocols', () => {
  assert.equal(normalizeHost('sunberry.local'), 'sunberry.local');
  assert.equal(normalizeHost('http://sunberry.local/'), 'sunberry.local');
  assert.equal(normalizeHost('http://192.168.68.67/'), '192.168.68.67');
});

test('toSunberryBaseUrl builds one valid HTTP base URL from host or URL settings', () => {
  assert.equal(toSunberryBaseUrl('sunberry.local'), 'http://sunberry.local');
  assert.equal(toSunberryBaseUrl('http://sunberry.local/'), 'http://sunberry.local');
  assert.equal(toSunberryBaseUrl('http://192.168.68.67/'), 'http://192.168.68.67');
});

test('toSunberryBaseUrl rejects empty host settings', () => {
  assert.throws(() => toSunberryBaseUrl(''), /Sunberry host is required/);
});
