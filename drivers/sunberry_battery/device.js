'use strict';

const DataValidator = require('../../lib/DataValidator');
const { updateEstimatedBatteryMeters } = require('../../lib/BatteryEnergyEstimator');
const SunberryBatteryControl = require('../../lib/SunberryBatteryControl');
const SunberryClient = require('../../lib/SunberryClient');
const { normalizeBatteryMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryBatteryDevice extends SunberryPollingDevice {
    async onInit() {
        this.controlApi = new SunberryBatteryControl();
        await this.controlApi.initializeLogger(this.homey);
        this.controlApi.setBaseUrl(this.getSetting('ip_address'));
        this.registerCapabilityListener('force_charging', this.onForceChargingChanged.bind(this));
        this.registerCapabilityListener('block_battery_discharge', this.onBlockDischargeChanged.bind(this));
        await super.onInit();
    }

    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const previousBatteryLevel = this.getCapabilityValue('measure_battery');
        const previousMaxChargingPower = this.getCapabilityValue('battery_max_charging_power');
        const values = await this.createClient().getBatteryValues();
        const updates = normalizeBatteryMeasurements(values);
        const estimatedBatteryMeters = await updateEstimatedBatteryMeters(this, updates.measure_power);
        if (estimatedBatteryMeters !== null) {
            updates['meter_power.imported'] = estimatedBatteryMeters.importedKWh;
            updates['meter_power.exported'] = estimatedBatteryMeters.exportedKWh;
        }

        await applyCapabilityUpdates(this, updates);
        await this.triggerBatteryMeasurementFlows(previousBatteryLevel, previousMaxChargingPower, updates);
    }

    async onSettings(args) {
        if (args.changedKeys.includes('ip_address')) {
            this.controlApi.setBaseUrl(args.newSettings.ip_address);
        }
        await super.onSettings(args);
    }

    async onForceChargingChanged(value) {
        if (value) {
            const limit = Number(this.getSetting('force_charging_limit')) || 5000;
            await this.turnOnBatteryCharging({ limit });
        } else {
            await this.turnOffBatteryCharging();
        }
    }

    async onBlockDischargeChanged(value) {
        if (value) {
            await this.blockBatteryDischarge();
        } else {
            await this.enableBatteryDischarge();
        }
    }

    async turnOnBatteryCharging(args = {}) {
        const maxChargingPower = this.getCapabilityValue('battery_max_charging_power') || null;
        const requestedLimit = Number(args.limit || this.getSetting('force_charging_limit') || 5000);
        const limit = DataValidator.normalizeChargingLimit(requestedLimit, maxChargingPower);

        await this.controlApi.enableForceCharging(limit);
        await this.setCapabilityValue('force_charging', true);
        await this.triggerForceChargingFlow(true);
        return true;
    }

    async turnOffBatteryCharging() {
        await this.controlApi.disableForceCharging();
        await this.setCapabilityValue('force_charging', false);
        await this.triggerForceChargingFlow(false);
        return true;
    }

    async blockBatteryDischarge() {
        await this.controlApi.blockBatteryDischarge();
        await this.setCapabilityValue('block_battery_discharge', true);
        return true;
    }

    async enableBatteryDischarge() {
        await this.controlApi.enableBatteryDischarge();
        await this.setCapabilityValue('block_battery_discharge', false);
        return true;
    }

    async triggerBatteryMeasurementFlows(previousBatteryLevel, previousMaxChargingPower, updates) {
        if (previousBatteryLevel !== updates.measure_battery) {
            await this.homey.flow.getDeviceTriggerCard('battery_level_changed').trigger(this, {}, {
                previous_battery_level: previousBatteryLevel,
                battery_level: updates.measure_battery
            }).catch(this.error);
        }

        if (previousMaxChargingPower !== updates.battery_max_charging_power) {
            await this.homey.flow.getDeviceTriggerCard('battery_max_charging_power_changed').trigger(this, {
                power: updates.battery_max_charging_power
            }, {}).catch(this.error);
        }
    }

    async triggerForceChargingFlow(isCharging) {
        const cardId = isCharging ? 'force_charging_started' : 'force_charging_stopped';
        await this.homey.flow.getDeviceTriggerCard(cardId).trigger(this, {}, {
            force_charging: isCharging
        }).catch(this.error);
    }
}

module.exports = SunberryBatteryDevice;
