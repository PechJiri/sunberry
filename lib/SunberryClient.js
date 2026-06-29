'use strict';

const {
    parseBatteryValues,
    parseBackupValues,
    parseGridValues,
    parsePvValues
} = require('./SunberryParsers');

class SunberryClient {
    constructor({ baseUrl, fetchImpl = fetch } = {}) {
        if (!baseUrl) throw new Error('baseUrl is required');
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetch = fetchImpl;
    }

    async getHtml(endpoint) {
        const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
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

        return response.text();
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
