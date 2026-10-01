'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const CookieManager = require('../lib/CookieManager');
const SunberryClient = require('../lib/SunberryClient');
const SunberryBatteryControl = require('../lib/SunberryBatteryControl');
const { SunberryBoilerControl } = require('../lib/SunberryBoilerControl');
const { SunberrySmartContactControl } = require('../lib/SunberrySmartContactControl');

test('failed body cancellation aborts the transport and preserves the original HTTP error', async () => {
  let signal;
  const response = new Response(new ReadableStream({
    cancel() { throw new Error('body cancellation failed'); },
  }), { status: 503 });
  const client = new SunberryClient({
    baseUrl: 'http://cancel-failure.test',
    fetchImpl: async (url, options) => { signal = options.signal; return response; },
  });
  await assert.rejects(() => client.getHtml('/grid/values'), /HTTP 503/);
  assert.equal(signal.aborted, true, 'failed cancellation must still terminate the transport');
});

test('cookie response cleanup remains covered by the request deadline', async (t) => {
  const originalSetTimeout = global.setTimeout;
  t.mock.method(global, 'setTimeout', (callback, ms, ...args) =>
    originalSetTimeout(callback, ms === 10000 ? 20 : ms, ...args));
  let signal;
  let releaseCancellation;
  const response = new Response(new ReadableStream({
    cancel() {
      return new Promise(resolve => {
        releaseCancellation = resolve;
      });
    },
  }), { headers: { 'set-cookie': 'session=test-session; Path=/' } });
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => { signal = options.signal; return response; };
  let guard;
  const operation = new CookieManager().getCookie('http://deadline.test');
  try {
    const cookie = await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        guard = originalSetTimeout(() => reject(new Error('cleanup lost its deadline')), 1000);
      }),
    ]);
    assert.equal(cookie, 'test-session');
    assert.equal(signal.aborted, true);
    assert.equal(response.bodyUsed, true);
  } finally {
    clearTimeout(guard);
    global.fetch = originalFetch;
    releaseCancellation?.();
    await operation;
  }
});

function unreadResponse(status, headers = {}) {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(64 * 1024));
    },
  }), { status, headers });
}

test('cookie retrieval releases the unused response body before returning its cookie', async () => {
  const response = unreadResponse(200, { 'set-cookie': 'session=test-session; Path=/' });
  const originalFetch = global.fetch;
  global.fetch = async () => response;
  try {
    const manager = new CookieManager();
    assert.equal(await manager.getCookie('http://cookie.test'), 'test-session');
    assert.equal(response.bodyUsed, true, 'cookie HTML must not remain unread');
    assert.deepEqual(await response.body.getReader().read(), { value: undefined, done: true });
  } finally {
    global.fetch = originalFetch;
    if (!response.bodyUsed) await response.body.cancel();
  }
});

test('cookie retries release each response when the server omits the session cookie', async (t) => {
  const originalSetTimeout = global.setTimeout;
  t.mock.method(global, 'setTimeout', (callback, ms, ...args) =>
    originalSetTimeout(callback, ms === 1000 || ms === 2000 ? 1 : ms, ...args));
  const responses = [];
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const response = unreadResponse(200);
    responses.push(response);
    return response;
  };
  try {
    await assert.rejects(() => new CookieManager().getCookie('http://missing-cookie.test'), /No cookies/);
    assert.equal(responses.length, 3);
    for (const response of responses) assert.equal(response.bodyUsed, true);
  } finally {
    global.fetch = originalFetch;
    for (const response of responses) if (!response.bodyUsed) await response.body.cancel();
  }
});

for (const [name, status, headers, error] of [
  ['HTTP error', 503, {}, /HTTP 503/],
  ['oversized Content-Length', 200, { 'content-length': String(600 * 1024) }, /too large/],
]) {
  test(`polling releases the body when rejecting an ${name} response`, async () => {
    const response = unreadResponse(status, headers);
    const client = new SunberryClient({ baseUrl: 'http://lifecycle.test', fetchImpl: async () => response });
    try {
      await assert.rejects(() => client.getHtml('/grid/values'), error);
      assert.equal(response.bodyUsed, true, 'rejected polling response must be released');
    } finally {
      if (!response.bodyUsed) await response.body.cancel();
    }
  });
}

