'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { registerBoilerFlowCards } = require('../lib/BoilerFlowCards');

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
      getActionCard: id => getCard('action', id),
    },
  };
}

test('registerBoilerFlowCards registers listeners only once per Homey instance', () => {
  const { flow, registrations } = createFlowMock();
  const homey = { flow };

  registerBoilerFlowCards(homey);
  registerBoilerFlowCards(homey);

  assert.equal(registrations.length, new Set(registrations).size);
});

test('boiler action flow listener turns on selected device with selected power routing mode', async () => {
  const { flow, cards } = createFlowMock();
  const homey = { flow };
  const calls = [];
  const device = {
    turnOnBoiler: async args => calls.push(args),
  };

  registerBoilerFlowCards(homey);

  await cards.get('action:turn_on_boiler_with_power_routing').listener({ device, power_routing: 'without' });

  assert.deepEqual(calls, [{ device, power_routing: 'without' }]);
});
