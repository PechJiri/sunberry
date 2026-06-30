'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SELF_HEAL_POLLING_INTERVAL_MS,
  SunberryPollingDevice,
  applyCapabilityUpdates,
} = require('../lib/SunberryPollingDevice');

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
      this.warningMessages = [];
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

    async setWarning(message) {
      this.warningMessages.push(message);
    }

    error(error) {
      this.loggedErrors.push(error);
    }
  }

  const device = new TestPollingDevice();

  await device.pollAndSetAvailability();
  await device.pollAndSetAvailability();

  assert.deepEqual(device.unavailableMessages, []);
  assert.equal(device.warningMessages.length, 2);
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
      this.warningMessages = [];
      this.availableCount = 0;
      this.unsetWarningCount = 0;
      this.lastSeenAtCount = 0;
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

    async setWarning(message) {
      this.warningMessages.push(message);
    }

    async unsetWarning() {
      this.unsetWarningCount += 1;
    }

    async setLastSeenAt() {
      this.lastSeenAtCount += 1;
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
  assert.equal(device.unsetWarningCount, 1);
  assert.equal(device.lastSeenAtCount, 1);
  assert.equal(device.loggedErrors.length, 4);
});

test('pollAndSetAvailability reuses an in-flight poll instead of starting another one', async () => {
  let resolvePoll;
  class TestPollingDevice extends SunberryPollingDevice {
    constructor() {
      super();
      this.pollCount = 0;
      this.availableCount = 0;
    }

    async pollOnce() {
      this.pollCount += 1;
      await new Promise(resolve => {
        resolvePoll = resolve;
      });
    }

    async setAvailable() {
      this.availableCount += 1;
    }
  }

  const device = new TestPollingDevice();
  const first = device.pollAndSetAvailability();
  const second = device.pollAndSetAvailability();

  assert.equal(device.pollCount, 1);
  resolvePoll();
  await Promise.all([first, second]);
  assert.equal(device.pollCount, 1);
  assert.equal(device.availableCount, 1);
});

test('getNextPollingDelayMs uses hourly self-healing interval after repeated failures', () => {
  class TestPollingDevice extends SunberryPollingDevice {
    getSetting() {
      return 10;
    }
  }

  const device = new TestPollingDevice();

  device.pollingFailureCount = 0;
  assert.equal(device.getNextPollingDelayMs(), 10000);

  device.pollingFailureCount = 1;
  assert.equal(device.getNextPollingDelayMs(), 20000);

  device.pollingFailureCount = 2;
  assert.equal(device.getNextPollingDelayMs(), 40000);

  device.pollingFailureCount = 3;
  assert.equal(device.getNextPollingDelayMs(), SELF_HEAL_POLLING_INTERVAL_MS);
});
