'use strict';

const SunberryBoilerDevice = require('../../lib/SunberryBoilerDevice');
const { buildBoiler3FSettingsPayload } = require('../../lib/SunberryBoilerControl');

const BOILER_3F_INSTALLATION_SETTING_KEYS = [
    'boiler_3f_power',
    'boiler_3f_regulation_offset',
    'boiler_3f_regulation_type',
    'boiler_3f_output_l1',
    'boiler_3f_output_l2',
    'boiler_3f_output_l3'
];
const OUTPUTS = ['DO1', 'DO2', 'DO3', 'DO4'];
const REGULATION_TYPES = ['symmetric', 'asymmetric'];

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

class SunberryBoiler3FDevice extends SunberryBoilerDevice {
    getPhaseCount() {
        return 3;
    }

    getBoilerInstallationSettingKeys() {
        return BOILER_3F_INSTALLATION_SETTING_KEYS;
    }

    getBoilerInstallationSettings(settings = this.getSettings()) {
        return buildBoiler3FSettingsPayload({
            power: validateNumber(
                valueOrDefault(settings.boiler_3f_power, 3000),
                'Boiler power',
                { min: 0 }
            ),
            regulationOffset: validateNumber(
                valueOrDefault(settings.boiler_3f_regulation_offset, 300),
                'Regulation offset',
                { min: 0 }
            ),
            regulationType: validateEnum(
                valueOrDefault(settings.boiler_3f_regulation_type, 'symmetric'),
                REGULATION_TYPES,
                'Regulation type'
            ),
            outputL1: validateEnum(
                valueOrDefault(settings.boiler_3f_output_l1, 'DO3'),
                OUTPUTS,
                'L1 output'
            ),
            outputL2: validateEnum(
                valueOrDefault(settings.boiler_3f_output_l2, 'DO3'),
                OUTPUTS,
                'L2 output'
            ),
            outputL3: validateEnum(
                valueOrDefault(settings.boiler_3f_output_l3, 'DO3'),
                OUTPUTS,
                'L3 output'
            )
        });
    }
}

module.exports = SunberryBoiler3FDevice;
