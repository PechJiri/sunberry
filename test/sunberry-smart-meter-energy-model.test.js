'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const smartMeterDriver = require('../drivers/sunberry_smart_meter/driver.compose.json');

test('smart meter driver reports computed net grid import and export to Homey Energy', () => {
  assert.deepEqual(smartMeterDriver.energy, {
    cumulative: true,
    cumulativeImportedCapability: 'meter_power.imported',
    cumulativeExportedCapability: 'meter_power.exported',
  });
  assert.deepEqual(smartMeterDriver.capabilities, [
    'measure_power',
    'meter_power.imported',
    'meter_power.exported',
  ]);
});
