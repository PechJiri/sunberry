'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { normalizeGridMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryGridDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const client = this.createClient();
        const [gridValues, backupValues] = await Promise.all([
            client.getGridValues(),
            client.getBackupValues()
        ]);
        const updates = normalizeGridMeasurements(gridValues, backupValues);
        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberryGridDevice;
