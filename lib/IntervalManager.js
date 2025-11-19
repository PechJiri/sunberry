'use strict';

const DEFAULT_SETTINGS = {
    MIN_INTERVAL: 5,
    DEFAULT_INTERVAL: 10,
    MAX_INTERVAL: 60,         // Maximální interval při chybách
    ERROR_MULTIPLIER: 1.5,    // Násobitel pro prodloužení intervalu při chybách
    SUCCESS_THRESHOLD: 300000 // 5 minut bez úspěchu -> zvýšení intervalu
};

class IntervalManager {
    constructor(device) {
        this.device = device;
        this.interval = null;
        this.currentInterval = DEFAULT_SETTINGS.DEFAULT_INTERVAL;
        this.lastSuccess = Date.now();
        this.consecutiveErrors = 0;
    }

    async startPolling() {
        const settings = this.device.getSettings();
        let interval = Math.max(
            settings.update_interval || DEFAULT_SETTINGS.DEFAULT_INTERVAL,
            DEFAULT_SETTINGS.MIN_INTERVAL
        );

        if (this.interval) {
            this.device.logger.debug('Resetuji existující polling interval');
            clearTimeout(this.interval);
        }

        // Adaptivní polling při chybách
        if (Date.now() - this.lastSuccess > DEFAULT_SETTINGS.SUCCESS_THRESHOLD) {
            interval = Math.min(
                interval * Math.pow(DEFAULT_SETTINGS.ERROR_MULTIPLIER, this.consecutiveErrors),
                DEFAULT_SETTINGS.MAX_INTERVAL
            );
            this.device.logger.warn(`Adaptuji polling interval kvůli chybám: ${interval}s`);
        }

        this.currentInterval = interval;
        this.device.logger.debug(`Nastavuji nový polling interval: ${interval}s`);

        const poll = async () => {
            if (!this.interval) return; // Zastaveno

            this.device.logger.debug('Spouštím polling cyklus');
            try {
                await this.device.fetchAndUpdateGridValues();
                await new Promise(resolve => setTimeout(resolve, 3000)); // Increased delay to 3s to prevent ETIMEDOUT
                await this.device.fetchAndUpdateBatteryValues();
                this.handleSuccess();
                this.device.logger.debug('Polling cyklus dokončen');
            } catch (error) {
                this.handleError(error);
            } finally {
                // Naplánovat další běh až po dokončení předchozího
                if (this.interval) {
                    this.interval = setTimeout(poll, this.currentInterval * 1000);
                }
            }
        };

        // Spustit první cyklus
        this.interval = setTimeout(poll, 0);

        this.device.logger.info(`Polling spuštěn s intervalem ${interval}s`);
    }

    handleSuccess() {
        this.lastSuccess = Date.now();
        this.consecutiveErrors = 0;

        // Vrátit na normální interval po úspěchu
        if (this.currentInterval > this.device.getSettings().update_interval) {
            this.updateInterval(this.device.getSettings().update_interval);
        }
    }

    handleError(error) {
        this.consecutiveErrors++;
        this.device.logger.error('Chyba při polling datech:', error);

        if (this.consecutiveErrors > 3) {
            this.startPolling(); // Přepočítat interval
        }
    }

    updateInterval(newInterval) {
        const interval = Math.max(newInterval, DEFAULT_SETTINGS.MIN_INTERVAL);
        if (interval !== this.currentInterval) {
            this.startPolling();
        }
    }

    stop() {
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }
    }
}

module.exports = IntervalManager;