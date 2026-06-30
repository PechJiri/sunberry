'use strict';

const { didCrossBatteryLevel } = require('./FlowLogic');

const registeredHomeys = new WeakSet();

function getDevice(args) {
    if (!args || !args.device) throw new Error('Device is required');
    return args.device;
}

function registerBatteryFlowCards(homey) {
    if (registeredHomeys.has(homey)) return;
    registeredHomeys.add(homey);

    const flow = homey.flow;

    flow.getDeviceTriggerCard('battery_level_changed').registerRunListener(async (args, state) => {
        return didCrossBatteryLevel({
            previous: state.previous_battery_level,
            current: state.battery_level,
            target: args.target_level
        });
    });

    flow.getConditionCard('battery_level_check').registerRunListener(async (args) => {
        const currentLevel = getDevice(args).getCapabilityValue('measure_battery');
        return args.comparison === 'below'
            ? currentLevel < args.level
            : currentLevel > args.level;
    });

    flow.getConditionCard('is_battery_discharge_blocked').registerRunListener(async (args) => {
        const value = getDevice(args).getCapabilityValue('block_battery_discharge');
        return args.inverted ? !value : value;
    });

    flow.getConditionCard('is_force_charging').registerRunListener(async (args) => {
        const value = getDevice(args).getCapabilityValue('force_charging');
        return args.inverted ? !value : value;
    });

    flow.getActionCard('block_battery_discharge').registerRunListener(async (args) => {
        return getDevice(args).blockBatteryDischarge();
    });
    flow.getActionCard('enable_battery_discharge').registerRunListener(async (args) => {
        return getDevice(args).enableBatteryDischarge();
    });
    flow.getActionCard('turn_off_battery_charging').registerRunListener(async (args) => {
        return getDevice(args).turnOffBatteryCharging();
    });
    flow.getActionCard('turn_on_battery_charging').registerRunListener(async (args) => {
        return getDevice(args).turnOnBatteryCharging(args);
    });
}

module.exports = {
    registerBatteryFlowCards
};
