'use strict';

function numberOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

module.exports = {
    integrateSignedPower
};
