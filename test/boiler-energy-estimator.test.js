'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateNextBoilerMeter,
  integrateBoilerPower,
  updateEstimatedBoilerMeter,
  STORE_LAST_SAMPLE_AT,
  STORE_LAST_POWER_W,
  STORE_METER_KWH,
} = require('../lib/BoilerEnergyEstimator');

test('calculateNextBoilerMeter keeps meter unchanged for first sample', () => {
  const result = calculateNextBoilerMeter({
    currentMeterKWh: 2,
    previousPowerW: undefined,
    currentPowerW: 3000,
    previousSampleAt: undefined,
    currentSampleAt: 1800000,
    maxElapsedMs: 3600000,
  });

  assert.equal(result, 2);
});

test('calculateNextBoilerMeter integrates heater power into cumulative kWh', () => {
  const result = calculateNextBoilerMeter({
    currentMeterKWh: 2,
    previousPowerW: 1000,
    currentPowerW: 3000,
    previousSampleAt: 0,
    currentSampleAt: 1800000,
    maxElapsedMs: 3600000,
  });

  assert.equal(result, 3);
});

test('integrateBoilerPower clamps invalid or negative samples to zero', () => {
  assert.equal(integrateBoilerPower(1000, -1000, 3600000), 0.5);
  assert.equal(integrateBoilerPower(Number.NaN, 1000, 3600000), 0.5);
});

test('calculateNextBoilerMeter skips stale samples after long polling gaps', () => {
  const result = calculateNextBoilerMeter({
    currentMeterKWh: 2,
    previousPowerW: 3000,
    currentPowerW: 3000,
    previousSampleAt: 0,
    currentSampleAt: 60000,
    maxElapsedMs: 30000,
  });

  assert.equal(result, 2);
});

test('updateEstimatedBoilerMeter persists sample state and returns next meter value', async () => {
  const store = new Map([
    [STORE_LAST_SAMPLE_AT, 0],
    [STORE_LAST_POWER_W, 3000],
  ]);

  const device = {
    hasCapability: (capability) => capability === 'meter_power',
    getUpdateIntervalMs: () => 3600000,
    getStoreValue: (key) => store.get(key),
    setStoreValue: async (key, value) => store.set(key, value),
    getCapabilityValue: (capability) => capability === 'meter_power' ? 2 : null,
  };

  const result = await updateEstimatedBoilerMeter(device, 3000, 3600000);

  assert.equal(result, 5);
  assert.equal(store.get(STORE_LAST_SAMPLE_AT), 3600000);
  assert.equal(store.get(STORE_LAST_POWER_W), 3000);
  assert.equal(store.get(STORE_METER_KWH), 5);
});
