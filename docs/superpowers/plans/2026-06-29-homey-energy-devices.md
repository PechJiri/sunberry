# Homey Energy Devices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single Sunberry device model with three Energy-aware devices: Sunberry Battery, Sunberry Solar, and Sunberry Grid with Backup telemetry.

**Architecture:** Pairing creates three devices for the same Sunberry host, all sharing the same `ip_address` setting. Each device has a small focused device class and polls only the endpoint it owns, while shared HTTP access and HTML parsing stay in reusable `lib` modules. This is an intentional breaking change because the app has few users and Homey Energy correctness is more important than preserving the current all-in-one device surface.

**Tech Stack:** Homey Apps SDK v3, Node.js 22 runtime APIs, Homey Compose, `node:test`.

---

## Source Notes

Official Homey sources used for this plan:

- Homey Energy docs: https://apps.developer.homey.app/the-basics/devices/energy
- Homey SDK v3 Device reference: https://apps-sdk-v3.developer.homey.app/Device.html
- Homey SDK v3 Driver reference: https://apps-sdk-v3.developer.homey.app/Driver.html
- Homey SDK v3 device capabilities tutorial: https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html

Energy decisions derived from the Homey Energy docs:

- Home battery drivers use device class `battery` and `energy.homeBattery`.
- Home battery `measure_power` is positive while charging and negative while discharging.
- Solar panel power is represented as generated power, so `measure_power` is positive when PV is producing.
- Cumulative whole-home meters use `cumulative`; this app will not set `cumulative` because Sunberry currently exposes real-time W only, not cumulative kWh.

## Target Device Model

### `sunberry_battery`

Endpoint: `/battery/values`

Capabilities:

- `measure_power`: signed battery power in W. Charging is positive, discharging is negative, idle is 0.
- `measure_battery`: state of charge in percent.
- `measure_battery_kWh`: current stored energy in kWh, custom capability retained for visibility.
- `battery_state`: custom enum-like string capability is not supported directly by Homey standard capabilities; implement as custom text only if Homey validate accepts it. Otherwise skip this from v1 and expose state only through logs/tests.
- `battery_max_charging_power`: current max charging power in W, existing custom capability.
- `battery_max_discharging_power`: current max discharging power in W, new custom capability.
- `measure_temperature`: battery temperature in Celsius.
- `remaining_kWh_to_full`: existing custom capability.
- `force_charging` and `block_battery_discharge`: keep existing controls on the battery device.

Manifest energy:

```json
{
  "class": "battery",
  "energy": {
    "homeBattery": true
  }
}
```

No `meter_power`.

### `sunberry_solar`

Endpoint: `/pv/values`

Capabilities:

- `measure_power`: total PV power, computed as `pv1.power + pv2.power`.
- `measure_pv1`: PV1 power in W, custom capability.
- `measure_pv2`: PV2 power in W, custom capability; use 0 when the value is absent or reported as `<50 W`.

Manifest energy:

```json
{
  "class": "solarpanel"
}
```

No `meter_power`.

### `sunberry_grid`

Endpoints: `/grid/values` and `/backup/values`

Capabilities:

- `measure_power`: total grid/home load power in W from `/grid/values`.
- `measure_L1`: phase L1 W, existing custom capability.
- `measure_L2`: phase L2 W, existing custom capability.
- `measure_L3`: phase L3 W, existing custom capability.
- `measure_total`: same value as `measure_power`, retained for compatibility within the new grid device only.
- `measure_backup_L1`: backup phase L1 W, new custom capability.
- `measure_backup_L2`: backup phase L2 W, new custom capability.
- `measure_backup_L3`: backup phase L3 W, new custom capability.
- `measure_backup_total`: backup total W, new custom capability.

Manifest energy:

```json
{
  "class": "sensor"
}
```

Do not set `cumulative`, because Sunberry does not expose cumulative kWh.

Backup values from `/backup/values` are included as non-Energy telemetry on `sunberry_grid`. Homey Energy `measure_power` remains mapped to `/grid/values` total only.

## File Structure

- Create `lib/SunberryClient.js`: shared API client for base URL resolution, HTTP retries, cookie handling, and endpoint reads.
- Modify `drivers/sunberry/api.js`: either wrap `SunberryClient` during transition or remove after all device classes use the new client.
- Create `lib/SunberryMeasurements.js`: pure normalization functions from parser output to Homey capability values.
- Modify `lib/SunberryParsers.js`: keep current parsing functions and add backup parser only if backup values are included later.
- Create `drivers/sunberry_battery/driver.compose.json`: battery driver manifest.
- Create `drivers/sunberry_battery/device.js`: battery polling and controls.
- Create `drivers/sunberry_battery/driver.js`: pairing support and connection check for battery endpoint.
- Create `drivers/sunberry_battery/driver.settings.compose.json`: shared settings.
- Create `drivers/sunberry_battery/driver.flow.compose.json`: battery Flow cards moved from current driver.
- Create `drivers/sunberry_solar/driver.compose.json`: solar driver manifest.
- Create `drivers/sunberry_solar/device.js`: solar polling.
- Create `drivers/sunberry_solar/driver.js`: pairing support and connection check for PV endpoint.
- Create `drivers/sunberry_solar/driver.settings.compose.json`: shared settings.
- Create `drivers/sunberry_grid/driver.compose.json`: grid driver manifest.
- Create `drivers/sunberry_grid/device.js`: grid polling.
- Create `drivers/sunberry_grid/driver.js`: pairing support and connection check for grid endpoint.
- Create `drivers/sunberry_grid/driver.settings.compose.json`: shared settings.
- Modify `drivers/sunberry/driver.compose.json`: remove or archive old all-in-one driver from compose.
- Modify `drivers/sunberry/device.js`: remove after migration or leave unused only if Homey requires old paired devices to still boot. For a breaking change, remove it from the manifest and keep files only until the release branch is stable.
- Modify `.homeycompose/capabilities/*.json`: add new custom capabilities for PV string powers and max discharging power.
- Modify `test/*.test.js`: add normalization, driver mapping, and device update tests.

