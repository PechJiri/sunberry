'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'solar',
    name: 'Sunberry Solar',
    testMethod: 'getSolarValues'
});
