'use strict';

const registeredHomeys = new WeakSet();

function getDevice(args) {
    if (!args || !args.device) throw new Error('Device is required');
    return args.device;
}

function registerSmartContactFlowCards(homey) {
    if (registeredHomeys.has(homey)) return;
    registeredHomeys.add(homey);

    homey.flow.getActionCard('turn_on_smart_contact_with_mode').registerRunListener(async (args) => {
        return getDevice(args).turnOnSmartContact(args);
    });
}

module.exports = {
    registerSmartContactFlowCards
};
