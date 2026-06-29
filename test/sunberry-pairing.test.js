'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createPairedDevice } = require('../lib/SunberryPairing');
const { createSunberryDriver } = require('../lib/SunberrySplitDriver');

test('createPairedDevice creates stable ids per split device type and host', () => {
  assert.deepEqual(createPairedDevice({
    type: 'battery',
    ipAddress: '192.168.1.50',
    name: 'Sunberry Battery',
    settings: { force_charging_limit: 5000 },
  }), {
    name: 'Sunberry Battery',
    data: { id: '192.168.1.50:battery' },
    settings: {
      ip_address: '192.168.1.50',
      update_interval: 10,
      enable_debug_logs: false,
      force_charging_limit: 5000,
    },
  });
});

test('split driver pairing requires user-provided host before listing devices', async () => {
  const Driver = createSunberryDriver({
    type: 'grid',
    name: 'Sunberry Grid',
    testMethod: 'getGridValues',
  });
  const driver = new Driver();
  const handlers = {};
  const session = {
    setHandler(name, handler) {
      handlers[name] = handler;
    },
  };

  await driver.onPair(session);

  assert.deepEqual(await handlers.getSettings(), { ip_address: '' });
  assert.deepEqual(await handlers.list_devices(), []);
});
