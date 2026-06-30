'use strict';

const registeredHomeys = new WeakSet();

function getDevice(args) {
    if (!args || !args.device) throw new Error('Device is required');
    return args.device;
}

function registerBoilerFlowCards(homey) {
    if (registeredHomeys.has(homey)) return;
    registeredHomeys.add(homey);

    homey.flow.getActionCard('turn_on_boiler_with_power_routing').registerRunListener(async (args) => {
        return getDevice(args).turnOnBoiler(args);
    });
}

module.exports = {
    registerBoilerFlowCards
};
