'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { updateEstimatedSolarMeter } = require('../../lib/SolarEnergyEstimator');
const { normalizeSolarMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberrySolarDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const values = await this.createClient().getSolarValues();
        const updates = normalizeSolarMeasurements(values);
        const estimatedSolarMeter = await updateEstimatedSolarMeter(this, updates.measure_power);
        if (estimatedSolarMeter !== null) {
            updates.meter_power = estimatedSolarMeter;
        }
        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberrySolarDevice;
