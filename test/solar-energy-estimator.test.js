'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateNextSolarMeter,
  integrateGeneratedPower,
  updateEstimatedSolarMeter,
  STORE_LAST_SAMPLE_AT,
  STORE_LAST_POWER_W,
  STORE_METER_KWH,
} = require('../lib/SolarEnergyEstimator');

test('calculateNextSolarMeter keeps meter unchanged for first sample', () => {
  const result = calculateNextSolarMeter({
    currentMeterKWh: 5,
    previousPowerW: undefined,
    currentPowerW: 1000,
    previousSampleAt: undefined,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.equal(result, 5);
});

test('calculateNextSolarMeter integrates generated power into cumulative kWh', () => {
  const result = calculateNextSolarMeter({
    currentMeterKWh: 5,
    previousPowerW: 1000,
    currentPowerW: 2000,
    previousSampleAt: 0,
    currentSampleAt: 3600000,
    maxElapsedMs: 7200000,
  });

  assert.equal(result, 6.5);
});

test('integrateGeneratedPower clamps negative solar samples to zero', () => {
  const result = integrateGeneratedPower(1000, -1000, 3600000);

  assert.equal(result, 0.5);
});

test('calculateNextSolarMeter skips stale samples after long polling gaps', () => {
  const result = calculateNextSolarMeter({
    currentMeterKWh: 5,
    previousPowerW: 1000,
    currentPowerW: 1000,
    previousSampleAt: 0,
    currentSampleAt: 60000,
    maxElapsedMs: 30000,
  });

  assert.equal(result, 5);
});

test('updateEstimatedSolarMeter persists sample state and returns next meter value', async () => {
  const store = new Map([
    [STORE_LAST_SAMPLE_AT, 0],
    [STORE_LAST_POWER_W, 1000],
  ]);

  const device = {
    hasCapability: (capability) => capability === 'meter_power',
    getUpdateIntervalMs: () => 3600000,
    getStoreValue: (key) => store.get(key),
    setStoreValue: async (key, value) => store.set(key, value),
    getCapabilityValue: (capability) => capability === 'meter_power' ? 5 : null,
  };

  const result = await updateEstimatedSolarMeter(device, 1000, 3600000);

  assert.equal(result, 6);
  assert.equal(store.get(STORE_LAST_SAMPLE_AT), 3600000);
  assert.equal(store.get(STORE_LAST_POWER_W), 1000);
  assert.equal(store.get(STORE_METER_KWH), 6);
});
