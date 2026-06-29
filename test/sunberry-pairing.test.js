'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { _private: hostResolverPrivate } = require('../lib/SunberryHostResolver');
const { createPairedDevice } = require('../lib/SunberryPairing');
const { createDeviceForHost, createSunberryDriver } = require('../lib/SunberrySplitDriver');

test('createPairedDevice creates stable ids per split device type and host', () => {
  assert.deepEqual(createPairedDevice({
    type: 'battery',
    ipAddress: '192.168.1.50',
    name: 'Sunberry Battery',
    settings: { force_charging_limit: 5000 },
  }), {
    name: 'Sunberry Battery',
    data: { id: '192.168.1.50:battery' },
    settings: {
      ip_address: '192.168.1.50',
      update_interval: 10,
      enable_debug_logs: false,
      force_charging_limit: 5000,
    },
  });
});

test('createDeviceForHost preserves driver type in paired device id', () => {
  assert.deepEqual(createDeviceForHost({
    type: 'grid',
    ipAddress: '192.168.1.50',
    name: 'Sunberry Grid',
    defaultSettings: {},
  }), {
    name: 'Sunberry Grid',
    data: { id: '192.168.1.50:grid' },
    settings: {
      ip_address: '192.168.1.50',
      update_interval: 10,
      enable_debug_logs: false,
    },
  });
});

test('split driver pairing requires user-provided host before listing devices', async () => {
  const Driver = createSunberryDriver({
    type: 'grid',
    name: 'Sunberry Grid',
    testMethod: 'getGridValues',
  });
  const driver = new Driver();
  const handlers = {};
  const session = {
    setHandler(name, handler) {
      handlers[name] = handler;
    },
  };

  await driver.onPair(session);

  assert.deepEqual(await handlers.getSettings(), { ip_address: '' });
  assert.deepEqual(await handlers.list_devices(), []);
});

test('split driver check returns device for custom pairing createDevice flow', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    text: async () => `
      <label>L1:</label><label>100 W</label><label>10 %</label>
      <label>L2:</label><label>200 W</label><label>20 %</label>
      <label>L3:</label><label>300 W</label><label>30 %</label>
      <label>Celkem:</label><label>600 W</label><label>60 %</label>
    `,
  });

  try {
    const Driver = createSunberryDriver({
      type: 'grid',
      name: 'Sunberry Grid',
      testMethod: 'getGridValues',
    });
    const driver = new Driver();
    const handlers = {};
    const session = {
      setHandler(name, handler) {
        handlers[name] = handler;
      },
    };

    await driver.onPair(session);
    const result = await handlers.check({ ip_address: '192.168.1.50' });

    assert.equal(result.success, true);
    assert.deepEqual(result.device, createDeviceForHost({
      type: 'grid',
      ipAddress: '192.168.1.50',
      name: 'Sunberry Grid',
      defaultSettings: {},
    }));
  } finally {
    global.fetch = originalFetch;
  }
});

test('split driver check stores resolved IPv4 address for sunberry.local pairing', async () => {
  const originalFetch = global.fetch;
  const originalLookup = require('node:dns').promises.lookup;
  hostResolverPrivate.resolvedHostCache.clear();

  require('node:dns').promises.lookup = async (hostname, options) => {
    assert.equal(hostname, 'sunberry.local');
    assert.deepEqual(options, { family: 4 });
    return { address: '192.168.68.67', family: 4 };
  };

  global.fetch = async (url) => {
    assert.equal(url, 'http://192.168.68.67/grid/values');
    return {
      status: 200,
      text: async () => `
        <label>L1:</label><label>100 W</label><label>10 %</label>
        <label>L2:</label><label>200 W</label><label>20 %</label>
        <label>L3:</label><label>300 W</label><label>30 %</label>
        <label>Celkem:</label><label>600 W</label><label>60 %</label>
      `,
    };
  };

  try {
    const Driver = createSunberryDriver({
      type: 'grid',
      name: 'Sunberry Grid',
      testMethod: 'getGridValues',
    });
    const driver = new Driver();
    const handlers = {};
    const session = {
      setHandler(name, handler) {
        handlers[name] = handler;
      },
    };

    await driver.onPair(session);
    const result = await handlers.check({ ip_address: 'sunberry.local' });

    assert.equal(result.success, true);
    assert.equal(result.device.settings.ip_address, '192.168.68.67');
    assert.equal(result.device.data.id, '192.168.68.67:grid');
  } finally {
    global.fetch = originalFetch;
    require('node:dns').promises.lookup = originalLookup;
    hostResolverPrivate.resolvedHostCache.clear();
  }
});
