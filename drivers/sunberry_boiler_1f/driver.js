'use strict';

const { registerBoilerFlowCards } = require('../../lib/BoilerFlowCards');
const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

const BaseDriver = createSunberryDriver({
    type: 'boiler_1f',
    name: 'Sunberry Boiler 1F',
    testMethod: 'getBoilerValues'
});

class SunberryBoiler1FDriver extends BaseDriver {
    async onInit() {
        await super.onInit();
        registerBoilerFlowCards(this.homey);
    }
}

module.exports = SunberryBoiler1FDriver;
