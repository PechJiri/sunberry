'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateNextBatteryMeters,
  updateEstimatedBatteryMeters,
  STORE_LAST_SAMPLE_AT,
  STORE_LAST_POWER_W,
  STORE_IMPORTED_KWH,
  STORE_EXPORTED_KWH,
} = require('../lib/BatteryEnergyEstimator');

test('calculateNextBatteryMeters keeps meters unchanged for first sample', () => {
  const result = calculateNextBatteryMeters({
    currentImportedKWh: 4,
    currentExportedKWh: 2,
    previousPowerW: undefined,
    currentPowerW: 1000,
    previousSampleAt: undefined,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 4, exportedKWh: 2 });
});

test('calculateNextBatteryMeters integrates charged energy from positive power', () => {
  const result = calculateNextBatteryMeters({
    currentImportedKWh: 4,
    currentExportedKWh: 2,
    previousPowerW: 1000,
    currentPowerW: 2000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 5.5, exportedKWh: 2 });
});

test('calculateNextBatteryMeters integrates discharged energy from negative power', () => {
  const result = calculateNextBatteryMeters({
    currentImportedKWh: 4,
    currentExportedKWh: 2,
    previousPowerW: -1000,
    currentPowerW: -2000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 4, exportedKWh: 3.5 });
});

test('calculateNextBatteryMeters splits charged and discharged energy when power crosses zero', () => {
  const result = calculateNextBatteryMeters({
    currentImportedKWh: 4,
    currentExportedKWh: 2,
    previousPowerW: 1000,
    currentPowerW: -1000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 4.25, exportedKWh: 2.25 });
});

test('calculateNextBatteryMeters skips stale samples after long polling gaps', () => {
  const result = calculateNextBatteryMeters({
    currentImportedKWh: 4,
    currentExportedKWh: 2,
    previousPowerW: 1000,
    currentPowerW: 1000,
    previousSampleAt: 0,
    currentSampleAt: 60000,
    maxElapsedMs: 30000,
  });

  assert.deepEqual(result, { importedKWh: 4, exportedKWh: 2 });
});

test('updateEstimatedBatteryMeters persists sample state and returns next meter values', async () => {
  const store = new Map([
    [STORE_LAST_SAMPLE_AT, 0],
    [STORE_LAST_POWER_W, 1000],
  ]);

  const device = {
    hasCapability: (capability) => capability === 'meter_power.imported' || capability === 'meter_power.exported',
    getUpdateIntervalMs: () => 3600000,
    getStoreValue: (key) => store.get(key),
    setStoreValue: async (key, value) => store.set(key, value),
    getCapabilityValue: (capability) => {
      if (capability === 'meter_power.imported') return 4;
      if (capability === 'meter_power.exported') return 2;
      return null;
    },
  };

  const result = await updateEstimatedBatteryMeters(device, 1000, 3600000);

  assert.deepEqual(result, { importedKWh: 5, exportedKWh: 2 });
  assert.equal(store.get(STORE_LAST_SAMPLE_AT), 3600000);
  assert.equal(store.get(STORE_LAST_POWER_W), 1000);
  assert.equal(store.get(STORE_IMPORTED_KWH), 5);
  assert.equal(store.get(STORE_EXPORTED_KWH), 2);
});
