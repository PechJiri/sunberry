'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const smartContactDriver = require('../drivers/sunberry_smart_contact/driver.compose.json');
const smartContactFlow = require('../drivers/sunberry_smart_contact/driver.flow.compose.json');
const smartContactSettings = require('../drivers/sunberry_smart_contact/driver.settings.compose.json');
const smartContactClosedCapability = require('../.homeycompose/capabilities/smart_contact_closed.json');

test('smart contact driver exposes onoff control and contact telemetry only', () => {
  assert.equal(smartContactDriver.energy, undefined);
  assert.deepEqual(smartContactDriver.capabilities, [
    'onoff',
    'smart_contact_closed',
    'smart_contact_last_closed_at',
    'smart_contact_last_opened_at',
  ]);
});

test('smart contact closed capability is shown as Contact turned on YES/NO', () => {
  assert.equal(smartContactClosedCapability.title.en, 'Contact turned on');
  assert.equal(smartContactClosedCapability.titleTrue.en, 'YES');
  assert.equal(smartContactClosedCapability.titleFalse.en, 'NO');
});

test('smart contact enum settings use dropdown selects', () => {
  const settingsById = Object.fromEntries(smartContactSettings.map(setting => [setting.id, setting]));

  assert.equal(settingsById.smart_contact_timer_mode.type, 'dropdown');
  assert.deepEqual(settingsById.smart_contact_timer_mode.values.map(value => value.id), [
    'battery',
    'pv_overflow',
    'combined',
    'off',
  ]);

  assert.equal(settingsById.smart_contact_output.type, 'dropdown');
  assert.deepEqual(settingsById.smart_contact_output.values.map(value => value.id), [
    'DO1',
    'DO2',
    'DO3',
    'DO4',
  ]);

  assert.equal(settingsById.smart_contact_priority.label.en, 'Default Battery Mode Priority');
  assert.equal(settingsById.smart_contact_priority.type, 'dropdown');
  assert.deepEqual(settingsById.smart_contact_priority.values.map(value => value.id), [
    'soc',
    'time',
  ]);
});

test('smart contact settings include business behavior hints', () => {
  const settingsById = Object.fromEntries(smartContactSettings.map(setting => [setting.id, setting]));

  assert.match(settingsById.smart_contact_timer_mode.hint.en, /Battery uses SOC/);
  assert.match(settingsById.smart_contact_timer_mode.hint.en, /PV overflow/);
  assert.match(settingsById.smart_contact_power.hint.en, /PV overflow threshold/);
  assert.match(settingsById.smart_contact_overflow_offset.hint.en, /switched load power plus overflow offset/);
  assert.match(settingsById.smart_contact_min_time.hint.en, /Time priority/);
  assert.match(settingsById.smart_contact_priority.hint.en, /pure PV overflow mode/);
});

test('smart contact exposes flow action for turning on with a selected mode', () => {
  const action = smartContactFlow.actions.find(card => card.id === 'turn_on_smart_contact_with_mode');

  assert.equal(action.title.en, 'Turn on Smart Contact with mode');
  assert.equal(action.titleFormatted.en, 'Turn on Smart Contact with [[mode]] mode');
  assert.deepEqual(action.args[0].values.map(value => value.id), [
    'battery',
    'pv_overflow',
    'combined',
    'off',
  ]);
});
