'use strict';

const DataValidator = require('./DataValidator');
const SunberryClient = require('./SunberryClient');
const { createPairedDevice } = require('./SunberryPairing');

let HomeyDriver = class {};
try {
    HomeyDriver = require('homey').Driver;
} catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

function isValidHost(value) {
    return DataValidator.validateHost(value);
}

function createSunberryDriver({ type, name, testMethod, defaultSettings = {} }) {
    return class SunberrySplitDriver extends HomeyDriver {
        async onInit() {
            this.log(`${name} driver initialized`);
        }

        async onPair(session) {
            const pairingData = {
                ip_address: ''
            };

            session.setHandler('getSettings', async () => ({
                ip_address: pairingData.ip_address
            }));

            session.setHandler('settingsChanged', async (settings) => {
                try {
                    if (!isValidHost(settings.ip_address)) {
                        throw new Error('Invalid IP address or hostname');
                    }

                    pairingData.ip_address = settings.ip_address;
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });

            session.setHandler('check', async (settings) => {
                try {
                    if (!isValidHost(settings.ip_address)) {
                        throw new Error('Invalid IP address or hostname');
                    }

                    const client = new SunberryClient({ baseUrl: `http://${settings.ip_address}` });
                    await client[testMethod]();
                    pairingData.ip_address = settings.ip_address;
                    return { success: true };
                } catch (error) {
                    return { success: false, error: `Connection failed: ${error.message}` };
                }
            });

            session.setHandler('list_devices', async () => {
                const ipAddress = pairingData.ip_address;
                if (!ipAddress) return [];

                return [createPairedDevice({
                    type,
                    ipAddress,
                    name,
                    settings: defaultSettings
                })];
            });
        }
    };
}

module.exports = {
    createSunberryDriver
};
