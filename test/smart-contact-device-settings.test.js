'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const SunberrySmartContactDevice = require('../drivers/sunberry_smart_contact/device');

test('smart contact settings update merges partial Homey changes into a complete Sunberry payload', async () => {
  const calls = [];
  const device = new SunberrySmartContactDevice();

  device.getSettings = () => ({
    smart_contact_power: 1200,
    smart_contact_overflow_offset: '',
    smart_contact_soc_min: 90,
    smart_contact_min_time: 20,
    smart_contact_output: 'DO1',
    smart_contact_priority: 'soc',
  });
  device.controlApi = {
    updateSettings: async (settings) => calls.push(settings),
  };

  await device.onSettings({
    changedKeys: ['smart_contact_power'],
    newSettings: {
      smart_contact_power: 1400,
    },
  });

  assert.deepEqual(calls, [{
    power: 1400,
    overflowOffset: '',
    socMin: 90,
    minTime: 20,
    output: 'DO1',
    priority: 'soc',
  }]);
});
