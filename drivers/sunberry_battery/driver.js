'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'battery',
    name: 'Sunberry Battery',
    testMethod: 'getBatteryValues',
    defaultSettings: {
        force_charging_limit: 5000
    }
});
