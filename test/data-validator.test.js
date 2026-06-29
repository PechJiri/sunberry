'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const DataValidator = require('../lib/DataValidator');

test('normalizeChargingLimit keeps valid charging limit under current maximum', () => {
  assert.equal(DataValidator.normalizeChargingLimit(3000, 5000), 3000);
});

test('normalizeChargingLimit clamps charging limit to current maximum charging power', () => {
  assert.equal(DataValidator.normalizeChargingLimit(8000, 5000), 5000);
});

test('normalizeChargingLimit clamps charging limit even above fallback maximum when current maximum is known', () => {
  assert.equal(DataValidator.normalizeChargingLimit(13000, 10889), 10889);
});

test('normalizeChargingLimit rejects values below minimum charging power', () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    assert.throws(
      () => DataValidator.normalizeChargingLimit(50, 5000),
      /Invalid charging limit/
    );
  } finally {
    console.log = originalLog;
  }
});
