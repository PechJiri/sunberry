'use strict';

const GRID_IMPORT_METER_CHANGED = 'grid_import_meter_changed';
const GRID_EXPORT_METER_CHANGED = 'grid_export_meter_changed';

function isChangedNumber(previousValue, nextValue) {
    return typeof nextValue === 'number'
        && Number.isFinite(nextValue)
        && previousValue !== nextValue;
}

function getChangedGridMeterTriggers({ previousImportedKWh, previousExportedKWh, updates }) {
    const triggers = [];

    if (isChangedNumber(previousImportedKWh, updates['meter_power.imported'])) {
        triggers.push({
            cardId: GRID_IMPORT_METER_CHANGED,
            tokens: { energy: updates['meter_power.imported'] }
        });
    }

    if (isChangedNumber(previousExportedKWh, updates['meter_power.exported'])) {
        triggers.push({
            cardId: GRID_EXPORT_METER_CHANGED,
            tokens: { energy: updates['meter_power.exported'] }
        });
    }

    return triggers;
}

async function triggerGridMeterFlows(device, previousImportedKWh, previousExportedKWh, updates) {
    const triggers = getChangedGridMeterTriggers({
        previousImportedKWh,
        previousExportedKWh,
        updates
    });

    for (const { cardId, tokens } of triggers) {
        await device.homey.flow.getDeviceTriggerCard(cardId).trigger(device, tokens, {});
    }
}

module.exports = {
    GRID_EXPORT_METER_CHANGED,
    GRID_IMPORT_METER_CHANGED,
    getChangedGridMeterTriggers,
    triggerGridMeterFlows
};
