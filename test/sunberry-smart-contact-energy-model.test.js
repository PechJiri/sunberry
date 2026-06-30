'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const smartContactDriver = require('../drivers/sunberry_smart_contact/driver.compose.json');

test('smart contact driver exposes onoff control and contact telemetry only', () => {
  assert.equal(smartContactDriver.energy, undefined);
  assert.deepEqual(smartContactDriver.capabilities, [
    'onoff',
    'alarm_contact',
    'smart_contact_closed',
    'smart_contact_last_closed_at',
    'smart_contact_last_opened_at',
  ]);
});
