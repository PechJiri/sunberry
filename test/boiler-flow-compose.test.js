'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const boilerFlowCard = require('../.homeycompose/flow/actions/turn_on_boiler_with_power_routing.json');

test('boiler flow action targets both boiler device types and exposes power routing mode', () => {
  assert.equal(boilerFlowCard.title.en, 'Turn on Boiler with Power Routing mode');
  assert.deepEqual(boilerFlowCard.args[0], {
    type: 'device',
    name: 'device',
    filter: 'driver_id=sunberry_boiler_1f|sunberry_boiler_3f',
  });

  const powerRoutingArg = boilerFlowCard.args[1];
  assert.equal(powerRoutingArg.name, 'power_routing');
  assert.equal(powerRoutingArg.type, 'dropdown');
  assert.deepEqual(powerRoutingArg.values.map(value => value.id), ['with', 'without']);
});
