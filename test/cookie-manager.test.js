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

test('CookieManager can request a session cookie from a feature-specific settings path', async () => {
  const urls = [];
  const logger = {
    debug: () => {},
    error: () => {},
  };

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    urls.push(url);
    return {
      status: 200,
      headers: {
        forEach(callback) {
          callback('session=smart-contact-cookie; Path=/', 'set-cookie');
        },
        getSetCookie() {
          return ['session=smart-contact-cookie; Path=/'];
        },
        get() {
          return null;
        },
      },
    };
  };

  try {
    const manager = new CookieManager(logger);
    const cookie = await manager.getCookie('http://sunberry.test', '/heat_pump/settings');

    assert.equal(cookie, 'smart-contact-cookie');
    assert.deepEqual(urls, ['http://sunberry.test/heat_pump/settings']);
  } finally {
    global.fetch = originalFetch;
  }
});
