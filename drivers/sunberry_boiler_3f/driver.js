'use strict';

const { registerBoilerFlowCards } = require('../../lib/BoilerFlowCards');
const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

const BaseDriver = createSunberryDriver({
    type: 'boiler_3f',
    name: 'Sunberry Boiler 3F',
    testMethod: 'getBoilerValues'
});

class SunberryBoiler3FDriver extends BaseDriver {
    async onInit() {
        await super.onInit();
        registerBoilerFlowCards(this.homey);
    }
}

module.exports = SunberryBoiler3FDriver;
