'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createPairedDevice } = require('../lib/SunberryPairing');

test('createPairedDevice creates stable ids per split device type and host', () => {
  assert.deepEqual(createPairedDevice({
    type: 'battery',
    ipAddress: 'sunberry.local',
    name: 'Sunberry Battery',
    settings: { force_charging_limit: 5000 },
  }), {
    name: 'Sunberry Battery',
    data: { id: 'sunberry.local:battery' },
    settings: {
      ip_address: 'sunberry.local',
      update_interval: 10,
      enable_debug_logs: false,
      force_charging_limit: 5000,
    },
  });
});
