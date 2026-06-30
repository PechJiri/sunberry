'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const SunberryBoiler1FDevice = require('../drivers/sunberry_boiler_1f/device');
const SunberryBoiler3FDevice = require('../drivers/sunberry_boiler_3f/device');

test('boiler timer settings update merges partial Homey changes into a complete timer payload', async () => {
  const calls = [];
  const device = new SunberryBoiler1FDevice();

  device.getSettings = () => ({
    boiler_default_min_temperature: 40,
    boiler_default_max_temperature: 60,
    boiler_power_routing: true,
  });
  device.controlApi = {
    updateTimer: async (settings) => calls.push(settings),
  };

  await device.onSettings({
    changedKeys: ['boiler_default_min_temperature'],
    newSettings: {
      boiler_default_min_temperature: 45,
    },
  });

  assert.deepEqual(calls, [{
    minTemperature: 45,
    maxTemperature: 60,
    powerRouting: true,
  }]);
});

test('1F boiler installation settings update merges partial Homey changes into a complete settings payload', async () => {
  const calls = [];
  const device = new SunberryBoiler1FDevice();

  device.getSettings = () => ({
    boiler_1f_power: 3000,
    boiler_1f_regulation_offset: 300,
    boiler_1f_phase_connected: 'R',
    boiler_1f_output: 'DO1',
  });
  device.controlApi = {
    updateSettings: async (settings) => calls.push(settings),
  };

  await device.onSettings({
    changedKeys: ['boiler_1f_phase_connected'],
    newSettings: {
      boiler_1f_phase_connected: 'S',
    },
  });

  assert.deepEqual(calls, [{
    boiler_power: '3000',
    regulation_offset: '300',
    no_phases: '1',
    phase_connected: 'S',
    regulation_type: 'asymmetric',
    output_R: 'DO3',
    output_S: 'DO1',
    output_T: 'DO3',
  }]);
});

test('3F boiler installation settings update sends symmetric payload with common output', async () => {
  const calls = [];
  const device = new SunberryBoiler3FDevice();

  device.getSettings = () => ({
    boiler_3f_power: 3000,
    boiler_3f_regulation_offset: 300,
    boiler_3f_regulation_type: 'symmetric',
    boiler_3f_output_l1: 'DO3',
    boiler_3f_output_l2: 'DO1',
    boiler_3f_output_l3: 'DO4',
  });
  device.controlApi = {
    updateSettings: async (settings) => calls.push(settings),
  };

  await device.onSettings({
    changedKeys: ['boiler_3f_output_l1'],
    newSettings: {
      boiler_3f_output_l1: 'DO2',
    },
  });

  assert.deepEqual(calls, [{
    boiler_power: '3000',
    regulation_offset: '300',
    no_phases: '3',
    phase_connected: 'R',
    regulation_type: 'symmetric',
    output_R: 'DO2',
    output_S: 'DO2',
    output_T: 'DO2',
  }]);
});

test('3F boiler installation settings update sends asymmetric per-phase outputs', async () => {
  const calls = [];
  const device = new SunberryBoiler3FDevice();

  device.getSettings = () => ({
    boiler_3f_power: 3000,
    boiler_3f_regulation_offset: 300,
    boiler_3f_regulation_type: 'asymmetric',
    boiler_3f_output_l1: 'DO1',
    boiler_3f_output_l2: 'DO3',
    boiler_3f_output_l3: 'DO4',
  });
  device.controlApi = {
    updateSettings: async (settings) => calls.push(settings),
  };

  await device.onSettings({
    changedKeys: ['boiler_3f_output_l3'],
    newSettings: {
      boiler_3f_output_l3: 'DO2',
    },
  });

  assert.deepEqual(calls, [{
    boiler_power: '3000',
    regulation_offset: '300',
    no_phases: '3',
    phase_connected: 'R',
    regulation_type: 'asymmetric',
    output_R: 'DO1',
    output_S: 'DO3',
    output_T: 'DO2',
  }]);
});

test('turning boiler on posts current timer settings before active change and updates onoff', async () => {
  const calls = [];
  const capabilityWrites = [];
  const device = new SunberryBoiler1FDevice();

  device.getSettings = () => ({
    boiler_default_min_temperature: 40,
    boiler_default_max_temperature: 60,
    boiler_power_routing: false,
  });
  device.controlApi = {
    enable: async (settings) => calls.push(settings),
  };
  device.setCapabilityValue = async (capability, value) => capabilityWrites.push({ capability, value });

  await device.onActiveChanged(true);

  assert.deepEqual(calls, [{
    minTemperature: 40,
    maxTemperature: 60,
    powerRouting: false,
  }]);
  assert.deepEqual(capabilityWrites, [{ capability: 'onoff', value: true }]);
});

test('turnOnBoiler overrides only requested power routing mode', async () => {
  const calls = [];
  const capabilityWrites = [];
  const device = new SunberryBoiler1FDevice();

  device.getSettings = () => ({
    boiler_default_min_temperature: 40,
    boiler_default_max_temperature: 60,
    boiler_power_routing: true,
  });
  device.controlApi = {
    enable: async (settings) => calls.push(settings),
  };
  device.setCapabilityValue = async (capability, value) => capabilityWrites.push({ capability, value });

  await device.turnOnBoiler({ power_routing: 'without' });

  assert.deepEqual(calls, [{
    minTemperature: 40,
    maxTemperature: 60,
    powerRouting: false,
  }]);
  assert.deepEqual(capabilityWrites, [{ capability: 'onoff', value: true }]);
});

test('turning boiler on uses safe defaults when new timer settings are missing after an update', async () => {
  const calls = [];
  const device = new SunberryBoiler1FDevice();

  device.getSettings = () => ({});
  device.controlApi = {
    enable: async (settings) => calls.push(settings),
  };
  device.setCapabilityValue = async () => {};

  await device.onActiveChanged(true);

  assert.deepEqual(calls, [{
    minTemperature: 40,
    maxTemperature: 60,
    powerRouting: true,
  }]);
});

test('turning boiler off calls active change only and updates onoff', async () => {
  const calls = [];
  const capabilityWrites = [];
  const device = new SunberryBoiler1FDevice();

  device.controlApi = {
    disable: async () => calls.push('disable'),
  };
  device.setCapabilityValue = async (capability, value) => capabilityWrites.push({ capability, value });

  await device.onActiveChanged(false);

  assert.deepEqual(calls, ['disable']);
  assert.deepEqual(capabilityWrites, [{ capability: 'onoff', value: false }]);
});
