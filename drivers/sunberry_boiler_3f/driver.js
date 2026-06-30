'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'boiler_3f',
    name: 'Sunberry Boiler 3F',
    testMethod: 'getBoilerValues'
});