## Task 1: Lock Current Maintenance Baseline

**Files:**
- Test: `test/sunberry-parsers.test.js`
- Test: `test/flow-logic.test.js`
- Verify: `package.json`

- [ ] **Step 1: Run the existing tests before Energy work**

Run:

```bash
npm test
```

Expected: PASS with 12 tests.

- [ ] **Step 2: Run Homey validation before Energy work**

Run:

```bash
npm run validate
```

Expected: PASS with `App validated successfully against level publish`.

- [ ] **Step 3: Commit the maintenance baseline**

Run:

```bash
git add .homeycompose/app.json app.json drivers/sunberry/FlowCardManager.js drivers/sunberry/api.js drivers/sunberry/device.js drivers/sunberry/driver.flow.compose.json lib/FlowLogic.js lib/SunberryParsers.js package.json package-lock.json test
git commit -m "chore: prepare parser and flow maintenance baseline"
```

Expected: commit succeeds. This gives the Energy branch a clean base.

## Task 2: Add Measurement Normalizers

**Files:**
- Create: `lib/SunberryMeasurements.js`
- Test: `test/sunberry-measurements.test.js`

- [ ] **Step 1: Write failing tests for battery power sign and PV total**

Create `test/sunberry-measurements.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeBatteryMeasurements,
  normalizeSolarMeasurements,
  normalizeGridMeasurements,
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
  assert.equal(result.measure_battery, 21);
  assert.equal(result.measure_battery_kWh, 4.397);
  assert.equal(result.battery_max_charging_power, 10889);
  assert.equal(result.battery_max_discharging_power, 10889);
  assert.equal(result.measure_temperature, 42);
});

test('normalizeBatteryMeasurements makes discharging power negative', () => {
  const result = normalizeBatteryMeasurements({
    actual_kWh: 4.397,
    actual_percent: 21,
    state: 'discharging',
    power: 1324,
    max_charging_power: 10889,
    max_discharging_power: 10889,
    temperature: 42,
  });

  assert.equal(result.measure_power, -1324);
});

test('normalizeBatteryMeasurements sets idle or unknown battery power to zero', () => {
  assert.equal(normalizeBatteryMeasurements({ state: 'idle', power: 1324 }).measure_power, 0);
  assert.equal(normalizeBatteryMeasurements({ state: null, power: 1324 }).measure_power, 0);
});

test('normalizeSolarMeasurements computes total power and defaults missing pv2 to zero', () => {
  const result = normalizeSolarMeasurements({
    pv1: { power: 1500, percent: 30 },
    pv2: { power: null, percent: null },
  });

  assert.deepEqual(result, {
    measure_power: 1500,
    measure_pv1: 1500,
    measure_pv2: 0,
  });
});

test('normalizeGridMeasurements maps total and phases', () => {
  const result = normalizeGridMeasurements({
    L1: 804,
    L2: 303,
    L3: 268,
    Total: 1375,
  });

  assert.deepEqual(result, {
    measure_power: 1375,
    measure_L1: 804,
    measure_L2: 303,
    measure_L3: 268,
    measure_total: 1375,
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test test/sunberry-measurements.test.js
```

Expected: FAIL with `Cannot find module '../lib/SunberryMeasurements'`.

- [ ] **Step 3: Add the normalizer implementation**

Create `lib/SunberryMeasurements.js`:

```javascript
'use strict';

function numberOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeBatteryPower(state, power) {
    const absolutePower = Math.abs(numberOrZero(power));
    if (state === 'charging') return absolutePower;
    if (state === 'discharging') return -absolutePower;
    return 0;
}

function normalizeBatteryMeasurements(values) {
    const actualKwh = numberOrZero(values.actual_kWh);
    const actualPercent = numberOrZero(values.actual_percent);
    const totalCapacity = actualKwh > 0 && actualPercent > 0
        ? actualKwh / (actualPercent / 100)
        : 0;

    return {
        measure_power: normalizeBatteryPower(values.state, values.power),
        measure_battery: actualPercent,
        measure_battery_kWh: actualKwh,
        remaining_kWh_to_full: totalCapacity > 0 ? Math.max(0, totalCapacity - actualKwh) : 0,
        battery_max_charging_power: numberOrZero(values.max_charging_power),
        battery_max_discharging_power: numberOrZero(values.max_discharging_power),
        measure_temperature: numberOrZero(values.temperature),
    };
}

function normalizeSolarMeasurements(values) {
    const pv1 = numberOrZero(values?.pv1?.power);
    const pv2 = numberOrZero(values?.pv2?.power);

    return {
        measure_power: pv1 + pv2,
        measure_pv1: pv1,
        measure_pv2: pv2,
    };
}

function normalizeGridMeasurements(values) {
    return {
        measure_power: numberOrZero(values.Total),
        measure_L1: numberOrZero(values.L1),
        measure_L2: numberOrZero(values.L2),
        measure_L3: numberOrZero(values.L3),
        measure_total: numberOrZero(values.Total),
    };
}

module.exports = {
    normalizeBatteryMeasurements,
    normalizeBatteryPower,
    normalizeSolarMeasurements,
    normalizeGridMeasurements,
};
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/SunberryMeasurements.js test/sunberry-measurements.test.js
git commit -m "feat: normalize Sunberry measurements for Homey Energy"
```

