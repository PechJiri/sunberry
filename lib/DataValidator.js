'use strict';

class DataValidator {
    static validateCapabilityValue(capability, value) {
        if (typeof value !== 'number' || isNaN(value)) {
            return false;
        }

        switch (capability) {
            case 'measure_battery_percent':
                return value >= 0 && value <= 100;
            case 'stored_energy_kWh':
            case 'remaining_kWh_to_full':
                return value >= 0;
            case 'measure_L1':
            case 'measure_L2':
            case 'measure_L3':
            case 'measure_total':
            case 'battery_max_charging_power':
                return true;
            default:
                return false;
        }
    }

    static validateIPAddress(ip) {
        if (!ip) return false;

        const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipPattern.test(ip);
    }

    static validateHostname(hostname) {
        if (!hostname) return false;

        const hostnamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return hostnamePattern.test(hostname) && hostname !== 'localhost';
    }

    static validateHost(host) {
        return this.validateIPAddress(host) || this.validateHostname(host);
    }

    static validateInterval(interval, minInterval = 5) {
        return typeof interval === 'number'
            && !isNaN(interval)
            && interval >= minInterval;
    }

    static validateChargingLimit(limit, maxChargingPower) {
        if (typeof limit !== 'number' || isNaN(limit)) {
            console.log('Charging limit is not a number:', limit);
            return false;
        }

        if (limit < 100) {
            console.log('Charging limit is below minimum 100W:', limit);
            return false;
        }

        if (typeof maxChargingPower === 'number' && !isNaN(maxChargingPower)) {
            if (limit > maxChargingPower) {
                console.log(`Charging limit ${limit}W exceeds maximum allowed power ${maxChargingPower}W`);
                return false;
            }
        } else if (limit > 12000) {
            console.log('Charging limit exceeds fallback maximum 12000W:', limit);
            return false;
        }

        return true;
    }

    static normalizeChargingLimit(limit, maxChargingPower) {
        const numericLimit = Number(limit);

        if (typeof numericLimit !== 'number' || isNaN(numericLimit) || numericLimit < 100) {
            throw new Error(`Invalid charging limit: ${limit}`);
        }

        if (typeof maxChargingPower === 'number' && !isNaN(maxChargingPower) && maxChargingPower >= 100) {
            return Math.min(numericLimit, maxChargingPower);
        }

        if (numericLimit > 12000) {
            throw new Error(`Invalid charging limit: ${limit}`);
        }

        return numericLimit;
    }

    static validateGridValues(values) {
        return values && typeof values === 'object'
            && typeof values.L1 === 'number'
            && typeof values.L2 === 'number'
            && typeof values.L3 === 'number'
            && typeof values.Total === 'number';
    }

    static validateBatteryValues(values) {
        return values && typeof values === 'object'
            && typeof values.actual_kWh === 'number'
            && typeof values.actual_percent === 'number'
            && typeof values.max_charging_power === 'number';
    }

    static validateFlowTriggerArgs(args) {
        if (!args) return false;

        if (args.target_level !== undefined) {
            return typeof args.target_level === 'number'
                && !isNaN(args.target_level)
                && args.target_level >= 0
                && args.target_level <= 100;
        }

        if (args.power !== undefined) {
            return typeof args.power === 'number'
                && !isNaN(args.power)
                && args.power >= 0;
        }

        if (args.level !== undefined && args.comparison !== undefined) {
            return typeof args.level === 'number'
                && !isNaN(args.level)
                && args.level >= 0
                && args.level <= 100
                && ['below', 'above'].includes(args.comparison);
        }

        return false;
    }

    static validateBatteryTarget(value, comparison = null) {
        const isValidValue = typeof value === 'number'
            && !isNaN(value)
            && value >= 0
            && value <= 100;

        if (comparison) {
            return isValidValue && ['below', 'above'].includes(comparison);
        }

        return isValidValue;
    }

    static validateSettings(settings) {
        return settings
            && this.validateInterval(settings.update_interval)
            && this.validateHost(settings.ip_address)
            && this.validateChargingLimit(settings.force_charging_limit)
            && typeof settings.enable_debug_logs === 'boolean';
    }
}

module.exports = DataValidator;
