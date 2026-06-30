'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { toSunberryBaseUrl } = require('../../lib/SunberryHostResolver');
const {
    calculateNetGridPower,
    updateEstimatedEnergyBalanceMeters
} = require('../../lib/EnergyBalanceEstimator');
const {
    normalizeBatteryMeasurements,
    normalizeGridMeasurements,
    normalizeSolarMeasurements
} = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberrySmartMeterDevice extends SunberryPollingDevice {
    createClient() {
        return new SunberryClient({ baseUrl: toSunberryBaseUrl(this.getSetting('ip_address')) });
    }

    async pollOnce() {
        const values = await this.createClient().getEnergyBalanceValues();
        const battery = normalizeBatteryMeasurements(values.battery);
        const solar = normalizeSolarMeasurements(values.solar);
        const grid = normalizeGridMeasurements(values.grid);
        const measurePower = calculateNetGridPower({
            homeConsumptionPowerW: grid.measure_total,
            batteryPowerW: battery.measure_power,
            solarPowerW: solar.measure_power
        });
        const updates = {
            measure_power: measurePower
        };

        const estimatedMeters = await updateEstimatedEnergyBalanceMeters(this, measurePower);
        if (estimatedMeters !== null) {
            updates['meter_power.imported'] = estimatedMeters.importedKWh;
            updates['meter_power.exported'] = estimatedMeters.exportedKWh;
        }

        await applyCapabilityUpdates(this, updates);
    }
}

module.exports = SunberrySmartMeterDevice;
