'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { MIN_REQUEST_GAP_MS, enqueueByKey } = require('../lib/SunberryRequestQueue');

test('enqueueByKey leaves a small gap between requests to the same host', async () => {
  const startedAt = [];

  await Promise.all([
    enqueueByKey('http://gap.test', async () => {
      startedAt.push(Date.now());
    }),
    enqueueByKey('http://gap.test', async () => {
      startedAt.push(Date.now());
    }),
  ]);

  assert.equal(startedAt.length, 2);
  assert.ok(startedAt[1] - startedAt[0] >= MIN_REQUEST_GAP_MS - 10);
});
