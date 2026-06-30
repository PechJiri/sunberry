'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateNetGridPower,
  calculateNextEnergyBalanceMeters,
  updateEstimatedEnergyBalanceMeters,
  STORE_LAST_SAMPLE_AT,
  STORE_LAST_POWER_W,
  STORE_IMPORTED_KWH,
  STORE_EXPORTED_KWH,
} = require('../lib/EnergyBalanceEstimator');

test('calculateNetGridPower estimates grid export from house load, battery charging, and solar production', () => {
  assert.equal(calculateNetGridPower({
    homeConsumptionPowerW: 875,
    batteryPowerW: 2900,
    solarPowerW: 3900,
  }), -125);
});

test('calculateNetGridPower estimates grid import when local production is not enough', () => {
  assert.equal(calculateNetGridPower({
    homeConsumptionPowerW: 1200,
    batteryPowerW: -400,
    solarPowerW: 500,
  }), 300);
});

test('calculateNextEnergyBalanceMeters keeps meters unchanged for first sample', () => {
  const result = calculateNextEnergyBalanceMeters({
    currentImportedKWh: 10,
    currentExportedKWh: 2,
    previousPowerW: undefined,
    currentPowerW: -1000,
    previousSampleAt: undefined,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(result, { importedKWh: 10, exportedKWh: 2 });
});

test('calculateNextEnergyBalanceMeters integrates imported and exported grid energy', () => {
  const imported = calculateNextEnergyBalanceMeters({
    currentImportedKWh: 10,
    currentExportedKWh: 2,
    previousPowerW: 1000,
    currentPowerW: 1000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });
  const exported = calculateNextEnergyBalanceMeters({
    currentImportedKWh: 10,
    currentExportedKWh: 2,
    previousPowerW: -1000,
    currentPowerW: -1000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.deepEqual(imported, { importedKWh: 11, exportedKWh: 2 });
  assert.deepEqual(exported, { importedKWh: 10, exportedKWh: 3 });
});

test('updateEstimatedEnergyBalanceMeters persists sample state and returns next meter values', async () => {
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
      if (capability === 'meter_power.imported') return 10;
      if (capability === 'meter_power.exported') return 2;
      return null;
    },
  };

  const result = await updateEstimatedEnergyBalanceMeters(device, -1000, 3600000);

  assert.deepEqual(result, { importedKWh: 10, exportedKWh: 3 });
  assert.equal(store.get(STORE_LAST_SAMPLE_AT), 3600000);
  assert.equal(store.get(STORE_LAST_POWER_W), -1000);
  assert.equal(store.get(STORE_IMPORTED_KWH), 10);
  assert.equal(store.get(STORE_EXPORTED_KWH), 3);
});
