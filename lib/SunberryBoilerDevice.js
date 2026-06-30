'use strict';

const SunberryClient = require('./SunberryClient');
const { SunberryBoilerControl } = require('./SunberryBoilerControl');
const { toSunberryBaseUrl } = require('./SunberryHostResolver');
const { updateEstimatedBoilerMeter } = require('./BoilerEnergyEstimator');
const { normalizeBoilerMeasurements } = require('./SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('./SunberryPollingDevice');

const BOILER_TIMER_SETTING_KEYS = [
    'boiler_default_min_temperature',
    'boiler_default_max_temperature',
    'boiler_power_routing'
];
const DEFAULT_MIN_TEMPERATURE = 40;
const DEFAULT_MAX_TEMPERATURE = 60;
const DEFAULT_POWER_ROUTING = true;

function valueOrDefault(value, fallback) {
    return value === undefined || value === null || value === '' ? fallback : value;
}

function validateNumber(value, settingName, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        throw new Error(`${settingName} must be a number between ${min} and ${max}`);
    }

    return number;
}

class SunberryBoilerDevice extends SunberryPollingDevice {
    async onInit() {
        this.controlApi = new SunberryBoilerControl();
        await this.controlApi.initializeLogger(this.homey);
        this.controlApi.setBaseUrl(this.getSetting('ip_address'));
        this.registerCapabilityListener('onoff', this.onActiveChanged.bind(this));
        await super.onInit();
    }

    createClient() {
        return new SunberryClient({ baseUrl: toSunberryBaseUrl(this.getSetting('ip_address')) });
    }

    async pollOnce() {
        const values = await this.createClient().getBoilerValues();
        const updates = normalizeBoilerMeasurements(values, { phaseCount: this.getPhaseCount() });
        const estimatedBoilerMeter = await updateEstimatedBoilerMeter(this, updates.measure_power);
        if (estimatedBoilerMeter !== null) {
            updates.meter_power = estimatedBoilerMeter;
        }
        await applyCapabilityUpdates(this, updates);
    }

    getPhaseCount() {
        return 1;
    }

    async onSettings(args) {
        if (args.changedKeys.includes('ip_address')) {
            this.controlApi.setBaseUrl(args.newSettings.ip_address);
        }

        const settings = this.getMergedSettings(args.newSettings);
        if (args.changedKeys.some(key => BOILER_TIMER_SETTING_KEYS.includes(key))) {
            await this.controlApi.updateTimer(this.getBoilerTimerSettings(settings));
        }

        const installationSettingKeys = this.getBoilerInstallationSettingKeys();
        if (args.changedKeys.some(key => installationSettingKeys.includes(key))) {
            await this.controlApi.updateSettings(this.getBoilerInstallationSettings(settings));
        }

        await super.onSettings(args);
    }

    getMergedSettings(newSettings = {}) {
        return {
            ...this.getSettings(),
            ...newSettings
        };
    }

    getBoilerTimerSettings(settings = this.getSettings()) {
        const minTemperature = validateNumber(
            valueOrDefault(settings.boiler_default_min_temperature, DEFAULT_MIN_TEMPERATURE),
            'Default minimum water temperature',
            { min: 0, max: 60 }
        );
        const maxTemperature = validateNumber(
            valueOrDefault(settings.boiler_default_max_temperature, DEFAULT_MAX_TEMPERATURE),
            'Default maximum water temperature',
            { min: 30, max: 80 }
        );

        if (minTemperature > maxTemperature) {
            throw new Error('Default minimum water temperature must not be higher than default maximum water temperature');
        }

        return {
            minTemperature,
            maxTemperature,
            powerRouting: Boolean(valueOrDefault(settings.boiler_power_routing, DEFAULT_POWER_ROUTING))
        };
    }

    getBoilerInstallationSettingKeys() {
        return [];
    }

    getBoilerInstallationSettings() {
        throw new Error('Boiler installation settings are not implemented for this device type');
    }

    async onActiveChanged(value) {
        if (value) {
            await this.turnOnBoiler();
        } else {
            await this.controlApi.disable();
            await this.setCapabilityValue('onoff', false);
        }

        return true;
    }

    getBoilerTimerSettingsWithOverride(args = {}) {
        const powerRouting = args.power_routing === 'with'
            ? true
            : args.power_routing === 'without'
                ? false
                : undefined;

        return this.getBoilerTimerSettings({
            ...this.getSettings(),
            ...(powerRouting === undefined ? {} : { boiler_power_routing: powerRouting })
        });
    }

    async turnOnBoiler(args = {}) {
        await this.controlApi.enable(this.getBoilerTimerSettingsWithOverride(args));
        await this.setCapabilityValue('onoff', true);
        return true;
    }
}

module.exports = SunberryBoilerDevice;
