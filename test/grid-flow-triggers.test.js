'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { getChangedGridMeterTriggers } = require('../lib/GridFlowTriggers');

test('getChangedGridMeterTriggers returns imported and exported meter changes', () => {
  const result = getChangedGridMeterTriggers({
    previousImportedKWh: 1,
    previousExportedKWh: 2,
    updates: {
      'meter_power.imported': 1.5,
      'meter_power.exported': 2.25,
    },
  });

  assert.deepEqual(result, [
    {
      cardId: 'grid_import_meter_changed',
      tokens: { energy: 1.5 },
    },
    {
      cardId: 'grid_export_meter_changed',
      tokens: { energy: 2.25 },
    },
  ]);
});

test('getChangedGridMeterTriggers ignores unchanged and missing meter values', () => {
  const result = getChangedGridMeterTriggers({
    previousImportedKWh: 1,
    previousExportedKWh: 2,
    updates: {
      'meter_power.imported': 1,
      measure_power: 300,
    },
  });

  assert.deepEqual(result, []);
});
