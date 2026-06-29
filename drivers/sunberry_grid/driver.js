'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'grid',
    name: 'Sunberry Grid',
    testMethod: 'getGridValues'
});
