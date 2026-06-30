'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const CookieManager = require('../lib/CookieManager');

test('CookieManager returns the session cookie without logging its raw value', async () => {
  const logs = [];
  const logger = {
    debug: (...args) => logs.push(args),
    error: (...args) => logs.push(args),
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    headers: {
      forEach(callback) {
        callback('session=secret-cookie; Path=/', 'set-cookie');
      },
      getSetCookie() {
        return ['session=secret-cookie; Path=/'];
      },
      get() {
        return null;
      },
    },
  });

  try {
    const manager = new CookieManager(logger);
    const cookie = await manager.getCookie('http://sunberry.test');

    assert.equal(cookie, 'secret-cookie');
    assert.equal(JSON.stringify(logs).includes('secret-cookie'), false);
  } finally {
    global.fetch = originalFetch;
  }
});
