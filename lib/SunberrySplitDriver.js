'use strict';

const DataValidator = require('./DataValidator');
const SunberryClient = require('./SunberryClient');
const { normalizeHost, resolveHost } = require('./SunberryHostResolver');
const { createPairedDevice } = require('./SunberryPairing');

let HomeyDriver = class {};
try {
    if (process.env.NODE_ENV !== 'test') {
        const Homey = require('homey');
        if (typeof Homey.Driver === 'function') {
            HomeyDriver = Homey.Driver;
        }
    }
} catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

function isValidHost(value) {
    return DataValidator.validateHost(value);
}

function createDeviceForHost({ type, name, ipAddress, defaultSettings }) {
    return createPairedDevice({
        type,
        ipAddress,
        name,
        settings: defaultSettings
    });
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
                    const host = normalizeHost(settings.ip_address);
                    if (!isValidHost(host)) {
                        throw new Error('Invalid IP address or hostname');
                    }

                    pairingData.ip_address = host;
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });

            session.setHandler('check', async (settings) => {
                try {
                    const host = normalizeHost(settings.ip_address);
                    if (!isValidHost(host)) {
                        throw new Error('Invalid IP address or hostname');
                    }

                    const resolvedHost = await resolveHost(host);
                    const client = new SunberryClient({ baseUrl: `http://${resolvedHost}` });
                    await client[testMethod]();
                    pairingData.ip_address = resolvedHost;
                    return {
                        success: true,
                        device: createDeviceForHost({
                            type,
                            name,
                            ipAddress: pairingData.ip_address,
                            defaultSettings
                        })
                    };
                } catch (error) {
                    return { success: false, error: `Connection failed: ${error.message}` };
                }
            });

            session.setHandler('list_devices', async () => {
                const ipAddress = pairingData.ip_address;
                if (!ipAddress) return [];

                return [createDeviceForHost({
                    type,
                    name,
                    ipAddress,
                    defaultSettings
                })];
            });
        }
    };
}

module.exports = {
    createSunberryDriver,
    createDeviceForHost
};
