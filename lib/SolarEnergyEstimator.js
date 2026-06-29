'use strict';

const STORE_LAST_SAMPLE_AT = 'solar_energy_last_sample_at';
const STORE_LAST_POWER_W = 'solar_energy_last_power_w';
const STORE_METER_KWH = 'solar_energy_meter_kWh';

function numberOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round(value, decimals = 5) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function integrateGeneratedPower(previousPowerW, currentPowerW, elapsedMs) {
    const hours = elapsedMs / 3600000;
    const previous = Math.max(0, numberOrZero(previousPowerW));
    const current = Math.max(0, numberOrZero(currentPowerW));

    return ((previous + current) / 2 / 1000) * hours;
}

function calculateNextSolarMeter({
    currentMeterKWh,
    previousPowerW,
    currentPowerW,
    previousSampleAt,
    currentSampleAt,
    maxElapsedMs
}) {
    const meter = numberOrZero(currentMeterKWh);
    if (!Number.isFinite(previousSampleAt) || !Number.isFinite(previousPowerW)) {
        return meter;
    }

    const elapsedMs = currentSampleAt - previousSampleAt;
    if (elapsedMs <= 0 || elapsedMs > maxElapsedMs) {
        return meter;
    }

    return round(meter + integrateGeneratedPower(previousPowerW, currentPowerW, elapsedMs));
}

async function updateEstimatedSolarMeter(device, currentPowerW, now = Date.now()) {
    if (!device.hasCapability('meter_power')) return null;

    const updateIntervalMs = typeof device.getUpdateIntervalMs === 'function'
        ? device.getUpdateIntervalMs()
        : 10000;
    const maxElapsedMs = Math.max(updateIntervalMs * 3, 15000);
    const previousSampleAt = device.getStoreValue(STORE_LAST_SAMPLE_AT);
    const previousPowerW = device.getStoreValue(STORE_LAST_POWER_W);
    const currentMeterKWh = device.getCapabilityValue('meter_power')
        ?? device.getStoreValue(STORE_METER_KWH)
        ?? 0;

    const nextMeterPower = calculateNextSolarMeter({
        currentMeterKWh,
        previousPowerW,
        currentPowerW,
        previousSampleAt,
        currentSampleAt: now,
        maxElapsedMs
    });

    await device.setStoreValue(STORE_LAST_SAMPLE_AT, now);
    await device.setStoreValue(STORE_LAST_POWER_W, currentPowerW);
    await device.setStoreValue(STORE_METER_KWH, nextMeterPower);

    return nextMeterPower;
}

module.exports = {
    calculateNextSolarMeter,
    integrateGeneratedPower,
    updateEstimatedSolarMeter,
    STORE_LAST_SAMPLE_AT,
    STORE_LAST_POWER_W,
    STORE_METER_KWH
};
