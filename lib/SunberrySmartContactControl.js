'use strict';

const CookieManager = require('./CookieManager');
const Logger = require('./Logger');

const SETTINGS_ENDPOINT = '/heat_pump/settings';
const TIMERS_ENDPOINT = '/heat_pump/timers';
const ACTIVE_ENDPOINT = '/heat_pump/active_change';
const DAYS = {
    Mon_0: 'Mon_0',
    Tue_0: 'Tue_0',
    Wed_0: 'Wed_0',
    Thu_0: 'Thu_0',
    Fri_0: 'Fri_0',
    Sat_0: 'Sat_0',
    Sun_0: 'Sun_0'
};

function buildSmartContactTimerPayload({
    start = '00:00',
    stop = '23:59',
    mode = 'battery'
} = {}) {
    return {
        start_0: start,
        stop_0: stop,
        mode_0: mode,
        ...DAYS,
        submit: ''
    };
}

function buildSmartContactSettingsPayload({
    power,
    overflowOffset,
    socMin,
    minTime,
    output,
    priority
}) {
    return {
        power: String(power),
        overflow_offset: overflowOffset === undefined || overflowOffset === null ? '' : String(overflowOffset),
        soc_min: String(socMin),
        min_time: String(minTime),
        output: String(output),
        priority: String(priority)
    };
}

class SunberrySmartContactControl {
    constructor({ fetchImpl = fetch, cookieManager = null } = {}) {
        this.fetch = fetchImpl;
        this.cookieManager = cookieManager || new CookieManager(null);
        this.baseUrl = null;
        this.logger = null;
    }

    async initializeLogger(homey) {
        if (!homey) throw new Error('Homey instance is required to initialize the logger.');
        if (!homey.appLogger) {
            this.logger = new Logger(homey, 'SunberrySmartContactControl');
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
        if (!this.baseUrl) throw new Error('Sunberry smart contact base URL is not configured');
        const cookie = await this.cookieManager.getCookie(this.baseUrl);
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
            throw new Error(`Sunberry smart contact control returned HTTP ${response.status}`);
        }

        return { success: true, data: await response.text() };
    }

    async setActive(isActive) {
        if (!this.baseUrl) throw new Error('Sunberry smart contact base URL is not configured');
        const cookie = await this.cookieManager.getCookie(this.baseUrl);
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
            throw new Error(`Sunberry smart contact active change returned HTTP ${response.status}`);
        }

        return { success: true, data: await response.text() };
    }

    async enable(timerSettings = {}) {
        await this.post(TIMERS_ENDPOINT, buildSmartContactTimerPayload(timerSettings));
        return this.setActive(true);
    }

    async disable() {
        return this.setActive(false);
    }

    async updateSettings(settings) {
        return this.post(SETTINGS_ENDPOINT, buildSmartContactSettingsPayload(settings));
    }
}

module.exports = {
    buildSmartContactSettingsPayload,
    buildSmartContactTimerPayload,
    SunberrySmartContactControl
};