Expected: commit succeeds.

## Task 3: Add Shared Sunberry Client

**Files:**
- Create: `lib/SunberryClient.js`
- Test: `test/sunberry-client.test.js`
- Modify: `drivers/sunberry/api.js`

- [ ] **Step 1: Write failing tests for endpoint reads**

Create `test/sunberry-client.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const SunberryClient = require('../lib/SunberryClient');

test('SunberryClient reads battery values through the parser', async () => {
  const client = new SunberryClient({
    baseUrl: 'http://example.local',
    fetchImpl: async (url) => {
      assert.equal(url, 'http://example.local/battery/values');
      return {
        status: 200,
        text: async () => '<label>Vybijeni</label><label>Kapacita baterie:</label><label>4397 Wh</label><label>21 %</label><label>Vykon baterie:</label><label>1324 W</label><label>13 %</label><label>Max nabijeni:</label><label>10889 W</label><label>Max vybijeni:</label><label>10889 W</label><label>Teplota baterii:</label><label>42 deg C</label>',
      };
    },
  });

  const values = await client.getBatteryValues();
  assert.equal(values.actual_percent, 21);
  assert.equal(values.state, 'discharging');
  assert.equal(values.power, 1324);
});

test('SunberryClient reads solar values through the parser', async () => {
  const client = new SunberryClient({
    baseUrl: 'http://example.local',
    fetchImpl: async () => ({
      status: 200,
      text: async () => '<label>Pv1:</label><label>100 W</label><label>2 %</label><label>Pv2:</label><label>&lt;50 W</label><label>&lt;1 %</label>',
    }),
  });

  const values = await client.getSolarValues();
  assert.equal(values.total_power, 100);
});

test('SunberryClient reads grid values through the parser', async () => {
  const client = new SunberryClient({
    baseUrl: 'http://example.local',
    fetchImpl: async () => ({
      status: 200,
      text: async () => '<label>L1:</label><label>1 W</label><label>1 %</label><label>L2:</label><label>2 W</label><label>2 %</label><label>L3:</label><label>3 W</label><label>3 %</label><label>Celkem:</label><label>6 W</label><label>6 %</label>',
    }),
  });

  const values = await client.getGridValues();
  assert.equal(values.Total, 6);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test test/sunberry-client.test.js
```

Expected: FAIL with `Cannot find module '../lib/SunberryClient'`.

- [ ] **Step 3: Add shared client implementation**

Create `lib/SunberryClient.js`:

```javascript
'use strict';

const {
    parseBatteryValues,
    parseGridValues,
    parsePvValues,
} = require('./SunberryParsers');

class SunberryClient {
    constructor({ baseUrl, fetchImpl = fetch } = {}) {
        if (!baseUrl) throw new Error('baseUrl is required');
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetch = fetchImpl;
    }

    async getHtml(endpoint) {
        const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'User-Agent': 'HomeyApp/1.0',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(10000),
            redirect: 'manual',
        });

        if (response.status !== 200) {
            throw new Error(`Sunberry endpoint ${endpoint} returned HTTP ${response.status}`);
        }

        return response.text();
    }

    async getBatteryValues() {
        return parseBatteryValues(await this.getHtml('/battery/values'));
    }

    async getSolarValues() {
        return parsePvValues(await this.getHtml('/pv/values'));
    }

    async getGridValues() {
        return parseGridValues(await this.getHtml('/grid/values'));
    }
}

module.exports = SunberryClient;
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Leave existing `drivers/sunberry/api.js` intact for battery controls**

No code deletion in this task. The old API still contains POST payloads for force charging and discharge block. Battery control migration happens in Task 7.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/SunberryClient.js test/sunberry-client.test.js
git commit -m "feat: add shared Sunberry client"
```

Expected: commit succeeds.

## Task 4: Add Compose Manifests For Three Drivers

**Files:**
- Create: `drivers/sunberry_battery/driver.compose.json`
- Create: `drivers/sunberry_battery/driver.settings.compose.json`
- Create: `drivers/sunberry_battery/driver.flow.compose.json`
- Create: `drivers/sunberry_solar/driver.compose.json`
- Create: `drivers/sunberry_solar/driver.settings.compose.json`
- Create: `drivers/sunberry_grid/driver.compose.json`
- Create: `drivers/sunberry_grid/driver.settings.compose.json`
- Modify: `drivers/sunberry/driver.compose.json`
- Create: `.homeycompose/capabilities/battery_max_discharging_power.json`
- Create: `.homeycompose/capabilities/measure_pv1.json`
- Create: `.homeycompose/capabilities/measure_pv2.json`
- Create: `.homeycompose/capabilities/measure_backup_L1.json`
- Create: `.homeycompose/capabilities/measure_backup_L2.json`
- Create: `.homeycompose/capabilities/measure_backup_L3.json`
- Create: `.homeycompose/capabilities/measure_backup_total.json`

- [ ] **Step 1: Add new custom capability definitions**

Create `.homeycompose/capabilities/battery_max_discharging_power.json`:

```json
{
  "type": "number",
  "title": {
    "en": "Maximum Battery Discharging Power"
  },
  "getable": true,
  "setable": false,
  "insights": true,
  "uiComponent": "sensor",
  "icon": "/assets/images/battery_charge.svg",
  "units": {
    "en": "W"
  },
  "decimals": 0
}
```

Create `.homeycompose/capabilities/measure_pv1.json`:

