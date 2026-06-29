'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { didCrossBatteryLevel } = require('../lib/FlowLogic');

test('didCrossBatteryLevel triggers when battery rises past target between polling samples', () => {
  assert.equal(didCrossBatteryLevel({ previous: 74, current: 81, target: 80 }), true);
});

test('didCrossBatteryLevel triggers when battery falls past target between polling samples', () => {
  assert.equal(didCrossBatteryLevel({ previous: 81, current: 74, target: 80 }), true);
});

test('didCrossBatteryLevel does not trigger when target is outside the sampled range', () => {
  assert.equal(didCrossBatteryLevel({ previous: 74, current: 79, target: 80 }), false);
});

test('didCrossBatteryLevel keeps exact-match behavior for the first known sample', () => {
  assert.equal(didCrossBatteryLevel({ previous: null, current: 80, target: 80 }), true);
  assert.equal(didCrossBatteryLevel({ previous: undefined, current: 79, target: 80 }), false);
});

test('didCrossBatteryLevel does not retrigger when moving away from the target', () => {
  assert.equal(didCrossBatteryLevel({ previous: 80, current: 81, target: 80 }), false);
  assert.equal(didCrossBatteryLevel({ previous: 80, current: 79, target: 80 }), false);
});
