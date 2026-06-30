'use strict';

const SunberryClient = require('../../lib/SunberryClient');
const { SunberrySmartContactControl } = require('../../lib/SunberrySmartContactControl');
const { normalizeSmartContactMeasurements } = require('../../lib/SunberryMeasurements');
const { SunberryPollingDevice, applyCapabilityUpdates } = require('../../lib/SunberryPollingDevice');

const SMART_CONTACT_SETTING_KEYS = [
    'smart_contact_power',
    'smart_contact_overflow_offset',
    'smart_contact_soc_min',
    'smart_contact_min_time',
    'smart_contact_output',
    'smart_contact_priority'
];

function validateTime(value, settingName) {
    const text = String(value || '').trim();
    if (!/^\d{2}:\d{2}$/.test(text)) {
        throw new Error(`${settingName} must use HH:MM format`);
    }

    const [hours, minutes] = text.split(':').map(Number);
    if (hours > 23 || minutes > 59) {
        throw new Error(`${settingName} must be a valid time`);
    }

    return text;
}

function validateEnum(value, allowedValues, settingName) {
    const text = String(value || '').trim();
    if (!allowedValues.includes(text)) {
        throw new Error(`${settingName} must be one of: ${allowedValues.join(', ')}`);
    }

    return text;
}

function validateNumber(value, settingName, { min = 0, max = Number.POSITIVE_INFINITY } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        throw new Error(`${settingName} must be a number between ${min} and ${max}`);
    }

    return number;
}

function normalizeOptionalNumberText(value, settingName) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    validateNumber(text, settingName, { min: 0 });
    return text;
}

class SunberrySmartContactDevice extends SunberryPollingDevice {
    async onInit() {
        this.controlApi = new SunberrySmartContactControl();
        await this.controlApi.initializeLogger(this.homey);
        this.controlApi.setBaseUrl(this.getSetting('ip_address'));
        this.registerCapabilityListener('onoff', this.onActiveChanged.bind(this));
        await super.onInit();
    }

    createClient() {
        return new SunberryClient({ baseUrl: `http://${this.getSetting('ip_address')}` });
    }

    async pollOnce() {
        const values = await this.createClient().getSmartContactValues();
        const updates = normalizeSmartContactMeasurements(values);
        await applyCapabilityUpdates(this, updates);
    }

    async onSettings(args) {
        if (args.changedKeys.includes('ip_address')) {
            this.controlApi.setBaseUrl(args.newSettings.ip_address);
        }

        if (args.changedKeys.some(key => SMART_CONTACT_SETTING_KEYS.includes(key))) {
            await this.controlApi.updateSettings(this.getSmartContactSettings(args.newSettings));
        }

        await super.onSettings(args);
    }

    getSmartContactTimerSettings() {
        return {
            start: validateTime(this.getSetting('smart_contact_timer_start') || '00:00', 'Timer start'),
            stop: validateTime(this.getSetting('smart_contact_timer_stop') || '23:59', 'Timer stop'),
            mode: validateEnum(this.getSetting('smart_contact_timer_mode') || 'battery', [
                'battery',
                'pv_overflow',
                'combined',
                'off'
            ], 'Timer mode')
        };
    }

    getSmartContactSettings(settings = this.getSettings()) {
        return {
            power: validateNumber(settings.smart_contact_power, 'Switched load power', { min: 0 }),
            overflowOffset: normalizeOptionalNumberText(settings.smart_contact_overflow_offset, 'Overflow offset'),
            socMin: validateNumber(settings.smart_contact_soc_min, 'Minimum battery SOC', { min: 0, max: 100 }),
            minTime: validateNumber(settings.smart_contact_min_time, 'Minimum closed time', { min: 0 }),
            output: validateEnum(settings.smart_contact_output, ['DO1', 'DO2', 'DO3', 'DO4'], 'Digital output'),
            priority: validateEnum(settings.smart_contact_priority, ['soc', 'time'], 'Battery mode priority')
        };
    }

    async onActiveChanged(value) {
        if (value) {
            await this.controlApi.enable(this.getSmartContactTimerSettings());
        } else {
            await this.controlApi.disable();
        }

        await this.setCapabilityValue('onoff', value);
        return true;
    }
}

module.exports = SunberrySmartContactDevice;
