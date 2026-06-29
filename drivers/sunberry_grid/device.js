'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { updateEstimatedGridMeters } = require('../../lib/GridEnergyEstimator');
const { normalizeGridMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryGridDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const client = this.createClient();
        const gridValues = await client.getGridValues();
        const backupValues = await client.getBackupValues();
        const updates = normalizeGridMeasurements(gridValues, backupValues);
        const estimatedGridMeters = await updateEstimatedGridMeters(this, updates.measure_power);
        if (estimatedGridMeters !== null) {
            updates['meter_power.imported'] = estimatedGridMeters.importedKWh;
            updates['meter_power.exported'] = estimatedGridMeters.exportedKWh;
        }
        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberryGridDevice;
