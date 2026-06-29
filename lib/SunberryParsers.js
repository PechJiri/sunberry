'use strict';

function decodeHtml(value) {
    return String(value || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#176;/g, ' deg ')
        .replace(/&deg;/g, ' deg ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripTags(html) {
    return decodeHtml(String(html || '').replace(/<[^>]*>/g, ' '));
}

function labelsFromHtml(html) {
    return [...String(html || '').matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)]
        .map(match => stripTags(match[1]))
        .filter(Boolean);
}

function parseNumber(value) {
    const text = decodeHtml(value);
    if (!text) return null;
    if (text.startsWith('<')) return 0;

    const match = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}

function parseTimestamp(labels) {
    const match = labels.find(label => /\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}/.test(label));
    return match || null;
}

function valueAfterLabel(labels, labelPattern) {
    const index = labels.findIndex(label => labelPattern.test(label));
    return index >= 0 ? labels[index + 1] || null : null;
}

function pairAfterLabel(labels, labelPattern) {
    const index = labels.findIndex(label => labelPattern.test(label));
    return index >= 0 ? [labels[index + 1] || null, labels[index + 2] || null] : [null, null];
}

function parsePowerRows(html, rowNames) {
    const labels = labelsFromHtml(html);
    const result = {};
    const percentages = {};

    for (const { key, pattern } of rowNames) {
        const [power, percent] = pairAfterLabel(labels, pattern);
        result[key] = parseNumber(power);
        percentages[key] = parseNumber(percent);
    }

    return {
        values: result,
        percentages,
        timestamp: parseTimestamp(labels)
    };
}

function parseGridValues(html) {
    const parsed = parsePowerRows(html, [
        { key: 'L1', pattern: /^L1:/i },
        { key: 'L2', pattern: /^L2:/i },
        { key: 'L3', pattern: /^L3:/i },
        { key: 'Total', pattern: /^Celkem:/i }
    ]);

    return {
        ...parsed.values,
        percentages: parsed.percentages,
        timestamp: parsed.timestamp
    };
}

function parseBackupValues(html) {
    return parseGridValues(html);
}

function normalizeBatteryState(labels) {
    const stateLabel = labels.find(label => !label.includes(':') && /nab|vyb|klid/i.test(label));
    if (!stateLabel) return null;
    if (/vyb/i.test(stateLabel)) return 'discharging';
    if (/nab/i.test(stateLabel)) return 'charging';
    if (/klid/i.test(stateLabel)) return 'idle';
    return null;
}

function parseBatteryValues(html) {
    const labels = labelsFromHtml(html);
    const [capacityWh, capacityPercent] = pairAfterLabel(labels, /Kapacita baterie:/i);
    const [batteryPower, batteryPowerPercent] = pairAfterLabel(labels, /^V.*kon baterie:/i);

    return {
        actual_kWh: (parseNumber(capacityWh) || 0) / 1000,
        actual_percent: parseNumber(capacityPercent) || 0,
        state: normalizeBatteryState(labels),
        power: parseNumber(batteryPower) || 0,
        power_percent: parseNumber(batteryPowerPercent) || 0,
        max_charging_power: parseNumber(valueAfterLabel(labels, /Max nab/i)) || 0,
        max_discharging_power: parseNumber(valueAfterLabel(labels, /Max vyb/i)) || 0,
        temperature: parseNumber(valueAfterLabel(labels, /Teplota bater/i)),
        timestamp: parseTimestamp(labels)
    };
}

function parsePvValues(html) {
    const parsed = parsePowerRows(html, [
        { key: 'pv1', pattern: /^Pv1:/i },
        { key: 'pv2', pattern: /^Pv2:/i }
    ]);

    return {
        pv1: {
            power: parsed.values.pv1,
            percent: parsed.percentages.pv1
        },
        pv2: {
            power: parsed.values.pv2,
            percent: parsed.percentages.pv2
        },
        total_power: (parsed.values.pv1 || 0) + (parsed.values.pv2 || 0),
        timestamp: parsed.timestamp
    };
}

function parseBoilerValues(html) {
    const labels = labelsFromHtml(html);
    const sensorLabel = valueAfterLabel(labels, /Teplo.*idlo:/i);
    const temperature = parseNumber(sensorLabel);
    const phases = {};

    for (const phase of ['L1', 'L2', 'L3']) {
        const [percent, power] = pairAfterLabel(labels, new RegExp(`^${phase}:`, 'i'));
        phases[phase] = {
            percent: parseNumber(percent) || 0,
            power: parseNumber(power) || 0
        };
    }

    return {
        temperature_sensor_connected: sensorLabel ? !/nen.*ipojeno/i.test(sensorLabel) : temperature !== null,
        temperature,
        phases,
        total_power: Object.values(phases).reduce((sum, phase) => sum + phase.power, 0),
        timestamp: parseTimestamp(labels)
    };
}

function parseOptionalDate(value) {
    const text = decodeHtml(value);
    if (!text || /^N\/A$/i.test(text)) return null;
    return text;
}

function parseHeatPumpValues(html) {
    const labels = labelsFromHtml(html);
    const stateLabel = valueAfterLabel(labels, /Stav kontaktu:/i);
    const contactClosed = /sepnut/i.test(stateLabel || '') && !/rozepnut/i.test(stateLabel || '');

    return {
        contact_closed: contactClosed,
        state: contactClosed ? 'closed' : 'open',
        soc_percent: parseNumber(valueAfterLabel(labels, /SOC aktu/i)) || 0,
        last_closed_at: parseOptionalDate(valueAfterLabel(labels, /as posledn.*sepnut/i)),
        last_opened_at: parseOptionalDate(valueAfterLabel(labels, /as posledn.*rozpojen/i))
    };
}

module.exports = {
    parseBatteryValues,
    parseBackupValues,
    parseGridValues,
    parsePvValues,
    parseBoilerValues,
    parseHeatPumpValues,
    _private: {
        decodeHtml,
        labelsFromHtml,
        parseNumber
    }
};
