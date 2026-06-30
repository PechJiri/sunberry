'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'smart_meter',
    name: 'Sunberry Smart Meter',
    testMethod: 'getEnergyBalanceValues'
});
