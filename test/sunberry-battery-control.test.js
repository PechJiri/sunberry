'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildEnableForceChargingPayload,
  buildDisableForceChargingPayload,
  buildBlockBatteryDischargePayload,
  buildEnableBatteryDischargePayload,
} = require('../lib/SunberryBatteryControl');
const SunberryBatteryControl = require('../lib/SunberryBatteryControl');

test('battery control payloads preserve legacy timer fields', () => {
  assert.deepEqual(buildEnableForceChargingPayload(5000), {
    start_0: '00:00',
    stop_0: '23:59',
    force_chg_enable_0: 'on',
    force_chg_power_0: '5000',
    Mon_0: 'Mon_0',
    Tue_0: 'Tue_0',
    Wed_0: 'Wed_0',
    Thu_0: 'Thu_0',
    Fri_0: 'Fri_0',
    Sat_0: 'Sat_0',
    Sun_0: 'Sun_0',
    submit: '',
  });

  assert.equal(buildDisableForceChargingPayload(7000).force_chg_power_0, '7000');
  assert.equal(buildBlockBatteryDischargePayload().block_bat_dis_0, 'on');
  assert.equal(buildEnableBatteryDischargePayload().force_chg_power_0, '100');
});

test('battery control requires configured base URL before posting', async () => {
  const control = new SunberryBatteryControl({
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
    cookieManager: {
      getCookie: async () => 'cookie',
    },
  });

  await assert.rejects(
    () => control.enableForceCharging(5000),
    /base URL is not configured/
  );
});
