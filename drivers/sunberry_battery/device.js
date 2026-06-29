'use strict';

const DataValidator = require('../../lib/DataValidator');
const { didCrossBatteryLevel } = require('../../lib/FlowLogic');
const SunberryBatteryControl = require('../../lib/SunberryBatteryControl');
const SunberryClient = require('../../lib/SunberryClient');
const { normalizeBatteryMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

class SunberryBatteryDevice extends SunberryPollingDevice {
    async onInit() {
        this.controlApi = new SunberryBatteryControl();
        await this.controlApi.initializeLogger(this.homey);
        this.controlApi.setBaseUrl(this.getSetting('ip_address'));
        this.registerBatteryFlowCards();
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
        const limit = Number(args.limit || this.getSetting('force_charging_limit') || 5000);

        if (!DataValidator.validateChargingLimit(limit, maxChargingPower)) {
            throw new Error(`Invalid charging limit: ${limit}`);
        }

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

    registerBatteryFlowCards() {
        const flow = this.homey.flow;

        flow.getDeviceTriggerCard('battery_level_changed').registerRunListener(async (args, state) => {
            return didCrossBatteryLevel({
                previous: state.previous_battery_level,
                current: state.battery_level,
                target: args.target_level
            });
        });

        flow.getConditionCard('battery_level_check').registerRunListener(async (args) => {
            const currentLevel = this.getCapabilityValue('measure_battery');
            return args.comparison === 'below'
                ? currentLevel < args.level
                : currentLevel > args.level;
        });

        flow.getConditionCard('is_battery_discharge_blocked').registerRunListener(async (args) => {
            const value = this.getCapabilityValue('block_battery_discharge');
            return args.inverted ? !value : value;
        });

        flow.getConditionCard('is_force_charging').registerRunListener(async (args) => {
            const value = this.getCapabilityValue('force_charging');
            return args.inverted ? !value : value;
        });

        flow.getActionCard('block_battery_discharge').registerRunListener(async () => this.blockBatteryDischarge());
        flow.getActionCard('enable_battery_discharge').registerRunListener(async () => this.enableBatteryDischarge());
        flow.getActionCard('turn_off_battery_charging').registerRunListener(async () => this.turnOffBatteryCharging());
        flow.getActionCard('turn_on_battery_charging').registerRunListener(async (args) => this.turnOnBatteryCharging(args));
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
