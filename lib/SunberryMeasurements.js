'use strict';

function numberOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function normalizeBatteryPower(state, power) {
    const absolutePower = Math.abs(numberOrZero(power));
    if (state === 'charging') return absolutePower;
    if (state === 'discharging') return -absolutePower;
    return 0;
}

function normalizeBatteryChargingState(state) {
    if (state === 'charging' || state === 'discharging') return state;
    return 'idle';
}

function normalizeBatteryMeasurements(values = {}) {
    const actualKwh = numberOrZero(values.actual_kWh);
    const actualPercent = numberOrZero(values.actual_percent);
    const totalCapacity = actualKwh > 0 && actualPercent > 0
        ? actualKwh / (actualPercent / 100)
        : 0;

    return {
        measure_power: normalizeBatteryPower(values.state, values.power),
        battery_charging_state: normalizeBatteryChargingState(values.state),
        measure_battery: actualPercent,
        stored_energy_kWh: actualKwh,
        remaining_kWh_to_full: totalCapacity > 0 ? round(Math.max(0, totalCapacity - actualKwh)) : 0,
        battery_max_charging_power: numberOrZero(values.max_charging_power),
        measure_temperature: numberOrZero(values.temperature)
    };
}

function normalizeSolarMeasurements(values = {}) {
    const pv1 = numberOrZero(values.pv1?.power);
    const pv2 = numberOrZero(values.pv2?.power);

    return {
        measure_power: pv1 + pv2,
        measure_pv1: pv1,
        measure_pv2: pv2
    };
}

function normalizeGridMeasurements(gridValues = {}, backupValues = {}) {
    return {
        measure_L1: numberOrZero(gridValues.L1),
        measure_L2: numberOrZero(gridValues.L2),
        measure_L3: numberOrZero(gridValues.L3),
        measure_total: numberOrZero(gridValues.Total),
        measure_backup_L1: numberOrZero(backupValues.L1),
        measure_backup_L2: numberOrZero(backupValues.L2),
        measure_backup_L3: numberOrZero(backupValues.L3),
        measure_backup_total: numberOrZero(backupValues.Total)
    };
}

function normalizeBoilerMeasurements(values = {}, { phaseCount = 1 } = {}) {
    const temperatureSensorConnected = Boolean(values.temperature_sensor_connected);
    const updates = {
        measure_power: numberOrZero(values.total_power),
        boiler_temperature_sensor_connected: temperatureSensorConnected,
        measure_temperature: temperatureSensorConnected && Number.isFinite(values.temperature)
            ? values.temperature
            : 0
    };

    if (phaseCount === 3) {
        updates.measure_L1 = numberOrZero(values.phases?.L1?.power);
        updates.measure_L2 = numberOrZero(values.phases?.L2?.power);
        updates.measure_L3 = numberOrZero(values.phases?.L3?.power);
    }

    return updates;
}

function normalizeSmartContactMeasurements(values = {}) {
    const contactClosed = Boolean(values.contact_closed);

    return {
        smart_contact_closed: contactClosed,
        smart_contact_last_closed_at: values.last_closed_at || '',
        smart_contact_last_opened_at: values.last_opened_at || ''
    };
}

module.exports = {
    normalizeBatteryMeasurements,
    normalizeBatteryChargingState,
    normalizeBatteryPower,
    normalizeBoilerMeasurements,
    normalizeSolarMeasurements,
    normalizeGridMeasurements,
    normalizeSmartContactMeasurements
};
