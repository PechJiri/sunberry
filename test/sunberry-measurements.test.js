'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeBatteryMeasurements,
  normalizeSolarMeasurements,
  normalizeGridMeasurements,
  normalizeSmartContactMeasurements,
} = require('../lib/SunberryMeasurements');

test('normalizeBatteryMeasurements makes charging power positive', () => {
  const result = normalizeBatteryMeasurements({
    actual_kWh: 4.397,
    actual_percent: 21,
    state: 'charging',
    power: 1324,
    max_charging_power: 10889,
    max_discharging_power: 10889,
    temperature: 42,
  });

  assert.equal(result.measure_power, 1324);
  assert.equal(result.battery_charging_state, 'charging');
  assert.equal(result.measure_battery, 21);
  assert.equal(result.stored_energy_kWh, 4.397);
  assert.equal(result.remaining_kWh_to_full, 16.54);
  assert.equal(result.battery_max_charging_power, 10889);
  assert.equal(result.measure_temperature, 42);
});

test('normalizeBatteryMeasurements makes discharging power negative', () => {
  const result = normalizeBatteryMeasurements({
    actual_kWh: 4.397,
    actual_percent: 21,
    state: 'discharging',
    power: 1324,
  });

  assert.equal(result.measure_power, -1324);
  assert.equal(result.battery_charging_state, 'discharging');
});

test('normalizeBatteryMeasurements sets idle or unknown battery power to zero', () => {
  assert.equal(normalizeBatteryMeasurements({ state: 'idle', power: 1324 }).measure_power, 0);
  assert.equal(normalizeBatteryMeasurements({ state: null, power: 1324 }).measure_power, 0);
  assert.equal(normalizeBatteryMeasurements({ state: 'idle', power: 1324 }).battery_charging_state, 'idle');
  assert.equal(normalizeBatteryMeasurements({ state: null, power: 1324 }).battery_charging_state, 'idle');
});

test('normalizeSolarMeasurements computes total power and defaults missing pv2 to zero', () => {
  assert.deepEqual(normalizeSolarMeasurements({
    pv1: { power: 1500, percent: 30 },
    pv2: { power: null, percent: null },
  }), {
    measure_power: 1500,
    measure_pv1: 1500,
    measure_pv2: 0,
  });
});

test('normalizeGridMeasurements maps grid and backup values separately', () => {
  assert.deepEqual(normalizeGridMeasurements({
    L1: 804,
    L2: 303,
    L3: 268,
    Total: 1375,
  }, {
    L1: 30,
    L2: 40,
    L3: 50,
    Total: 120,
  }), {
    measure_L1: 804,
    measure_L2: 303,
    measure_L3: 268,
    measure_total: 1375,
    measure_backup_L1: 30,
    measure_backup_L2: 40,
    measure_backup_L3: 50,
    measure_backup_total: 120,
  });
});

test('normalizeSmartContactMeasurements maps contact state and timestamps', () => {
  assert.deepEqual(normalizeSmartContactMeasurements({
    contact_closed: false,
    last_closed_at: '30.06.2026 20:17:41',
    last_opened_at: '30.06.2026 20:21:25',
  }), {
    smart_contact_closed: false,
    smart_contact_last_closed_at: '30.06.2026 20:17:41',
    smart_contact_last_opened_at: '30.06.2026 20:21:25',
  });
});
