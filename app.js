'use strict';

const Homey = require('homey');
const Logger = require('./lib/Logger');
const { notifySunberryV3MigrationOnce } = require('./lib/SunberryMigrationNotification');

const APP_SETTINGS = {
    LOGGER_CONTEXT: 'SunberryApp',
    ERROR_HANDLERS: {
        UNCAUGHT_EXCEPTION: 'uncaughtException',
        UNHANDLED_REJECTION: 'unhandledRejection'
    }
};

class SunberryApp extends Homey.App {
    async initializeLogger() {
        try {
            if (!this.homey.appLogger) {
                this.logger = new Logger(this.homey, APP_SETTINGS.LOGGER_CONTEXT);
                this.logger.setEnabled(true);
                this.homey.appLogger = this.logger;
                this.logger.info('Sunberry app logger initialized');
            } else {
                this.logger = this.homey.appLogger;
                this.logger.info('Using existing global logger');
            }
        } catch (error) {
            console.error('Critical error while initializing logger:', error);
            throw error;
        }
    }

    async initializeGlobalListeners() {
        try {
            this.logger.info('Initializing global listeners');

            this.homey.on(APP_SETTINGS.ERROR_HANDLERS.UNCAUGHT_EXCEPTION, (error) => {
                this.logger.error('Unhandled exception:', error);
                this.handleGlobalError(error, APP_SETTINGS.ERROR_HANDLERS.UNCAUGHT_EXCEPTION);
            });

            this.homey.on(APP_SETTINGS.ERROR_HANDLERS.UNHANDLED_REJECTION, (reason) => {
                const error = reason instanceof Error ? reason : new Error(String(reason));
                this.logger.error('Unhandled promise rejection:', error);
                this.handleGlobalError(error, APP_SETTINGS.ERROR_HANDLERS.UNHANDLED_REJECTION);
            });

            this.logger.info('Global listeners initialized');
        } catch (error) {
            this.logger.error('Error while initializing global listeners:', error);
            throw error;
        }
    }

    async handleGlobalError(error, type) {
        try {
            this.logger.error(`Global error of type ${type}:`, {
                message: error?.message || String(error),
                stack: error?.stack,
                type: error?.name || typeof error,
                timestamp: new Date().toISOString()
            });
        } catch (handlingError) {
            console.error('Critical error while handling global error:', handlingError);
        }
    }

    async onInit() {
        try {
            await this.initializeLogger();
            await this.initializeGlobalListeners();
            await notifySunberryV3MigrationOnce(this.homey, this.logger);

            this.setState('ready');
            this.logger.info('Sunberry app initialized successfully');
        } catch (error) {
            console.error('Critical error while initializing app:', error);
            throw error;
        }
    }

    setState(state) {
        this.state = state;
        this.logger.info('App state changed:', { state });
    }

    getLogger() {
        if (!this.logger) {
            throw new Error('Logger is not initialized');
        }
        return this.logger;
    }

    async handleAppEvent(eventType, data) {
        try {
            this.logger.info('Handling app event:', { eventType, data });

            switch (eventType) {
                case 'deviceAdded':
                    await this.handleDeviceAdded(data);
                    break;
                case 'deviceRemoved':
                    await this.handleDeviceRemoved(data);
                    break;
                default:
                    this.logger.warn('Unknown app event type:', { eventType });
            }
        } catch (error) {
            this.logger.error('Error while handling app event:', error);
            throw error;
        }
    }

    async handleDeviceAdded(device) {
        this.logger.info('Device added:', { deviceId: device.id });
    }

    async handleDeviceRemoved(device) {
        this.logger.info('Device removed:', { deviceId: device.id });
    }
}

module.exports = SunberryApp;
