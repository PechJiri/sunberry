'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { applyCapabilityUpdates } = require('../lib/SunberryPollingDevice');

test('applyCapabilityUpdates only writes existing changed finite values', async () => {
  const writes = [];
  const device = {
    hasCapability: capability => capability !== 'missing_capability',
    getCapabilityValue: capability => capability === 'measure_power' ? 10 : null,
    setCapabilityValue: async (capability, value) => writes.push([capability, value]),
  };

  await applyCapabilityUpdates(device, {
    measure_power: 10,
    measure_battery: 21,
    missing_capability: 1,
    measure_temperature: Number.NaN,
  });

  assert.deepEqual(writes, [['measure_battery', 21]]);
});
