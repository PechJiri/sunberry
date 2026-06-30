'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { registerSmartContactFlowCards } = require('../lib/SmartContactFlowCards');

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

test('registerSmartContactFlowCards registers listeners only once per Homey instance', () => {
  const { flow, registrations } = createFlowMock();
  const homey = { flow };

  registerSmartContactFlowCards(homey);
  registerSmartContactFlowCards(homey);

  assert.equal(registrations.length, new Set(registrations).size);
});

test('smart contact action flow listener turns on selected device with selected mode', async () => {
  const { flow, cards } = createFlowMock();
  const homey = { flow };
  const calls = [];
  const device = {
    turnOnSmartContact: async args => calls.push(args),
  };

  registerSmartContactFlowCards(homey);

  await cards.get('action:turn_on_smart_contact_with_mode').listener({ device, mode: 'combined' });

  assert.deepEqual(calls, [{ device, mode: 'combined' }]);
});
