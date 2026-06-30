'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const boiler1fDriver = require('../drivers/sunberry_boiler_1f/driver.compose.json');
const boiler3fDriver = require('../drivers/sunberry_boiler_3f/driver.compose.json');

test('single-phase boiler driver exposes total power and optional temperature only', () => {
  assert.equal(boiler1fDriver.name.en, 'Sunberry Boiler 1F');
  assert.equal(boiler1fDriver.class, 'sensor');
  assert.deepEqual(boiler1fDriver.capabilities, [
    'measure_power',
    'measure_temperature',
  ]);
});

test('three-phase boiler driver exposes total power, optional temperature, and phase powers', () => {
  assert.equal(boiler3fDriver.name.en, 'Sunberry Boiler 3F');
  assert.equal(boiler3fDriver.class, 'sensor');
  assert.deepEqual(boiler3fDriver.capabilities, [
    'measure_power',
    'measure_temperature',
    'measure_L1',
    'measure_L2',
    'measure_L3',
  ]);
});
