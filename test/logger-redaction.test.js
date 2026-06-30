'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const Logger = require('../lib/Logger');

test('Logger redacts sensitive cookie and token fields', () => {
  const homey = {
    log: () => {},
    error: () => {},
    debug: () => {},
  };
  const logger = new Logger(homey, 'LoggerTest');

  logger.debug('sensitive payload', {
    cookie: 'session=secret-cookie',
    session: 'secret-session',
    token: 'secret-token',
    headers: {
      'set-cookie': 'session=secret-cookie',
      authorization: 'Bearer secret-token',
      accept: 'text/html',
    },
    nested: {
      password: 'secret-password',
      safe: 'visible',
    },
  });

  const log = logger.getLogHistory().find(entry => entry.message === 'sensitive payload');
  logger.destroy();

  assert.equal(log.data.cookie, '[REDACTED]');
  assert.equal(log.data.session, '[REDACTED]');
  assert.equal(log.data.token, '[REDACTED]');
  assert.equal(log.data.headers['set-cookie'], '[REDACTED]');
  assert.equal(log.data.headers.authorization, '[REDACTED]');
  assert.equal(log.data.headers.accept, 'text/html');
  assert.equal(log.data.nested.password, '[REDACTED]');
  assert.equal(log.data.nested.safe, 'visible');
});
