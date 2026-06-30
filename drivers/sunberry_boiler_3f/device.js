'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { normalizeBoilerMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryBoiler3FDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const values = await this.createClient().getBoilerValues();
        const updates = normalizeBoilerMeasurements(values, { phaseCount: 3 });
        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberryBoiler3FDevice;
