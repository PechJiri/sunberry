'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateNextGridMeters,
  integrateSignedPower,
  updateEstimatedGridMeters,
  STORE_LAST_SAMPLE_AT,
  STORE_LAST_POWER_W,
  STORE_IMPORTED_KWH,
  STORE_EXPORTED_KWH,
} = require('../lib/GridEnergyEstimator');

test('calculateNextGridMeters keeps meters unchanged for first sample', () => {
  const result = calculateNextGridMeters({
    currentImportedKWh: 12,
    currentExportedKWh: 3,
    previousPowerW: undefined,
    currentPowerW: 1000,
    previousSampleAt: undefined,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 12, exportedKWh: 3 });
});

test('calculateNextGridMeters integrates imported energy from positive total power', () => {
  const result = calculateNextGridMeters({
    currentImportedKWh: 12,
    currentExportedKWh: 3,
    previousPowerW: 1000,
    currentPowerW: 2000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 13.5, exportedKWh: 3 });
});

test('calculateNextGridMeters integrates exported energy from negative total power', () => {
  const result = calculateNextGridMeters({
    currentImportedKWh: 12,
    currentExportedKWh: 3,
    previousPowerW: -1000,
    currentPowerW: -2000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 12, exportedKWh: 4.5 });
});

test('integrateSignedPower splits energy when total power crosses zero', () => {
  const result = integrateSignedPower(1000, -1000, 3600000);

  assert.deepEqual(result, { importedKWh: 0.25, exportedKWh: 0.25 });
});

test('calculateNextGridMeters skips stale samples after long polling gaps', () => {
  const result = calculateNextGridMeters({
    currentImportedKWh: 12,
    currentExportedKWh: 3,
    previousPowerW: 1000,
    currentPowerW: 1000,
    previousSampleAt: 0,
    currentSampleAt: 60000,
    maxElapsedMs: 30000,
  });

  assert.deepEqual(result, { importedKWh: 12, exportedKWh: 3 });
});

test('updateEstimatedGridMeters persists sample state and returns next meter values', async () => {
  const store = new Map([
    [STORE_LAST_SAMPLE_AT, 0],
    [STORE_LAST_POWER_W, -1000],
  ]);

  const device = {
    hasCapability: (capability) => capability === 'meter_power.imported' || capability === 'meter_power.exported',
    getUpdateIntervalMs: () => 3600000,
    getStoreValue: (key) => store.get(key),
    setStoreValue: async (key, value) => store.set(key, value),
    getCapabilityValue: (capability) => {
      if (capability === 'meter_power.imported') return 12;
      if (capability === 'meter_power.exported') return 3;
      return null;
    },
  };

  const result = await updateEstimatedGridMeters(device, -1000, 3600000);

  assert.deepEqual(result, { importedKWh: 12, exportedKWh: 4 });
  assert.equal(store.get(STORE_LAST_SAMPLE_AT), 3600000);
  assert.equal(store.get(STORE_LAST_POWER_W), -1000);
  assert.equal(store.get(STORE_IMPORTED_KWH), 12);
  assert.equal(store.get(STORE_EXPORTED_KWH), 4);
});
