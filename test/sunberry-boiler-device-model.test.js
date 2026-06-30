'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const boiler1fDriver = require('../drivers/sunberry_boiler_1f/driver.compose.json');
const boiler3fDriver = require('../drivers/sunberry_boiler_3f/driver.compose.json');
const boiler1fSettings = require('../drivers/sunberry_boiler_1f/driver.settings.compose.json');
const boiler3fSettings = require('../drivers/sunberry_boiler_3f/driver.settings.compose.json');

test('single-phase boiler driver exposes onoff, total power, and optional temperature only', () => {
  assert.equal(boiler1fDriver.name.en, 'Sunberry Boiler 1F');
  assert.equal(boiler1fDriver.class, 'sensor');
  assert.deepEqual(boiler1fDriver.capabilities, [
    'onoff',
    'measure_power',
    'meter_power',
    'boiler_temperature_sensor_connected',
    'measure_temperature',
  ]);
});

test('three-phase boiler driver exposes onoff, total power, optional temperature, and phase powers', () => {
  assert.equal(boiler3fDriver.name.en, 'Sunberry Boiler 3F');
  assert.equal(boiler3fDriver.class, 'sensor');
  assert.deepEqual(boiler3fDriver.capabilities, [
    'onoff',
    'measure_power',
    'meter_power',
    'boiler_temperature_sensor_connected',
    'measure_temperature',
    'measure_L1',
    'measure_L2',
    'measure_L3',
  ]);
});

test('boiler temperature sensor connected capability is shown as YES/NO sensor', () => {
  const capability = require('../.homeycompose/capabilities/boiler_temperature_sensor_connected.json');

  assert.equal(capability.type, 'boolean');
  assert.equal(capability.title.en, 'Temperature sensor connected');
  assert.equal(capability.getable, true);
  assert.equal(capability.setable, false);
  assert.equal(capability.uiComponent, 'sensor');
  assert.equal(capability.titleTrue.en, 'YES');
  assert.equal(capability.titleFalse.en, 'NO');
});

test('boiler drivers expose default timer settings with business hints', () => {
  for (const settings of [boiler1fSettings, boiler3fSettings]) {
    const settingsById = Object.fromEntries(settings.map(setting => [setting.id, setting]));

    assert.equal(settingsById.boiler_default_min_temperature.type, 'number');
    assert.equal(settingsById.boiler_default_min_temperature.min, 0);
    assert.equal(settingsById.boiler_default_min_temperature.max, 60);
    assert.match(settingsById.boiler_default_min_temperature.hint.en, /temperature sensor is connected/);

    assert.equal(settingsById.boiler_default_max_temperature.type, 'number');
    assert.equal(settingsById.boiler_default_max_temperature.min, 30);
    assert.equal(settingsById.boiler_default_max_temperature.max, 80);
    assert.match(settingsById.boiler_default_max_temperature.hint.en, /turns off/);

    assert.equal(settingsById.boiler_power_routing.type, 'checkbox');
    assert.match(settingsById.boiler_power_routing.hint.en, /surplus PV power/);
    assert.match(settingsById.boiler_power_routing.hint.en, /grid energy/);
  }
});

test('single-phase boiler driver exposes installation settings with dropdowns', () => {
  const settingsById = Object.fromEntries(boiler1fSettings.map(setting => [setting.id, setting]));

  assert.equal(settingsById.boiler_1f_power.type, 'number');
  assert.match(settingsById.boiler_1f_power.hint.en, /configured total heater power/);

  assert.equal(settingsById.boiler_1f_regulation_offset.type, 'number');
  assert.match(settingsById.boiler_1f_regulation_offset.hint.en, /surplus power/);

  assert.equal(settingsById.boiler_1f_phase_connected.type, 'dropdown');
  assert.deepEqual(settingsById.boiler_1f_phase_connected.values.map(value => value.id), ['R', 'S', 'T']);
  assert.deepEqual(settingsById.boiler_1f_phase_connected.values.map(value => value.label.en), ['L1', 'L2', 'L3']);

  assert.equal(settingsById.boiler_1f_output.type, 'dropdown');
  assert.deepEqual(settingsById.boiler_1f_output.values.map(value => value.id), ['DO1', 'DO2', 'DO3', 'DO4']);
  assert.match(settingsById.boiler_1f_output.hint.en, /digital output/);
});

test('three-phase boiler driver exposes installation settings with regulation and output dropdowns', () => {
  const settingsById = Object.fromEntries(boiler3fSettings.map(setting => [setting.id, setting]));

  assert.equal(settingsById.boiler_3f_power.type, 'number');
  assert.match(settingsById.boiler_3f_power.hint.en, /configured total heater power/);

  assert.equal(settingsById.boiler_3f_regulation_offset.type, 'number');
  assert.match(settingsById.boiler_3f_regulation_offset.hint.en, /surplus power/);

  assert.equal(settingsById.boiler_3f_regulation_type.type, 'dropdown');
  assert.deepEqual(settingsById.boiler_3f_regulation_type.values.map(value => value.id), ['symmetric', 'asymmetric']);

  for (const id of ['boiler_3f_output_l1', 'boiler_3f_output_l2', 'boiler_3f_output_l3']) {
    assert.equal(settingsById[id].type, 'dropdown');
    assert.deepEqual(settingsById[id].values.map(value => value.id), ['DO1', 'DO2', 'DO3', 'DO4']);
  }

  assert.match(settingsById.boiler_3f_output_l1.hint.en, /common output in symmetric/);
  assert.match(settingsById.boiler_3f_output_l2.hint.en, /asymmetric/);
  assert.match(settingsById.boiler_3f_output_l3.hint.en, /asymmetric/);
});
