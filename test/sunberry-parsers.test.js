'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseBatteryValues,
  parseBackupValues,
  parseGridValues,
  parsePvValues,
  parseBoilerValues,
  parseHeatPumpValues,
} = require('../lib/SunberryParsers');

test('parseGridValues extracts phase powers, percentages, and timestamp', () => {
  const html = `
    <div class="form-row"><label>L1:</label><label>811  W</label><label>25  %</label></div>
    <div class="form-row"><label>L2:</label><label>270  W</label><label>8  %</label></div>
    <div class="form-row"><label>L3:</label><label>238  W</label><label>7  %</label></div>
    <div class="form-row"><label>Celkem:</label><label>1319  W</label><label>13  %</label></div>
    <label>29.06.2026 20:43:01</label>`;

  assert.deepEqual(parseGridValues(html), {
    L1: 811,
    L2: 270,
    L3: 238,
    Total: 1319,
    percentages: { L1: 25, L2: 8, L3: 7, Total: 13 },
    timestamp: '29.06.2026 20:43:01',
  });
});

test('parseGridValues treats inverter less-than values as zero', () => {
  const html = `
    <label>L1:</label><label>&lt;30  W</label><label>&lt;1  %</label>
    <label>L2:</label><label><30  W</label><label><1  %</label>
    <label>L3:</label><label>&lt;30  W</label><label>&lt;1  %</label>
    <label>Celkem:</label><label>&lt;30  W</label><label>&lt;1  %</label>`;

  assert.deepEqual(parseGridValues(html), {
    L1: 0,
    L2: 0,
    L3: 0,
    Total: 0,
    percentages: { L1: 0, L2: 0, L3: 0, Total: 0 },
    timestamp: null,
  });
});

test('parseGridValues preserves signed phase powers for import and export calculations', () => {
  const html = `
    <label>L1:</label><label>-120  W</label><label>-4  %</label>
    <label>L2:</label><label>&lt;30  W</label><label>&lt;1  %</label>
    <label>L3:</label><label>60  W</label><label>2  %</label>
    <label>Celkem:</label><label>-60  W</label><label>-2  %</label>`;

  assert.deepEqual(parseGridValues(html), {
    L1: -120,
    L2: 0,
    L3: 60,
    Total: -60,
    percentages: { L1: -4, L2: 0, L3: 2, Total: -2 },
    timestamp: null,
  });
});

test('parseBackupValues extracts backup phase powers, percentages, and timestamp', () => {
  const html = `
    <div class="form-row"><label>L1:</label><label>31  W</label><label>1  %</label></div>
    <div class="form-row"><label>L2:</label><label>42  W</label><label>2  %</label></div>
    <div class="form-row"><label>L3:</label><label>&lt;30  W</label><label>&lt;1  %</label></div>
    <div class="form-row"><label>Celkem:</label><label>73  W</label><label>3  %</label></div>
    <label>29.06.2026 20:43:15</label>`;

  assert.deepEqual(parseBackupValues(html), {
    L1: 31,
    L2: 42,
    L3: 0,
    Total: 73,
    percentages: { L1: 1, L2: 2, L3: 0, Total: 3 },
    timestamp: '29.06.2026 20:43:15',
  });
});

test('parseBatteryValues extracts capacity, state, battery power, limits, and temperature', () => {
  const html = `
    <label>Vybijeni </label>
    <label>Kapacita baterie:</label><label>4397 Wh</label><label>21 %</label>
    <label>Vykon baterie:</label><label>1383 W</label><label>13 %</label>
    <label>Max nabijeni:</label><label>10889 W</label>
    <label>Max vybijeni:</label><label>10889 W</label>
    <label>Teplota baterii:</label><label>42.0 &#176;C</label>
    <label>29.06.2026 20:42:30</label>`;

  assert.deepEqual(parseBatteryValues(html), {
    actual_kWh: 4.397,
    actual_percent: 21,
    state: 'discharging',
    power: 1383,
    power_percent: 13,
    max_charging_power: 10889,
    max_discharging_power: 10889,
    temperature: 42,
    timestamp: '29.06.2026 20:42:30',
  });
});

test('parseBatteryValues does not infer battery state from max power labels', () => {
  const html = `
    <label>Kapacita baterie:</label><label>4397 Wh</label><label>21 %</label>
    <label>Vykon baterie:</label><label>1383 W</label><label>13 %</label>
    <label>Max nabijeni:</label><label>10889 W</label>
    <label>Max vybijeni:</label><label>10889 W</label>`;

  assert.equal(parseBatteryValues(html).state, null);
});

test('parsePvValues extracts PV string powers and percentages', () => {
  const html = `
    <label>Pv1:</label><label>0  W</label><label>0  %</label>
    <label>Pv2:</label><label>1250  W</label><label>31  %</label>
    <label>29.06.2026 20:42:59</label>`;

  assert.deepEqual(parsePvValues(html), {
    pv1: { power: 0, percent: 0 },
    pv2: { power: 1250, percent: 31 },
    total_power: 1250,
    timestamp: '29.06.2026 20:42:59',
  });
});

test('parseBoilerValues handles missing temperature sensor and phase powers', () => {
  const html = `
    <label>Teplotni cidlo:</label><label>Neni pripojeno teplotni cidlo.</label>
    <label>Vykon spiraly:</label>
    <label>L1:</label><label>0.0 %</label><label>0 W</label>
    <label>L2:</label><label>12.5 %</label><label>250 W</label>
    <label>L3:</label><label>0.0 %</label><label>0 W</label>
    <label>29.06.2026 20:43:20</label>`;

  assert.deepEqual(parseBoilerValues(html), {
    temperature_sensor_connected: false,
    temperature: null,
    phases: {
      L1: { percent: 0, power: 0 },
      L2: { percent: 12.5, power: 250 },
      L3: { percent: 0, power: 0 },
    },
    total_power: 250,
    timestamp: '29.06.2026 20:43:20',
  });
});

test('parseHeatPumpValues extracts contact state, SOC, and optional timestamps', () => {
  const html = `
    <label>Stav kontaktu:</label><label>Rozpojeny</label>
    <label>SOC aktualni:</label><label>21 % </label>
    <label>Cas posledniho sepnuti:</label><label>N/A </label>
    <label>Cas posledniho rozpojeni:</label><label>29.06.2026 20:00:00 </label>`;

  assert.deepEqual(parseHeatPumpValues(html), {
    contact_closed: false,
    state: 'open',
    soc_percent: 21,
    last_closed_at: null,
    last_opened_at: '29.06.2026 20:00:00',
  });
});
