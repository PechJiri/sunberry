'use strict';

let HomeyDevice = class {};
try {
    HomeyDevice = require('homey').Device;
} catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

async function applyCapabilityUpdates(device, updates) {
    for (const [capability, value] of Object.entries(updates)) {
        if (typeof value === 'number' && !Number.isFinite(value)) continue;
        if (!device.hasCapability(capability)) continue;
        if (device.getCapabilityValue(capability) === value) continue;
        await device.setCapabilityValue(capability, value);
    }
}

class SunberryPollingDevice extends HomeyDevice {
    async onInit() {
        this.pollingTimer = null;
        await this.setAvailable();
        await this.pollAndSetAvailability();
        this.scheduleNextPoll();
    }

    getUpdateIntervalMs() {
        const seconds = Math.max(Number(this.getSetting('update_interval')) || 10, 5);
        return seconds * 1000;
    }

    scheduleNextPoll() {
        this.clearPollingTimer();
        this.pollingTimer = this.homey.setTimeout(async () => {
            await this.pollAndSetAvailability();
            this.scheduleNextPoll();
        }, this.getUpdateIntervalMs());
    }

    clearPollingTimer() {
        if (!this.pollingTimer) return;
        this.homey.clearTimeout(this.pollingTimer);
        this.pollingTimer = null;
    }

    async pollAndSetAvailability() {
        try {
            await this.pollOnce();
            await this.setAvailable();
        } catch (error) {
            this.error(error);
            await this.setUnavailable(error.message);
        }
    }

    async onSettings({ changedKeys }) {
        if (changedKeys.includes('update_interval')) {
            this.scheduleNextPoll();
        }

        if (changedKeys.includes('ip_address')) {
            await this.pollAndSetAvailability();
        }
    }

    async onDeleted() {
        this.clearPollingTimer();
    }

    async pollOnce() {
        throw new Error('pollOnce must be implemented by subclass');
    }
}

module.exports = {
    SunberryPollingDevice,
    applyCapabilityUpdates
};
