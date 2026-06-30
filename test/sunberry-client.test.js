'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const SunberryClient = require('../lib/SunberryClient');

test.beforeEach(() => {
  SunberryClient._private.htmlCache.clear();
});

test('SunberryClient reads values through endpoint-specific parsers', async () => {
  const calls = [];
  const client = new SunberryClient({
    baseUrl: 'http://example.test/',
    fetchImpl: async (url) => {
      calls.push(url);
      const htmlByUrl = {
        'http://example.test/battery/values': '<label>Nabijeni</label><label>Kapacita baterie:</label><label>4397 Wh</label><label>21 %</label><label>Vykon baterie:</label><label>1324 W</label><label>13 %</label><label>Max nabijeni:</label><label>10889 W</label><label>Max vybijeni:</label><label>10889 W</label><label>Teplota baterii:</label><label>42 deg C</label>',
        'http://example.test/pv/values': '<label>Pv1:</label><label>100 W</label><label>2 %</label><label>Pv2:</label><label>0 W</label><label>0 %</label>',
        'http://example.test/grid/values': '<label>L1:</label><label>1 W</label><label>1 %</label><label>L2:</label><label>2 W</label><label>2 %</label><label>L3:</label><label>3 W</label><label>3 %</label><label>Celkem:</label><label>6 W</label><label>6 %</label>',
        'http://example.test/backup/values': '<label>L1:</label><label>4 W</label><label>1 %</label><label>L2:</label><label>5 W</label><label>2 %</label><label>L3:</label><label>6 W</label><label>3 %</label><label>Celkem:</label><label>15 W</label><label>6 %</label>',
      };

      return {
        status: 200,
        text: async () => htmlByUrl[url],
      };
    },
  });

  assert.equal((await client.getBatteryValues()).state, 'charging');
  assert.equal((await client.getSolarValues()).total_power, 100);
  assert.equal((await client.getGridValues()).Total, 6);
  assert.equal((await client.getBackupValues()).Total, 15);
  assert.deepEqual(calls, [
    'http://example.test/battery/values',
    'http://example.test/pv/values',
    'http://example.test/grid/values',
    'http://example.test/backup/values',
  ]);
});

test('SunberryClient rejects non-200 endpoint responses', async () => {
  const client = new SunberryClient({
    baseUrl: 'http://example.test',
    fetchImpl: async () => ({ status: 503, text: async () => 'nope' }),
  });

  await assert.rejects(() => client.getGridValues(), /HTTP 503/);
});

test('SunberryClient rejects oversized endpoint responses', async () => {
  const client = new SunberryClient({
    baseUrl: 'http://example.test',
    fetchImpl: async () => ({
      status: 200,
      headers: {
        get: name => name.toLowerCase() === 'content-length' ? String(600 * 1024) : null,
      },
      text: async () => 'not read',
    }),
  });

  await assert.rejects(() => client.getGridValues(), /too large/);
});

test('SunberryClient rejects oversized endpoint response bodies without content-length', async () => {
  const client = new SunberryClient({
    baseUrl: 'http://example.test',
    fetchImpl: async () => ({
      status: 200,
      headers: {
        get: () => null,
      },
      text: async () => 'x'.repeat(600 * 1024),
    }),
  });

  await assert.rejects(() => client.getGridValues(), /too large/);
});

test('SunberryClient serializes concurrent requests for the same Sunberry base URL', async () => {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const client = new SunberryClient({
    baseUrl: 'http://queued.test',
    fetchImpl: async (url) => {
      calls.push(url);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);

      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;

      const htmlByUrl = {
        'http://queued.test/grid/values': '<label>L1:</label><label>1 W</label><label>L2:</label><label>2 W</label><label>L3:</label><label>3 W</label><label>Celkem:</label><label>6 W</label>',
        'http://queued.test/backup/values': '<label>L1:</label><label>4 W</label><label>L2:</label><label>5 W</label><label>L3:</label><label>6 W</label><label>Celkem:</label><label>15 W</label>',
      };

      return {
        status: 200,
        text: async () => htmlByUrl[url],
      };
    },
  });

  const [gridValues, backupValues] = await Promise.all([
    client.getGridValues(),
    client.getBackupValues(),
  ]);

  assert.equal(gridValues.Total, 6);
  assert.equal(backupValues.Total, 15);
  assert.equal(maxInFlight, 1);
  assert.deepEqual(calls, [
    'http://queued.test/grid/values',
    'http://queued.test/backup/values',
  ]);
});

test('SunberryClient resolves .local hostnames to IPv4 before fetching', async () => {
  const calls = [];
  const client = new SunberryClient({
    baseUrl: 'http://sunberry.local',
    hostLookup: async (hostname, options) => {
      assert.equal(hostname, 'sunberry.local');
      assert.deepEqual(options, { family: 4 });
      return { address: '192.168.68.67', family: 4 };
    },
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        status: 200,
        text: async () => '<label>Pv1:</label><label>100 W</label><label>Pv2:</label><label>0 W</label>',
      };
    },
  });

  assert.equal((await client.getSolarValues()).total_power, 100);
  assert.deepEqual(calls, ['http://192.168.68.67/pv/values']);
});

test('SunberryClient reuses fresh endpoint reads across devices for a short TTL', async () => {
  const calls = [];
  const clientA = new SunberryClient({
    baseUrl: 'http://cache.test',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        status: 200,
        text: async () => '<label>Pv1:</label><label>100 W</label><label>Pv2:</label><label>0 W</label>',
      };
    },
  });
  const clientB = new SunberryClient({
    baseUrl: 'http://cache.test',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        status: 200,
        text: async () => '<label>Pv1:</label><label>200 W</label><label>Pv2:</label><label>0 W</label>',
      };
    },
  });

  assert.equal((await clientA.getSolarValues()).total_power, 100);
  assert.equal((await clientB.getSolarValues()).total_power, 100);
  assert.deepEqual(calls, ['http://cache.test/pv/values']);
});

test('SunberryClient cache covers startup jitter but expires before the minimum polling interval', async () => {
  const originalNow = Date.now;
  let now = 100000;
  Date.now = () => now;
  const calls = [];
  const clientA = new SunberryClient({
    baseUrl: 'http://jitter.test',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        status: 200,
        text: async () => '<label>Pv1:</label><label>100 W</label><label>Pv2:</label><label>0 W</label>',
      };
    },
  });
  const clientB = new SunberryClient({
    baseUrl: 'http://jitter.test',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        status: 200,
        text: async () => '<label>Pv1:</label><label>200 W</label><label>Pv2:</label><label>0 W</label>',
      };
    },
  });

  try {
    assert.equal((await clientA.getSolarValues()).total_power, 100);
    now += 4000;
    assert.equal((await clientB.getSolarValues()).total_power, 100);
    now += 600;
    assert.equal((await clientB.getSolarValues()).total_power, 200);
    assert.deepEqual(calls, [
      'http://jitter.test/pv/values',
      'http://jitter.test/pv/values',
    ]);
  } finally {
    Date.now = originalNow;
  }
});
