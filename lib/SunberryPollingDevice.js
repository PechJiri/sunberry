'use strict';

let HomeyDevice = class {};
try {
    if (process.env.NODE_ENV !== 'test') {
        const Homey = require('homey');
        if (typeof Homey.Device === 'function') {
            HomeyDevice = Homey.Device;
        }
    }
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

const MAX_POLLING_FAILURES_BEFORE_UNAVAILABLE = 3;
const MAX_BACKOFF_POLLING_INTERVAL_MS = 2 * 60 * 1000;
const SELF_HEAL_POLLING_INTERVAL_MS = MAX_BACKOFF_POLLING_INTERVAL_MS;
const INITIAL_POLLING_JITTER_MS = 3000;

class SunberryPollingDevice extends HomeyDevice {
    async onInit() {
        this.pollingTimer = null;
        this.pollingFailureCount = 0;
        this.pollInFlight = null;
        await this.setAvailableSafely();
        this.scheduleNextPoll({ initial: true });
    }

    getUpdateIntervalMs() {
        const seconds = Math.max(Number(this.getSetting('update_interval')) || 10, 5);
        return seconds * 1000;
    }

    scheduleNextPoll({ initial = false } = {}) {
        this.clearPollingTimer();
        const delayMs = initial ? this.getInitialPollingDelayMs() : this.getNextPollingDelayMs();
        this.pollingTimer = this.homey.setTimeout(async () => {
            await this.pollAndSetAvailability();
            this.scheduleNextPoll();
        }, delayMs);
    }

    getInitialPollingDelayMs() {
        return Math.floor(Math.random() * INITIAL_POLLING_JITTER_MS);
    }

    getNextPollingDelayMs() {
        const updateIntervalMs = this.getUpdateIntervalMs();
        if (!this.pollingFailureCount) return updateIntervalMs;

        return Math.min(
            updateIntervalMs * (2 ** this.pollingFailureCount),
            MAX_BACKOFF_POLLING_INTERVAL_MS
        );
    }

    clearPollingTimer() {
        if (!this.pollingTimer) return;
        this.homey.clearTimeout(this.pollingTimer);
        this.pollingTimer = null;
    }

    async pollAndSetAvailability() {
        if (this.pollInFlight) return this.pollInFlight;

        this.pollInFlight = this.runPollAndSetAvailability().finally(() => {
            this.pollInFlight = null;
        });

        return this.pollInFlight;
    }

    async runPollAndSetAvailability() {
        try {
            await this.pollOnce();
            this.pollingFailureCount = 0;
            await this.setAvailableSafely();
            await this.markLastSeen();
            await this.clearWarning();
        } catch (error) {
            this.pollingFailureCount = (this.pollingFailureCount || 0) + 1;
            this.error(error);
            if (this.pollingFailureCount >= MAX_POLLING_FAILURES_BEFORE_UNAVAILABLE) {
                await this.setUnavailableSafely(error.message);
            } else {
                await this.setTransientWarning(error);
            }
        }
    }

    async markLastSeen() {
        if (typeof this.setLastSeenAt === 'function') {
            await this.runHomeyStatusUpdate(() => this.setLastSeenAt(new Date()));
        }
    }

    async clearWarning() {
        if (typeof this.unsetWarning === 'function') {
            await this.runHomeyStatusUpdate(() => this.unsetWarning());
        }
    }

    async setTransientWarning(error) {
        if (typeof this.setWarning === 'function') {
            await this.runHomeyStatusUpdate(() => this.setWarning(`Sunberry polling failed: ${error.message}`));
        }
    }

    async setAvailableSafely() {
        await this.runHomeyStatusUpdate(() => this.setAvailable());
    }

    async setUnavailableSafely(message) {
        await this.runHomeyStatusUpdate(() => this.setUnavailable(message));
    }

    async runHomeyStatusUpdate(operation) {
        try {
            await operation();
        } catch (error) {
            this.error(error);
        }
    }

    async onSettings({ changedKeys }) {
        if (changedKeys.includes('update_interval')) {
            this.scheduleNextPoll();
        }

        if (changedKeys.includes('ip_address')) {
            this.pollingFailureCount = 0;
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
    INITIAL_POLLING_JITTER_MS,
    MAX_BACKOFF_POLLING_INTERVAL_MS,
    MAX_POLLING_FAILURES_BEFORE_UNAVAILABLE,
    SELF_HEAL_POLLING_INTERVAL_MS,
    SunberryPollingDevice,
    applyCapabilityUpdates
};
