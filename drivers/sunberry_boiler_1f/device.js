'use strict';

const SunberryBoilerDevice = require('../../lib/SunberryBoilerDevice');
const { buildBoiler1FSettingsPayload } = require('../../lib/SunberryBoilerControl');

const BOILER_1F_INSTALLATION_SETTING_KEYS = [
    'boiler_1f_power',
    'boiler_1f_regulation_offset',
    'boiler_1f_phase_connected',
    'boiler_1f_output'
];
const OUTPUTS = ['DO1', 'DO2', 'DO3', 'DO4'];
const PHASES = ['R', 'S', 'T'];

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

function validateEnum(value, allowedValues, settingName) {
    const text = String(value || '').trim();
    if (!allowedValues.includes(text)) {
        throw new Error(`${settingName} must be one of: ${allowedValues.join(', ')}`);
    }

    return text;
}

class SunberryBoiler1FDevice extends SunberryBoilerDevice {
    getBoilerInstallationSettingKeys() {
        return BOILER_1F_INSTALLATION_SETTING_KEYS;
    }

    getBoilerInstallationSettings(settings = this.getSettings()) {
        return buildBoiler1FSettingsPayload({
            power: validateNumber(
                valueOrDefault(settings.boiler_1f_power, 3000),
                'Boiler power',
                { min: 0 }
            ),
            regulationOffset: validateNumber(
                valueOrDefault(settings.boiler_1f_regulation_offset, 300),
                'Regulation offset',
                { min: 0 }
            ),
            phaseConnected: validateEnum(
                valueOrDefault(settings.boiler_1f_phase_connected, 'R'),
                PHASES,
                'Connected boiler phase'
            ),
            output: validateEnum(
                valueOrDefault(settings.boiler_1f_output, 'DO1'),
                OUTPUTS,
                'Connected output'
            )
        });
    }
}

module.exports = SunberryBoiler1FDevice;
