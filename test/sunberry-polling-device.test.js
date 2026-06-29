'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { SunberryPollingDevice, applyCapabilityUpdates } = require('../lib/SunberryPollingDevice');

test('applyCapabilityUpdates only writes existing changed finite values', async () => {
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
    measure_temperature: Number.NaN,
  });

  assert.deepEqual(writes, [['measure_battery', 21]]);
});

test('pollAndSetAvailability waits for repeated polling failures before marking unavailable', async () => {
  class TestPollingDevice extends SunberryPollingDevice {
    constructor() {
      super();
      this.pollError = new Error('HTTP 500');
      this.unavailableMessages = [];
      this.availableCount = 0;
      this.loggedErrors = [];
    }

    async pollOnce() {
      throw this.pollError;
    }

    async setAvailable() {
      this.availableCount += 1;
    }

    async setUnavailable(message) {
      this.unavailableMessages.push(message);
    }

    error(error) {
      this.loggedErrors.push(error);
    }
  }

  const device = new TestPollingDevice();

  await device.pollAndSetAvailability();
  await device.pollAndSetAvailability();

  assert.deepEqual(device.unavailableMessages, []);
  assert.equal(device.availableCount, 0);
  assert.equal(device.loggedErrors.length, 2);

  await device.pollAndSetAvailability();

  assert.deepEqual(device.unavailableMessages, ['HTTP 500']);
});

test('pollAndSetAvailability resets repeated failure counter after a successful poll', async () => {
  class TestPollingDevice extends SunberryPollingDevice {
    constructor(results) {
      super();
      this.results = [...results];
      this.unavailableMessages = [];
      this.availableCount = 0;
      this.loggedErrors = [];
    }

    async pollOnce() {
      const result = this.results.shift();
      if (result instanceof Error) throw result;
    }

    async setAvailable() {
      this.availableCount += 1;
    }

    async setUnavailable(message) {
      this.unavailableMessages.push(message);
    }

    error(error) {
      this.loggedErrors.push(error);
    }
  }

  const device = new TestPollingDevice([
    new Error('HTTP 500'),
    new Error('HTTP 500'),
    null,
    new Error('HTTP 500'),
    new Error('HTTP 500'),
  ]);

  await device.pollAndSetAvailability();
  await device.pollAndSetAvailability();
  await device.pollAndSetAvailability();
  await device.pollAndSetAvailability();
  await device.pollAndSetAvailability();

  assert.deepEqual(device.unavailableMessages, []);
  assert.equal(device.availableCount, 1);
  assert.equal(device.loggedErrors.length, 4);
});
