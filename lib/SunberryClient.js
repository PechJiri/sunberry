'use strict';

const {
    parseBatteryValues,
    parseBackupValues,
    parseGridValues,
    parsePvValues
} = require('./SunberryParsers');
const { resolveBaseUrl } = require('./SunberryHostResolver');
const { enqueueByKey } = require('./SunberryRequestQueue');

const MAX_HTML_RESPONSE_BYTES = 500 * 1024;

class SunberryClient {
    constructor({ baseUrl, fetchImpl = fetch, hostLookup } = {}) {
        if (!baseUrl) throw new Error('baseUrl is required');
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetch = fetchImpl;
        this.hostLookup = hostLookup;
    }

    async getHtml(endpoint) {
        const fetchBaseUrl = await resolveBaseUrl(this.baseUrl, { lookup: this.hostLookup });

        return enqueueByKey(fetchBaseUrl, async () => {
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
}

module.exports = SunberryClient;
module.exports.MAX_HTML_RESPONSE_BYTES = MAX_HTML_RESPONSE_BYTES;