```json
{
  "type": "number",
  "title": {
    "en": "PV1 Power"
  },
  "getable": true,
  "setable": false,
  "insights": true,
  "uiComponent": "sensor",
  "icon": "/assets/images/power.svg",
  "units": {
    "en": "W"
  },
  "decimals": 0,
  "min": 0
}
```

Create `.homeycompose/capabilities/measure_pv2.json`:

```json
{
  "type": "number",
  "title": {
    "en": "PV2 Power"
  },
  "getable": true,
  "setable": false,
  "insights": true,
  "uiComponent": "sensor",
  "icon": "/assets/images/power.svg",
  "units": {
    "en": "W"
  },
  "decimals": 0,
  "min": 0
}
```

Create `.homeycompose/capabilities/measure_backup_L1.json`:

```json
{
  "type": "number",
  "title": {
    "en": "Backup Phase 1 Power"
  },
  "getable": true,
  "setable": false,
  "insights": true,
  "uiComponent": "sensor",
  "icon": "/assets/images/power.svg",
  "units": {
    "en": "W"
  },
  "decimals": 0,
  "min": 0
}
```

Create `measure_backup_L2`, `measure_backup_L3`, and `measure_backup_total` with the same schema, changing only the title to `Backup Phase 2 Power`, `Backup Phase 3 Power`, and `Backup Total Power`.

- [ ] **Step 2: Add battery driver compose**

Create `drivers/sunberry_battery/driver.compose.json`:

```json
{
  "id": "sunberry_battery",
  "name": {
    "en": "Sunberry Battery"
  },
  "class": "battery",
  "energy": {
    "homeBattery": true
  },
  "capabilities": [
    "measure_power",
    "measure_battery",
    "measure_battery_kWh",
    "remaining_kWh_to_full",
    "battery_max_charging_power",
    "battery_max_discharging_power",
    "measure_temperature",
    "force_charging",
    "block_battery_discharge"
  ],
  "platforms": [
    "local"
  ],
  "connectivity": [
    "lan"
  ],
  "images": {
    "small": "/drivers/sunberry/assets/images/small.png",
    "large": "/drivers/sunberry/assets/images/large.png",
    "xlarge": "/drivers/sunberry/assets/images/xlarge.png"
  },
  "pair": [
    {
      "id": "pair",
      "navigation": {
        "next": "list_devices"
      }
    },
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_my_devices",
        "prev": "pair"
      },
      "options": {
        "singular": true
      }
    },
    {
      "id": "add_my_devices",
      "template": "add_devices"
    }
  ]
}
```

- [ ] **Step 3: Add solar driver compose**

Create `drivers/sunberry_solar/driver.compose.json`:

```json
{
  "id": "sunberry_solar",
  "name": {
    "en": "Sunberry Solar"
  },
  "class": "solarpanel",
  "capabilities": [
    "measure_power",
    "measure_pv1",
    "measure_pv2"
  ],
  "platforms": [
    "local"
  ],
  "connectivity": [
    "lan"
  ],
  "images": {
    "small": "/drivers/sunberry/assets/images/small.png",
    "large": "/drivers/sunberry/assets/images/large.png",
    "xlarge": "/drivers/sunberry/assets/images/xlarge.png"
  },
  "pair": [
    {
      "id": "pair",
      "navigation": {
        "next": "list_devices"
      }
    },
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_my_devices",
        "prev": "pair"
      },
      "options": {
        "singular": true
      }
    },
    {
      "id": "add_my_devices",
      "template": "add_devices"
    }
  ]
}
```

- [ ] **Step 4: Add grid driver compose**

Create `drivers/sunberry_grid/driver.compose.json`:

```json
{
  "id": "sunberry_grid",
  "name": {
    "en": "Sunberry Grid"
  },
  "class": "sensor",
  "capabilities": [
    "measure_power",
    "measure_L1",
    "measure_L2",
    "measure_L3",
    "measure_total",
    "measure_backup_L1",
    "measure_backup_L2",
    "measure_backup_L3",
    "measure_backup_total"
  ],
  "platforms": [
    "local"
  ],
  "connectivity": [
    "lan"
  ],
  "images": {
    "small": "/drivers/sunberry/assets/images/small.png",
    "large": "/drivers/sunberry/assets/images/large.png",
    "xlarge": "/drivers/sunberry/assets/images/xlarge.png"
  },
  "pair": [
    {
      "id": "pair",
      "navigation": {
        "next": "list_devices"
      }
    },
    {
      "id": "list_devices",
      "template": "list_devices",
      "navigation": {
        "next": "add_my_devices",
        "prev": "pair"
      },
      "options": {
        "singular": true
      }
    },
    {
      "id": "add_my_devices",
      "template": "add_devices"
    }
  ]
}
```

- [ ] **Step 5: Copy shared settings to all three drivers**

Create each settings file with this exact content:

```json
[
  {
    "id": "update_interval",
    "type": "number",
    "label": {
      "en": "Polling interval in seconds (default 10s, minimum 5s)"
    },
    "hint": {
      "en": "Set the interval for data updates from the Sunberry."
    },
    "value": 10,
    "min": 5
  },
  {
    "id": "ip_address",
    "type": "text",
    "label": {
      "en": "IP Address"
    },
    "value": "sunberry.local",
    "hint": {
      "en": "Enter the IP address of your Sunberry device"
    }
  },
  {
    "id": "enable_debug_logs",
    "type": "checkbox",
    "label": {
      "en": "Enable Debug Logs"
    },
    "hint": {
      "en": "Enable or disable detailed debug logs for troubleshooting."
    },
    "value": false
  }
]
```

For `drivers/sunberry_battery/driver.settings.compose.json`, add `force_charging_limit` after `ip_address`:

