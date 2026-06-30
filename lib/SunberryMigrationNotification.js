'use strict';

const SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY = 'sunberry_v3_migration_notification_sent';
const SUNBERRY_V3_MIGRATION_NOTIFICATION_TEXT = 'Welcome to Sunberry 3.0.0. If you upgraded from an earlier version, add the new Sunberry Battery, Sunberry Solar and Sunberry Grid devices, then move your Flows to these new devices.';

async function notifySunberryV3MigrationOnce(homey, logger = null) {
    if (await homey.settings.get(SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY)) return;

    try {
        await homey.notifications.createNotification({
            excerpt: SUNBERRY_V3_MIGRATION_NOTIFICATION_TEXT
        });
    } catch (error) {
        if (logger && typeof logger.warn === 'function') {
            logger.warn('Failed to create Sunberry 3.0.0 migration notification', error);
        }
        return;
    }

    await homey.settings.set(SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY, true);
}

module.exports = {
    SUNBERRY_V3_MIGRATION_NOTIFICATION_KEY,
    SUNBERRY_V3_MIGRATION_NOTIFICATION_TEXT,
    notifySunberryV3MigrationOnce
};
