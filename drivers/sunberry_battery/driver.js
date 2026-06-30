'use strict';

const { registerBatteryFlowCards } = require('../../lib/BatteryFlowCards');
const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

const BaseDriver = createSunberryDriver({
    type: 'battery',
    name: 'Sunberry Battery',
    testMethod: 'getBatteryValues',
    defaultSettings: {
        force_charging_limit: 5000
    }
});

class SunberryBatteryDriver extends BaseDriver {
    async onInit() {
        await super.onInit();
        registerBatteryFlowCards(this.homey);
    }
}

module.exports = SunberryBatteryDriver;