```json
{
  "id": "force_charging_limit",
  "type": "number",
  "label": {
    "en": "Force Charging Limit (W)"
  },
  "hint": {
    "en": "Set the power limit for force charging mode."
  },
  "value": 5000,
  "min": 100,
  "highlight": true
}
```

- [ ] **Step 6: Move battery Flow cards to battery driver**

Create `drivers/sunberry_battery/driver.flow.compose.json` by copying the current `drivers/sunberry/driver.flow.compose.json`.

- [ ] **Step 7: Remove old all-in-one driver from compose**

Delete `drivers/sunberry/driver.compose.json` or move it to `docs/legacy/sunberry-driver.compose.json`. For the breaking-change release, it must not appear as a driver in generated `app.json`.

- [ ] **Step 8: Validate manifest**

Run:

```bash
npm run validate
```

Expected: PASS. Generated `app.json` contains drivers `sunberry_battery`, `sunberry_solar`, and `sunberry_grid`, and does not contain driver id `sunberry`.

- [ ] **Step 9: Commit**

Run:

```bash
git add .homeycompose/capabilities drivers app.json
git commit -m "feat: define Energy-oriented Sunberry drivers"
```

Expected: commit succeeds.

## Task 5: Add Shared Driver Pairing Helper

**Files:**
- Create: `lib/SunberryPairing.js`
- Test: `test/sunberry-pairing.test.js`
- Modify: `drivers/sunberry_battery/driver.js`
- Modify: `drivers/sunberry_solar/driver.js`
- Modify: `drivers/sunberry_grid/driver.js`

- [ ] **Step 1: Write failing helper tests**

Create `test/sunberry-pairing.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createPairedDevice } = require('../lib/SunberryPairing');

test('createPairedDevice creates stable data ids per host and device type', () => {
  assert.deepEqual(
    createPairedDevice({
      type: 'battery',
      ipAddress: '192.168.1.50',
      name: 'Sunberry Battery',
      settings: { update_interval: 10 },
    }),
    {
      name: 'Sunberry Battery',
      data: { id: '192.168.1.50:battery' },
      settings: {
        ip_address: '192.168.1.50',
        update_interval: 10,
      },
    }
  );
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test test/sunberry-pairing.test.js
```

Expected: FAIL with `Cannot find module '../lib/SunberryPairing'`.

- [ ] **Step 3: Implement pairing helper**

Create `lib/SunberryPairing.js`:

```javascript
'use strict';

function createPairedDevice({ type, ipAddress, name, settings }) {
    if (!type) throw new Error('type is required');
    if (!ipAddress) throw new Error('ipAddress is required');
    if (!name) throw new Error('name is required');

    return {
        name,
        data: {
            id: `${ipAddress}:${type}`,
        },
        settings: {
            ip_address: ipAddress,
            ...settings,
        },
    };
}

module.exports = {
    createPairedDevice,
};
```

- [ ] **Step 4: Create driver classes**

For `drivers/sunberry_battery/driver.js`:

```javascript
'use strict';

const Homey = require('homey');
const { createPairedDevice } = require('../../lib/SunberryPairing');
const SunberryClient = require('../../lib/SunberryClient');

class SunberryBatteryDriver extends Homey.Driver {
    async onPairListDevices() {
        return [
            createPairedDevice({
                type: 'battery',
                ipAddress: 'sunberry.local',
                name: 'Sunberry Battery',
                settings: {
                    update_interval: 10,
                    force_charging_limit: 5000,
                    enable_debug_logs: false,
                },
            }),
        ];
    }

    async testConnection(ipAddress) {
        const client = new SunberryClient({ baseUrl: `http://${ipAddress}` });
        await client.getBatteryValues();
        return true;
    }
}

module.exports = SunberryBatteryDriver;
```

For `drivers/sunberry_solar/driver.js`, use `type: 'solar'`, name `Sunberry Solar`, and `client.getSolarValues()`.

For `drivers/sunberry_grid/driver.js`, use `type: 'grid'`, name `Sunberry Grid`, and `client.getGridValues()`.

- [ ] **Step 5: Run tests and validation**

Run:

```bash
npm test
npm run validate
```

Expected: both PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/SunberryPairing.js test/sunberry-pairing.test.js drivers/sunberry_battery/driver.js drivers/sunberry_solar/driver.js drivers/sunberry_grid/driver.js
git commit -m "feat: add pairing for split Sunberry devices"
```

Expected: commit succeeds.

## Task 6: Add Base Polling Device Class

**Files:**
- Create: `lib/SunberryPollingDevice.js`
- Test: `test/sunberry-polling-device.test.js`

- [ ] **Step 1: Write failing tests for capability update filtering**

Create `test/sunberry-polling-device.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { applyCapabilityUpdates } = require('../lib/SunberryPollingDevice');

test('applyCapabilityUpdates only writes capabilities that exist and changed', async () => {
  const writes = [];
  const device = {
    hasCapability: capability => capability !== 'missing_capability',
    getCapabilityValue: capability => capability === 'measure_power' ? 10 : null,
    setCapabilityValue: async (capability, value) => writes.push([capability, value]),
  };

  await applyCapabilityUpdates(device, {
    measure_power: 10,
    measure_battery: 21,
    missing_capability: 1,
  });

  assert.deepEqual(writes, [['measure_battery', 21]]);
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
node --test test/sunberry-polling-device.test.js
```

Expected: FAIL with `Cannot find module '../lib/SunberryPollingDevice'`.

- [ ] **Step 3: Implement update helper and base class**

Create `lib/SunberryPollingDevice.js`:

