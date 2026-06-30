'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'boiler_1f',
    name: 'Sunberry Boiler 1F',
    testMethod: 'getBoilerValues'
});