for (const [name, Control, invoke] of [
  ['battery POST', SunberryBatteryControl, control => control.blockBatteryDischarge()],
  ['boiler POST', SunberryBoilerControl, control => control.updateTimer()],
  ['boiler active GET', SunberryBoilerControl, control => control.setActive(false)],
  ['smart contact POST', SunberrySmartContactControl, control => control.updateTimer()],
  ['smart contact active GET', SunberrySmartContactControl, control => control.setActive(false)],
]) {
  test(`${name} releases its error response without hiding the HTTP status`, async () => {
    const response = unreadResponse(503);
    const control = new Control({
      fetchImpl: async () => response,
      cookieManager: { getCookie: async () => 'test-session' },
    });
    control.setBaseUrl('http://control.test');
    try {
      await assert.rejects(() => invoke(control), /HTTP 503/);
      assert.equal(response.bodyUsed, true, 'rejected control response must be released');
    } finally {
      if (!response.bodyUsed) await response.body.cancel();
    }
  });
}

// Run the actual TCP/fetch path in a child so a parser assertion cannot kill the test runner.
const childScript = `
  const assert = require('node:assert/strict');
  const net = require('node:net');
  const CookieManager = require(${JSON.stringify(require.resolve('../lib/CookieManager'))});
  const SunberryClient = require(${JSON.stringify(require.resolve('../lib/SunberryClient'))});
  const mode = process.argv[1];
  const body = Buffer.alloc(mode === 'oversized' ? 600 * 1024 : 64 * 1024, 0x61);
  const sockets = new Set();
  const requestSockets = new Set();
  const responses = [];
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    const response = await originalFetch(...args);
    responses.push(response);
    return response;
  };
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => { sockets.delete(socket); requestSockets.delete(socket); });
    socket.once('data', () => {
      requestSockets.add(socket);
      const status = mode === 'error' ? '503 Service Unavailable' : '200 OK';
      const headers = 'HTTP/1.1 ' + status + '\\r\\nContent-Length: ' + body.length +
        '\\r\\nConnection: close\\r\\nSet-Cookie: session=test-session; Path=/\\r\\n\\r\\n';
      if (mode === 'timeout' || mode === 'cookie-timeout') socket.write(headers + 'partial body');
      else socket.end(headers + body.toString());
    });
  });
  server.listen(0, '127.0.0.1', async () => {
    try {
      const baseUrl = 'http://127.0.0.1:' + server.address().port;
      if (mode === 'timeout' || mode === 'cookie-timeout') {
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = (callback, ms, ...args) => originalSetTimeout(callback, ms === 10000 ? 50 : ms, ...args);
        if (mode === 'cookie-timeout') {
          assert.equal(await new CookieManager().getCookie(baseUrl), 'test-session');
        } else {
          const client = new SunberryClient({ baseUrl });
          await assert.rejects(() => client.getHtml('/grid/values'), error => error.name === 'AbortError');
        }
      } else if (mode === 'cookie') {
        assert.equal(await new CookieManager().getCookie(baseUrl), 'test-session');
      } else {
        const client = new SunberryClient({ baseUrl });
        await assert.rejects(() => client.getHtml('/grid/values'), mode === 'error' ? /HTTP 503/ : /too large/);
      }
      assert.equal(responses.length, 1);
      assert.equal(responses[0].bodyUsed, true, 'real socket response body was left unread');
      await new Promise(resolve => setTimeout(resolve, 50));
      if (mode === 'cookie-timeout') assert.equal(requestSockets.size, 0, 'discarded response must close its request socket');
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      for (const socket of sockets) socket.destroy();
      server.close();
    }
  });
`;

for (const mode of ['cookie', 'error', 'oversized', 'timeout', 'cookie-timeout']) {
  test(`real Connection: close ${mode} response is released and the process survives`, () => {
    const result = spawnSync(process.execPath, ['-e', childScript, mode], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