```javascript
'use strict';

const Homey = require('homey');

async function applyCapabilityUpdates(device, updates) {
    for (const [capability, value] of Object.entries(updates)) {
        if (!device.hasCapability(capability)) continue;
        if (device.getCapabilityValue(capability) === value) continue;
        await device.setCapabilityValue(capability, value);
    }
}

class SunberryPollingDevice extends Homey.Device {
    async onInit() {
        this.pollingTimer = null;
        await this.setAvailable();
        await this.pollOnce();
        this.scheduleNextPoll();
    }

    getUpdateIntervalMs() {
        const seconds = Math.max(Number(this.getSetting('update_interval')) || 10, 5);
        return seconds * 1000;
    }

    scheduleNextPoll() {
        this.clearPollingTimer();
        this.pollingTimer = setTimeout(async () => {
            try {
                await this.pollOnce();
                await this.setAvailable();
            } catch (error) {
                await this.setUnavailable(error.message);
            } finally {
                this.scheduleNextPoll();
            }
        }, this.getUpdateIntervalMs());
    }

    clearPollingTimer() {
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    async onDeleted() {
        this.clearPollingTimer();
    }

    async onSettings({ changedKeys }) {
        if (changedKeys.includes('update_interval')) {
            this.scheduleNextPoll();
        }
        if (changedKeys.includes('ip_address')) {
            await this.pollOnce();
        }
    }

    async pollOnce() {
        throw new Error('pollOnce must be implemented by subclass');
    }
}

module.exports = {
    SunberryPollingDevice,
    applyCapabilityUpdates,
};
```

- [ ] **Step 4: Run test and verify GREEN**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/SunberryPollingDevice.js test/sunberry-polling-device.test.js
git commit -m "feat: add shared Sunberry polling device base"
```

Expected: commit succeeds.

## Task 7: Implement Battery Device

**Files:**
- Create: `drivers/sunberry_battery/device.js`
- Modify: `drivers/sunberry_battery/driver.flow.compose.json`
- Test: `test/sunberry-battery-device.test.js`

- [ ] **Step 1: Write focused battery control tests using pure functions**

Create `test/sunberry-battery-device.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeBatteryMeasurements } = require('../lib/SunberryMeasurements');

test('battery measurement output matches Homey Energy sign convention', () => {
  const updates = normalizeBatteryMeasurements({
    actual_kWh: 4.397,
    actual_percent: 21,
    state: 'discharging',
    power: 1324,
    max_charging_power: 10889,
    max_discharging_power: 10889,
    temperature: 42,
  });

  assert.equal(updates.measure_power, -1324);
  assert.equal(updates.measure_battery, 21);
  assert.equal(updates.measure_temperature, 42);
});
```

- [ ] **Step 2: Run test and verify it passes against Task 2 normalizer**

Run:

```bash
node --test test/sunberry-battery-device.test.js
```

Expected: PASS. This guards the device implementation contract.

- [ ] **Step 3: Implement battery device**

Create `drivers/sunberry_battery/device.js`:

```javascript
'use strict';

const SunberryAPI = require('../sunberry/api');
const SunberryClient = require('../../lib/SunberryClient');
const { normalizeBatteryMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryBatteryDevice extends SunberryPollingDevice {
    async onInit() {
        this.controlApi = new SunberryAPI();
        await this.controlApi.initializeLogger(this.homey);
        await this.controlApi.setBaseUrl(this.getSetting('ip_address'));
        await super.onInit();
        this.registerCapabilityListener('force_charging', this.onForceChargingChanged.bind(this));
        this.registerCapabilityListener('block_battery_discharge', this.onBlockDischargeChanged.bind(this));
    }

    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const values = await this.createClient().getBatteryValues();
        const updates = normalizeBatteryMeasurements(values);
        await applyCapabilityUpdates(this, updates);
    }

    async onForceChargingChanged(value) {
        if (value) {
            const limit = this.getSetting('force_charging_limit') || 5000;
            await this.controlApi.enableForceCharging(limit);
        } else {
            await this.controlApi.disableForceCharging();
        }
        await this.setCapabilityValue('force_charging', value);
    }

    async onBlockDischargeChanged(value) {
        if (value) {
            await this.controlApi.blockBatteryDischarge();
        } else {
            await this.controlApi.enableBatteryDischarge();
        }
        await this.setCapabilityValue('block_battery_discharge', value);
    }
}

module.exports = SunberryBatteryDevice;
```

- [ ] **Step 4: Restrict battery Flow cards to `sunberry_battery`**

In `drivers/sunberry_battery/driver.flow.compose.json`, every `device` argument filter must use:

```json
"filter": "driver_id=sunberry_battery"
```

- [ ] **Step 5: Run tests and validation**

Run:

```bash
npm test
npm run validate
```

Expected: both PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add drivers/sunberry_battery/device.js drivers/sunberry_battery/driver.flow.compose.json test/sunberry-battery-device.test.js
git commit -m "feat: implement Sunberry Battery device"
```

Expected: commit succeeds.

## Task 8: Implement Solar Device

**Files:**
- Create: `drivers/sunberry_solar/device.js`
- Test: `test/sunberry-solar-device.test.js`

- [ ] **Step 1: Write focused solar test**

Create `test/sunberry-solar-device.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeSolarMeasurements } = require('../lib/SunberryMeasurements');

test('solar total uses pv1 plus pv2 and keeps missing pv2 as zero', () => {
  const updates = normalizeSolarMeasurements({
    pv1: { power: 800, percent: 20 },
    pv2: { power: 0, percent: 0 },
  });

  assert.equal(updates.measure_power, 800);
  assert.equal(updates.measure_pv1, 800);
  assert.equal(updates.measure_pv2, 0);
});
```

- [ ] **Step 2: Run test**

