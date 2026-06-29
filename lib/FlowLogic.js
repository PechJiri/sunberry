'use strict';

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function didCrossBatteryLevel({ previous, current, target }) {
    if (!isFiniteNumber(current) || !isFiniteNumber(target)) {
        return false;
    }

    if (!isFiniteNumber(previous)) {
        return current === target;
    }

    return (previous < target && current >= target)
        || (previous > target && current <= target);
}

module.exports = {
    didCrossBatteryLevel
};
