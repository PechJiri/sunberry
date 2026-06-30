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

test('smart contact timer update merges partial Homey changes into a complete timer payload', async () => {
  const calls = [];
  const device = new SunberrySmartContactDevice();

  device.getSettings = () => ({
    smart_contact_timer_start: '06:00',
    smart_contact_timer_stop: '21:00',
    smart_contact_timer_mode: 'battery',
  });
  device.controlApi = {
    updateTimer: async (settings) => calls.push(settings),
  };

  await device.onSettings({
    changedKeys: ['smart_contact_timer_stop'],
    newSettings: {
      smart_contact_timer_stop: '20:30',
    },
  });

  assert.deepEqual(calls, [{
    start: '06:00',
    stop: '20:30',
    mode: 'battery',
  }]);
});

test('turnOnSmartContact uses current timer settings and overrides only requested mode', async () => {
  const calls = [];
  const capabilityWrites = [];
  const device = new SunberrySmartContactDevice();

  device.getSettings = () => ({
    smart_contact_timer_start: '06:00',
    smart_contact_timer_stop: '21:00',
    smart_contact_timer_mode: 'battery',
  });
  device.controlApi = {
    enable: async (settings) => calls.push(settings),
  };
  device.setCapabilityValue = async (capability, value) => capabilityWrites.push({ capability, value });

  await device.turnOnSmartContact({ mode: 'combined' });

  assert.deepEqual(calls, [{
    start: '06:00',
    stop: '21:00',
    mode: 'combined',
  }]);
  assert.deepEqual(capabilityWrites, [{ capability: 'onoff', value: true }]);
});