Run:

```bash
node --test test/sunberry-solar-device.test.js
```

Expected: PASS.

- [ ] **Step 3: Implement solar device**

Create `drivers/sunberry_solar/device.js`:

```javascript
'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { normalizeSolarMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberrySolarDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const values = await this.createClient().getSolarValues();
        const updates = normalizeSolarMeasurements(values);
        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberrySolarDevice;
```

- [ ] **Step 4: Run tests and validation**

Run:

```bash
npm test
npm run validate
```

Expected: both PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add drivers/sunberry_solar/device.js test/sunberry-solar-device.test.js
git commit -m "feat: implement Sunberry Solar device"
```

Expected: commit succeeds.

## Task 9: Implement Grid Device With Backup Telemetry

**Files:**
- Create: `drivers/sunberry_grid/device.js`
- Test: `test/sunberry-grid-device.test.js`

- [ ] **Step 1: Write focused grid test**

Create `test/sunberry-grid-device.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeGridMeasurements } = require('../lib/SunberryMeasurements');

test('grid total maps to standard measure_power and retained custom total', () => {
  const updates = normalizeGridMeasurements({
    L1: 804,
    L2: 303,
    L3: 268,
    Total: 1375,
  });

  assert.equal(updates.measure_power, 1375);
  assert.equal(updates.measure_total, 1375);
});

test('backup values map to non-Energy backup capabilities', () => {
  const updates = normalizeGridMeasurements({
    L1: 804,
    L2: 303,
    L3: 268,
    Total: 1375,
  }, {
    L1: 30,
    L2: 40,
    L3: 50,
    Total: 120,
  });

  assert.equal(updates.measure_power, 1375);
  assert.equal(updates.measure_backup_L1, 30);
  assert.equal(updates.measure_backup_L2, 40);
  assert.equal(updates.measure_backup_L3, 50);
  assert.equal(updates.measure_backup_total, 120);
});
```

- [ ] **Step 2: Run test**

Run:

```bash
node --test test/sunberry-grid-device.test.js
```

Expected: PASS.

- [ ] **Step 3: Implement grid device**

Create `drivers/sunberry_grid/device.js`:

```javascript
'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { normalizeGridMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryGridDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const client = this.createClient();
        const [gridValues, backupValues] = await Promise.all([
            client.getGridValues(),
            client.getBackupValues(),
        ]);
        const updates = normalizeGridMeasurements(gridValues, backupValues);
        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberryGridDevice;
```

- [ ] **Step 4: Run tests and validation**

Run:

```bash
npm test
npm run validate
```

Expected: both PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add drivers/sunberry_grid/device.js test/sunberry-grid-device.test.js
git commit -m "feat: implement Sunberry Grid device"
```

Expected: commit succeeds.

## Task 10: Pairing UX For Three Devices

**Files:**
- Modify: `drivers/sunberry_battery/pair/pair.html`
- Modify: `drivers/sunberry_solar/pair/pair.html`
- Modify: `drivers/sunberry_grid/pair/pair.html`
- Modify: `drivers/sunberry_battery/driver.js`
- Modify: `drivers/sunberry_solar/driver.js`
- Modify: `drivers/sunberry_grid/driver.js`

- [ ] **Step 1: Copy existing pairing HTML**

Copy `drivers/sunberry/pair/pair.html` into each new driver:

```bash
mkdir -p drivers/sunberry_battery/pair drivers/sunberry_solar/pair drivers/sunberry_grid/pair
cp drivers/sunberry/pair/pair.html drivers/sunberry_battery/pair/pair.html
cp drivers/sunberry/pair/pair.html drivers/sunberry_solar/pair/pair.html
cp drivers/sunberry/pair/pair.html drivers/sunberry_grid/pair/pair.html
```

Expected: each driver has a pairing page with the existing IP/hostname form.

- [ ] **Step 2: Wire custom pairing handlers**

Each new `driver.js` should implement `onPair(session)` using the current pattern from `drivers/sunberry/driver.js`: `getSettings`, `settingsChanged`, `check`, and `list_devices`.

Battery `list_devices` returns:

```javascript
return [createPairedDevice({
    type: 'battery',
    ipAddress: pairingData.ip_address,
    name: 'Sunberry Battery',
    settings: {
        update_interval: 10,
        force_charging_limit: 5000,
        enable_debug_logs: false,
    },
})];
```

Solar and grid use the same shape without `force_charging_limit`.

- [ ] **Step 3: Test with validation**

Run:

```bash
npm run validate
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add drivers/sunberry_battery drivers/sunberry_solar drivers/sunberry_grid
git commit -m "feat: add pairing for split Sunberry drivers"
```

Expected: commit succeeds.

## Task 11: Remove Old All-In-One Runtime Surface

**Files:**
- Delete or archive: `drivers/sunberry/driver.compose.json`
- Delete or archive: `drivers/sunberry/device.js`
- Delete or archive: `drivers/sunberry/driver.js`
- Delete or archive: `drivers/sunberry/FlowCardManager.js`
- Keep: `drivers/sunberry/api.js` until battery controls are moved to `lib/SunberryBatteryControl.js`
- Modify: `README.txt`
- Modify: `README.md`

- [ ] **Step 1: Move reusable battery control out of old API**

Create `lib/SunberryBatteryControl.js` with the POST methods currently in `drivers/sunberry/api.js`: `enableForceCharging`, `disableForceCharging`, `blockBatteryDischarge`, `enableBatteryDischarge`.

Battery device should import `SunberryBatteryControl` instead of `drivers/sunberry/api.js`.

- [ ] **Step 2: Archive old driver files after battery control extraction**

