'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const gridDriver = require('../drivers/sunberry_grid/driver.compose.json');

test('home consumption driver does not report house load as grid import/export energy', () => {
  assert.equal(gridDriver.energy, undefined);
  assert.equal(gridDriver.capabilities.includes('measure_power'), false);
  assert.equal(gridDriver.capabilities.includes('meter_power.imported'), false);
  assert.equal(gridDriver.capabilities.includes('meter_power.exported'), false);
});
