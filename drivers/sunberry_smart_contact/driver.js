'use strict';

const { createSunberryDriver } = require('../../lib/SunberrySplitDriver');

module.exports = createSunberryDriver({
    type: 'smart_contact',
    name: 'Sunberry Smart Contact',
    testMethod: 'getSmartContactValues',
    defaultSettings: {
        smart_contact_timer_start: '00:00',
        smart_contact_timer_stop: '23:59',
        smart_contact_timer_mode: 'battery',
        smart_contact_power: 1200,
        smart_contact_overflow_offset: '',
        smart_contact_soc_min: 90,
        smart_contact_min_time: 20,
        smart_contact_output: 'DO1',
        smart_contact_priority: 'soc'
    }
});