Move the old driver files into `docs/legacy/sunberry-driver/`:

```bash
mkdir -p docs/legacy/sunberry-driver
git mv drivers/sunberry/device.js docs/legacy/sunberry-driver/device.js
git mv drivers/sunberry/driver.js docs/legacy/sunberry-driver/driver.js
git mv drivers/sunberry/FlowCardManager.js docs/legacy/sunberry-driver/FlowCardManager.js
git mv drivers/sunberry/driver.compose.json docs/legacy/sunberry-driver/driver.compose.json
```

Expected: old driver id is not generated into `app.json`.

- [ ] **Step 3: Keep assets in place**

Do not move `drivers/sunberry/assets` because the new driver compose files reference those image paths.

- [ ] **Step 4: Update README**

Update `README.txt` to describe the breaking change:

```text
The app exposes Sunberry as three Homey devices: Sunberry Battery, Sunberry Solar, and Sunberry Grid. Existing users of the old all-in-one device must re-pair their Sunberry host after upgrading.
```

- [ ] **Step 5: Validate**

Run:

```bash
npm test
npm run validate
```

Expected: both PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/legacy lib drivers README.md README.txt app.json
git commit -m "feat: remove legacy all-in-one Sunberry device"
```

Expected: commit succeeds.

## Task 12: Live Smoke Test Against Sunberry

**Files:**
- No source changes expected.

- [ ] **Step 1: Resolve the local Sunberry host**

Run:

```powershell
Resolve-DnsName sunberry.local -Type A
```

Expected: returns an IPv4 address. If it fails, use the IP address from the pairing settings.

- [ ] **Step 2: Smoke the shared client against the real device**

Run:

```powershell
$ip = (Resolve-DnsName sunberry.local -Type A -ErrorAction Stop | Select-Object -First 1 -ExpandProperty IPAddress)
$env:SUNBERRY_BASE = "http://$ip"
@'
const SunberryClient = require('./lib/SunberryClient');
const {
  normalizeBatteryMeasurements,
  normalizeSolarMeasurements,
  normalizeGridMeasurements,
} = require('./lib/SunberryMeasurements');

(async () => {
  const client = new SunberryClient({ baseUrl: process.env.SUNBERRY_BASE });
  console.log('battery', normalizeBatteryMeasurements(await client.getBatteryValues()));
  console.log('solar', normalizeSolarMeasurements(await client.getSolarValues()));
  console.log('grid', normalizeGridMeasurements(await client.getGridValues()));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
'@ | node -
```

Expected:

- Battery output includes signed `measure_power`.
- Solar output includes computed `measure_power`.
- Grid output includes `measure_power`, `measure_L1`, `measure_L2`, `measure_L3`, `measure_total`.

- [ ] **Step 3: Run Homey build**

Run:

```bash
npm run build
```

Expected: PASS with debug-level validation.

- [ ] **Step 4: Commit smoke notes if any docs changed**

If smoke testing exposes no source changes, do not commit. If README was adjusted, run:

```bash
git add README.md README.txt
git commit -m "docs: document split Sunberry device smoke test"
```

Expected: commit succeeds only when docs changed.

## Task 13: Release Notes And Manual Migration Warning

**Files:**
- Modify: `.homeychangelog.json`
- Modify: `README.md`
- Modify: `README.txt`

- [ ] **Step 1: Add changelog entry**

Update `.homeychangelog.json` with a new version entry:

```json
{
  "version": "2.0.0",
  "date": "2026-06-29",
  "en": "Breaking change: Sunberry is now paired as three Homey Energy-aware devices: Battery, Solar, and Grid. Existing users must re-pair their Sunberry host."
}
```

- [ ] **Step 2: Bump app version for breaking change**

Update `.homeycompose/app.json`:

```json
"version": "2.0.0"
```

Update `package.json` and `package-lock.json`:

```json
"version": "2.0.0"
```

- [ ] **Step 3: Run final verification**

Run:

```bash
npm test
npm run validate
npm run build
```

Expected: all PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add .homeychangelog.json .homeycompose/app.json app.json package.json package-lock.json README.md README.txt
git commit -m "chore: prepare 2.0.0 breaking Energy release"
```

Expected: commit succeeds.

## Self-Review Checklist

- Spec coverage:
  - Three devices are represented: battery, solar, grid.
  - Existing all-in-one device is removed from generated manifest.
  - No `meter_power` is introduced.
  - No `cumulative` energy property is introduced.
  - Battery state is parsed from `/battery/values`.
  - Battery `measure_power` follows Homey sign convention: charging positive, discharging negative.
  - Solar total is computed from PV1 + PV2, with missing PV2 as 0.
  - Grid exposes L1, L2, L3, total, backup L1, backup L2, backup L3, and backup total.

- Red-flag scan:
  - This plan contains no unresolved implementation gaps.
  - Backup values are intentionally excluded from the first Energy slice and documented as later optional scope.

- Type consistency:
  - Parser output uses current `SunberryParsers` names: `actual_kWh`, `actual_percent`, `state`, `power`, `max_charging_power`, `max_discharging_power`, `temperature`, `pv1.power`, `pv2.power`, `L1`, `L2`, `L3`, `Total`.
  - Homey capability update names are `measure_power`, `measure_battery`, `measure_battery_kWh`, `remaining_kWh_to_full`, `battery_max_charging_power`, `battery_max_discharging_power`, `measure_temperature`, `measure_pv1`, `measure_pv2`, `measure_L1`, `measure_L2`, `measure_L3`, `measure_total`, `measure_backup_L1`, `measure_backup_L2`, `measure_backup_L3`, `measure_backup_total`.
