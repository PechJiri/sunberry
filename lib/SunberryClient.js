'use strict';

const {
    parseBatteryValues,
    parseBackupValues,
    parseBoilerValues,
    parseGridValues,
    parseHeatPumpValues,
    parsePvValues
} = require('./SunberryParsers');
const { resolveBaseUrl } = require('./SunberryHostResolver');
const { enqueueByKey } = require('./SunberryRequestQueue');

const MAX_HTML_RESPONSE_BYTES = 500 * 1024;
const HTML_CACHE_TTL_MS = 4500;
const htmlCache = new Map();

function getCachedHtml(cacheKey, now = Date.now()) {
    const cached = htmlCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= now) {
        htmlCache.delete(cacheKey);
        return null;
    }
    return cached.html;
}

function setCachedHtml(cacheKey, html, now = Date.now()) {
    htmlCache.set(cacheKey, {
        html,
        expiresAt: now + HTML_CACHE_TTL_MS
    });
}

class SunberryClient {
    constructor({ baseUrl, fetchImpl = fetch, hostLookup } = {}) {
        if (!baseUrl) throw new Error('baseUrl is required');
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetch = fetchImpl;
        this.hostLookup = hostLookup;
    }

    async getHtml(endpoint) {
        const fetchBaseUrl = await resolveBaseUrl(this.baseUrl, { lookup: this.hostLookup });
        const cacheKey = `${fetchBaseUrl}${endpoint}`;
        const cachedHtml = getCachedHtml(cacheKey);
        if (cachedHtml !== null) return cachedHtml;

        return enqueueByKey(fetchBaseUrl, async () => {
            const queuedCachedHtml = getCachedHtml(cacheKey);
            if (queuedCachedHtml !== null) return queuedCachedHtml;

            const response = await this.fetch(`${fetchBaseUrl}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store',
                    'Pragma': 'no-cache',
                    'User-Agent': 'HomeyApp/1.0',
                    'Accept': '*/*'
                },
                signal: AbortSignal.timeout(10000),
                redirect: 'manual'
            });

            if (response.status !== 200) {
                throw new Error(`Sunberry endpoint ${endpoint} returned HTTP ${response.status}`);
            }

            const contentLength = Number(response.headers?.get?.('content-length'));
            if (Number.isFinite(contentLength) && contentLength > MAX_HTML_RESPONSE_BYTES) {
                throw new Error(`Sunberry endpoint ${endpoint} response is too large`);
            }

            const html = await response.text();
            if (Buffer.byteLength(html, 'utf8') > MAX_HTML_RESPONSE_BYTES) {
                throw new Error(`Sunberry endpoint ${endpoint} response is too large`);
            }

            setCachedHtml(cacheKey, html);
            return html;
        });
    }

    async getBatteryValues() {
        return parseBatteryValues(await this.getHtml('/battery/values'));
    }

    async getSolarValues() {
        return parsePvValues(await this.getHtml('/pv/values'));
    }

    async getGridValues() {
        return parseGridValues(await this.getHtml('/grid/values'));
    }

    async getBackupValues() {
        return parseBackupValues(await this.getHtml('/backup/values'));
    }

    async getBoilerValues() {
        return parseBoilerValues(await this.getHtml('/boiler/boiler_values'));
    }

    async getSmartContactValues() {
        return parseHeatPumpValues(await this.getHtml('/heat_pump/heat_pump_values'));
    }

    async getEnergyBalanceValues() {
        const [battery, solar, grid] = await Promise.all([
            this.getBatteryValues(),
            this.getSolarValues(),
            this.getGridValues()
        ]);

        return { battery, solar, grid };
    }
}

module.exports = SunberryClient;
module.exports.MAX_HTML_RESPONSE_BYTES = MAX_HTML_RESPONSE_BYTES;
module.exports.HTML_CACHE_TTL_MS = HTML_CACHE_TTL_MS;
module.exports._private = {
    htmlCache,
    getCachedHtml,
    setCachedHtml
};
