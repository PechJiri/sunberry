'use strict';

const STORE_LAST_SAMPLE_AT = 'grid_energy_last_sample_at';
const STORE_LAST_POWER_W = 'grid_energy_last_power_w';
const STORE_IMPORTED_KWH = 'grid_energy_imported_kWh';
const STORE_EXPORTED_KWH = 'grid_energy_exported_kWh';

function numberOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function round(value, decimals = 5) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function integrateSignedPower(previousPowerW, currentPowerW, elapsedMs) {
    const hours = elapsedMs / 3600000;
    const previous = numberOrZero(previousPowerW);
    const current = numberOrZero(currentPowerW);

    if (previous >= 0 && current >= 0) {
        return {
            importedKWh: ((previous + current) / 2 / 1000) * hours,
            exportedKWh: 0
        };
    }

    if (previous <= 0 && current <= 0) {
        return {
            importedKWh: 0,
            exportedKWh: ((Math.abs(previous) + Math.abs(current)) / 2 / 1000) * hours
        };
    }

    const zeroAt = Math.abs(previous) / (Math.abs(previous) + Math.abs(current));
    if (previous > 0) {
        return {
            importedKWh: (previous / 2 / 1000) * (hours * zeroAt),
            exportedKWh: (Math.abs(current) / 2 / 1000) * (hours * (1 - zeroAt))
        };
    }

    return {
        importedKWh: (current / 2 / 1000) * (hours * (1 - zeroAt)),
        exportedKWh: (Math.abs(previous) / 2 / 1000) * (hours * zeroAt)
    };
}

function calculateNextGridMeters({
    currentImportedKWh,
    currentExportedKWh,
    previousPowerW,
    currentPowerW,
    previousSampleAt,
    currentSampleAt,
    maxElapsedMs
}) {
    const imported = numberOrZero(currentImportedKWh);
    const exported = numberOrZero(currentExportedKWh);
    if (!Number.isFinite(previousSampleAt) || !Number.isFinite(previousPowerW)) {
        return { importedKWh: imported, exportedKWh: exported };
    }

    const elapsedMs = currentSampleAt - previousSampleAt;
    if (elapsedMs <= 0 || elapsedMs > maxElapsedMs) {
        return { importedKWh: imported, exportedKWh: exported };
    }

    const delta = integrateSignedPower(previousPowerW, currentPowerW, elapsedMs);
    return {
        importedKWh: round(imported + delta.importedKWh),
        exportedKWh: round(exported + delta.exportedKWh)
    };
}

async function updateEstimatedGridMeters(device, currentPowerW, now = Date.now()) {
    const hasImported = device.hasCapability('meter_power.imported');
    const hasExported = device.hasCapability('meter_power.exported');
    if (!hasImported && !hasExported) return null;

    const updateIntervalMs = typeof device.getUpdateIntervalMs === 'function'
        ? device.getUpdateIntervalMs()
        : 10000;
    const maxElapsedMs = Math.max(updateIntervalMs * 3, 15000);
    const previousSampleAt = device.getStoreValue(STORE_LAST_SAMPLE_AT);
    const previousPowerW = device.getStoreValue(STORE_LAST_POWER_W);
    const currentImportedKWh = device.getCapabilityValue('meter_power.imported')
        ?? device.getStoreValue(STORE_IMPORTED_KWH)
        ?? 0;
    const currentExportedKWh = device.getCapabilityValue('meter_power.exported')
        ?? device.getStoreValue(STORE_EXPORTED_KWH)
        ?? 0;

    const nextMeters = calculateNextGridMeters({
        currentImportedKWh,
        currentExportedKWh,
        previousPowerW,
        currentPowerW,
        previousSampleAt,
        currentSampleAt: now,
        maxElapsedMs
    });

    await device.setStoreValue(STORE_LAST_SAMPLE_AT, now);
    await device.setStoreValue(STORE_LAST_POWER_W, currentPowerW);
    await device.setStoreValue(STORE_IMPORTED_KWH, nextMeters.importedKWh);
    await device.setStoreValue(STORE_EXPORTED_KWH, nextMeters.exportedKWh);

    return nextMeters;
}

module.exports = {
    calculateNextGridMeters,
    integrateSignedPower,
    updateEstimatedGridMeters,
    STORE_LAST_SAMPLE_AT,
    STORE_LAST_POWER_W,
    STORE_IMPORTED_KWH,
    STORE_EXPORTED_KWH
};
