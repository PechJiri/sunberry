'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { registerBatteryFlowCards } = require('../lib/BatteryFlowCards');

function createFlowMock() {
  const cards = new Map();
  const registrations = [];

  function getCard(type, id) {
    const key = `${type}:${id}`;
    if (!cards.has(key)) {
      cards.set(key, {
        id,
        type,
        listener: null,
        registerRunListener(listener) {
          registrations.push(key);
          this.listener = listener;
        },
      });
    }
    return cards.get(key);
  }

  return {
    registrations,
    cards,
    flow: {
      getDeviceTriggerCard: id => getCard('trigger', id),
      getConditionCard: id => getCard('condition', id),
      getActionCard: id => getCard('action', id),
    },
  };
}

test('registerBatteryFlowCards registers listeners only once per Homey instance', () => {
  const { flow, registrations } = createFlowMock();
  const homey = { flow };

  registerBatteryFlowCards(homey);
  registerBatteryFlowCards(homey);

  assert.equal(registrations.length, new Set(registrations).size);
});

test('battery action flow listeners call the selected device from args', async () => {
  const { flow, cards } = createFlowMock();
  const homey = { flow };
  const calls = [];
  const device = {
    blockBatteryDischarge: async () => calls.push('block'),
    enableBatteryDischarge: async () => calls.push('enable'),
    turnOffBatteryCharging: async () => calls.push('off'),
    turnOnBatteryCharging: async args => calls.push(`on:${args.limit}`),
  };

  registerBatteryFlowCards(homey);

  await cards.get('action:block_battery_discharge').listener({ device });
  await cards.get('action:enable_battery_discharge').listener({ device });
  await cards.get('action:turn_off_battery_charging').listener({ device });
  await cards.get('action:turn_on_battery_charging').listener({ device, limit: 5000 });

  assert.deepEqual(calls, ['block', 'enable', 'off', 'on:5000']);
});

test('battery condition flow listeners read the selected device from args', async () => {
  const { flow, cards } = createFlowMock();
  const homey = { flow };
  const device = {
    getCapabilityValue(capability) {
      if (capability === 'measure_battery') return 55;
      if (capability === 'block_battery_discharge') return true;
      if (capability === 'force_charging') return false;
      return null;
    },
  };

  registerBatteryFlowCards(homey);

  assert.equal(await cards.get('condition:battery_level_check').listener({
    device,
    comparison: 'above',
    level: 50,
  }), true);
  assert.equal(await cards.get('condition:is_battery_discharge_blocked').listener({
    device,
    inverted: false,
  }), true);
  assert.equal(await cards.get('condition:is_force_charging').listener({
    device,
    inverted: true,
  }), true);
});
