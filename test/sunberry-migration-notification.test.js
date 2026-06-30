'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY,
  SUNBERRY_V3_MIGRATION_NOTIFICATION_TEXT,
  notifySunberryV3MigrationOnce,
} = require('../lib/SunberryMigrationNotification');

function createHomeyMock(initialSettings = {}) {
  const settings = new Map(Object.entries(initialSettings));
  const notifications = [];

  return {
    notifications,
    homey: {
      settings: {
        get: key => settings.get(key),
        set: (key, value) => settings.set(key, value),
      },
      notifications: {
        createNotification: async notification => notifications.push(notification),
      },
    },
    getSetting: key => settings.get(key),
  };
}

test('notifySunberryV3MigrationOnce sends the v3 migration notification once', async () => {
  const { homey, notifications, getSetting } = createHomeyMock();

  await notifySunberryV3MigrationOnce(homey);

  assert.deepEqual(notifications, [
    { excerpt: SUNBERRY_V3_MIGRATION_NOTIFICATION_TEXT },
  ]);
  assert.equal(getSetting(SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY), true);
});

test('notifySunberryV3MigrationOnce skips notification after it was already sent', async () => {
  const { homey, notifications } = createHomeyMock({
    [SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY]: true,
  });

  await notifySunberryV3MigrationOnce(homey);

  assert.deepEqual(notifications, []);
});

test('notifySunberryV3MigrationOnce does not fail app startup when notification fails', async () => {
  const warnings = [];
  const settings = new Map();
  const homey = {
    settings: {
      get: key => settings.get(key),
      set: (key, value) => settings.set(key, value),
    },
    notifications: {
      createNotification: async () => {
        throw new Error('timeline unavailable');
      },
    },
  };

  await notifySunberryV3MigrationOnce(homey, {
    warn: (...args) => warnings.push(args),
  });

  assert.equal(settings.get(SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY), undefined);
  assert.equal(warnings.length, 1);
});
