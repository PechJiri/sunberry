'use strict';

const CookieManager = require('./CookieManager');
const Logger = require('./Logger');

const SETTINGS_ENDPOINT = '/boiler/settings';
const TIMERS_ENDPOINT = '/boiler/timers';
const ACTIVE_ENDPOINT = '/boiler/boiler_active_change';
const DAYS = {
    Mon_0: 'Mon_0',
    Tue_0: 'Tue_0',
    Wed_0: 'Wed_0',
    Thu_0: 'Thu_0',
    Fri_0: 'Fri_0',
    Sat_0: 'Sat_0',
    Sun_0: 'Sun_0'
};

function buildBoilerTimerPayload({
    minTemperature = 40,
    maxTemperature = 60,
    powerRouting = true
} = {}) {
    const payload = {
        start_0: '00:00',
        stop_0: '23:59',
        min_temperature_0: String(minTemperature),
        max_temperature_0: String(maxTemperature)
    };

    if (powerRouting) {
        payload.power_routing_0 = 'on';
    }

    return {
        ...payload,
        ...DAYS,
        submit: ''
    };
}

function buildBoiler1FSettingsPayload({
    power = 3000,
    regulationOffset = 300,
    phaseConnected = 'R',
    output = 'DO1'
} = {}) {
    const outputs = {
        output_R: 'DO3',
        output_S: 'DO3',
        output_T: 'DO3'
    };
    const outputKeyByPhase = {
        R: 'output_R',
        S: 'output_S',
        T: 'output_T'
    };
    outputs[outputKeyByPhase[phaseConnected]] = output;

    return {
        boiler_power: String(power),
        regulation_offset: String(regulationOffset),
        no_phases: '1',
        phase_connected: String(phaseConnected),
        regulation_type: 'asymmetric',
        ...outputs
    };
}

function buildBoiler3FSettingsPayload({
    power = 3000,
    regulationOffset = 300,
    regulationType = 'symmetric',
    outputL1 = 'DO3',
    outputL2 = 'DO3',
    outputL3 = 'DO3'
} = {}) {
    const outputs = regulationType === 'symmetric'
        ? {
            output_R: String(outputL1),
            output_S: String(outputL1),
            output_T: String(outputL1)
        }
        : {
            output_R: String(outputL1),
            output_S: String(outputL2),
            output_T: String(outputL3)
        };

    return {
        boiler_power: String(power),
        regulation_offset: String(regulationOffset),
        no_phases: '3',
        phase_connected: 'R',
        regulation_type: String(regulationType),
        ...outputs
    };
}

class SunberryBoilerControl {
    constructor({ fetchImpl = fetch, cookieManager = null } = {}) {
        this.fetch = fetchImpl;
        this.cookieManager = cookieManager || new CookieManager(null);
        this.baseUrl = null;
        this.logger = null;
    }

    async initializeLogger(homey) {
        if (!homey) throw new Error('Homey instance is required to initialize the logger.');
        if (!homey.appLogger) {
            this.logger = new Logger(homey, 'SunberryBoilerControl');
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

    async post(endpoint, payload) {
        if (!this.baseUrl) throw new Error('Sunberry boiler base URL is not configured');
        const cookie = await this.cookieManager.getCookie(this.baseUrl, SETTINGS_ENDPOINT);
        const formData = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => formData.append(key, value));

        const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cache-Control': 'max-age=0',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': `session=${cookie}`,
                'Origin': this.baseUrl,
                'Referer': `${this.baseUrl}${SETTINGS_ENDPOINT}`,
                'User-Agent': 'Mozilla/5.0'
            },
            body: formData,
            signal: AbortSignal.timeout(10000),
            redirect: 'manual'
        });

        if (response.status !== 200 && response.status !== 302) {
            throw new Error(`Sunberry boiler control returned HTTP ${response.status}`);
        }

        return { success: true, data: await response.text() };
    }

    async setActive(isActive) {
        if (!this.baseUrl) throw new Error('Sunberry boiler base URL is not configured');
        const cookie = await this.cookieManager.getCookie(this.baseUrl, SETTINGS_ENDPOINT);
        const response = await this.fetch(`${this.baseUrl}${ACTIVE_ENDPOINT}/${isActive ? 'True' : 'False'}`, {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': `session=${cookie}`,
                'Referer': `${this.baseUrl}${SETTINGS_ENDPOINT}`,
                'User-Agent': 'Mozilla/5.0'
            },
            signal: AbortSignal.timeout(10000),
            redirect: 'manual'
        });

        if (response.status !== 200 && response.status !== 302) {
            throw new Error(`Sunberry boiler active change returned HTTP ${response.status}`);
        }

        return { success: true, data: await response.text() };
    }

    async enable(timerSettings = {}) {
        await this.post(TIMERS_ENDPOINT, buildBoilerTimerPayload(timerSettings));
        return this.setActive(true);
    }

    async updateTimer(timerSettings = {}) {
        return this.post(TIMERS_ENDPOINT, buildBoilerTimerPayload(timerSettings));
    }

    async updateSettings(payload) {
        return this.post(SETTINGS_ENDPOINT, payload);
    }

    async disable() {
        return this.setActive(false);
    }
}

module.exports = {
    buildBoiler1FSettingsPayload,
    buildBoiler3FSettingsPayload,
    buildBoilerTimerPayload,
    SunberryBoilerControl
};
