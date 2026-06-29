'use strict';

const CookieManager = require('./CookieManager');
const Logger = require('./Logger');

const BATTERY_MANAGEMENT_ENDPOINT = '/battery_management/timers';
const DAYS = {
    Mon_0: 'Mon_0',
    Tue_0: 'Tue_0',
    Wed_0: 'Wed_0',
    Thu_0: 'Thu_0',
    Fri_0: 'Fri_0',
    Sat_0: 'Sat_0',
    Sun_0: 'Sun_0'
};

function timerBasePayload() {
    return {
        start_0: '00:00',
        stop_0: '23:59',
        ...DAYS,
        submit: ''
    };
}

function buildEnableForceChargingPayload(limit) {
    return {
        ...timerBasePayload(),
        force_chg_enable_0: 'on',
        force_chg_power_0: String(limit)
    };
}

function buildDisableForceChargingPayload(lastLimit = 7000) {
    return {
        ...timerBasePayload(),
        force_chg_power_0: String(lastLimit),
        bat_chg_limit_power_0: '0'
    };
}

function buildBlockBatteryDischargePayload() {
    return {
        ...timerBasePayload(),
        bat_chg_limit_power_0: '0',
        block_bat_dis_0: 'on'
    };
}

function buildEnableBatteryDischargePayload() {
    return {
        ...timerBasePayload(),
        force_chg_power_0: '100',
        bat_chg_limit_power_0: '0'
    };
}

class SunberryBatteryControl {
    constructor({ fetchImpl = fetch, cookieManager = null } = {}) {
        this.fetch = fetchImpl;
        this.cookieManager = cookieManager || new CookieManager(null);
        this.baseUrl = null;
        this.logger = null;
        this.lastForceChargingLimit = 7000;
    }

    async initializeLogger(homey) {
        if (!homey) throw new Error('Homey instance is required to initialize the logger.');
        if (!homey.appLogger) {
            this.logger = new Logger(homey, 'SunberryBatteryControl');
            homey.appLogger = this.logger;
        } else {
            this.logger = homey.appLogger;
        }
        this.cookieManager.logger = this.logger;
    }

    setBaseUrl(ipAddressOrHost) {
        const value = String(ipAddressOrHost || '').trim();
        if (!value) throw new Error('ip_address setting is required');
        this.baseUrl = value.startsWith('http://') || value.startsWith('https://')
            ? value.replace(/\/$/, '')
            : `http://${value}`;
    }

    async post(payload) {
        if (!this.baseUrl) throw new Error('Sunberry battery control base URL is not configured');
        const cookie = await this.cookieManager.getCookie(this.baseUrl);
        const formData = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => formData.append(key, value));

        const response = await this.fetch(`${this.baseUrl}${BATTERY_MANAGEMENT_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cache-Control': 'max-age=0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': `session=${cookie}`,
                'Origin': this.baseUrl,
                'Referer': `${this.baseUrl}/battery_management/settings`,
                'User-Agent': 'Mozilla/5.0'
            },
            body: formData,
            signal: AbortSignal.timeout(10000),
            redirect: 'manual'
        });

        if (response.status !== 200 && response.status !== 302) {
            throw new Error(`Sunberry battery control returned HTTP ${response.status}`);
        }

        return { success: true, data: await response.text() };
    }

    async enableForceCharging(limit) {
        this.lastForceChargingLimit = limit;
        return this.post(buildEnableForceChargingPayload(limit));
    }

    async disableForceCharging() {
        return this.post(buildDisableForceChargingPayload(this.lastForceChargingLimit));
    }

    async blockBatteryDischarge() {
        return this.post(buildBlockBatteryDischargePayload());
    }

    async enableBatteryDischarge() {
        return this.post(buildEnableBatteryDischargePayload());
    }
}

module.exports = SunberryBatteryControl;
module.exports.buildEnableForceChargingPayload = buildEnableForceChargingPayload;
module.exports.buildDisableForceChargingPayload = buildDisableForceChargingPayload;
module.exports.buildBlockBatteryDischargePayload = buildBlockBatteryDischargePayload;
module.exports.buildEnableBatteryDischargePayload = buildEnableBatteryDischargePayload;
