'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSmartContactSettingsPayload,
  buildSmartContactTimerPayload,
  SunberrySmartContactControl,
} = require('../lib/SunberrySmartContactControl');

test('buildSmartContactTimerPayload creates all-week timer payload from settings', () => {
  assert.deepEqual(buildSmartContactTimerPayload({
    start: '06:00',
    stop: '21:00',
    mode: 'battery',
  }), {
    start_0: '06:00',
    stop_0: '21:00',
    mode_0: 'battery',
    Mon_0: 'Mon_0',
    Tue_0: 'Tue_0',
    Wed_0: 'Wed_0',
    Thu_0: 'Thu_0',
    Fri_0: 'Fri_0',
    Sat_0: 'Sat_0',
    Sun_0: 'Sun_0',
    submit: '',
  });
});

test('buildSmartContactSettingsPayload maps advanced settings to Sunberry form fields', () => {
  assert.deepEqual(buildSmartContactSettingsPayload({
    power: 1200,
    overflowOffset: 300,
    socMin: 90,
    minTime: 20,
    output: 'DO4',
    priority: 'soc',
  }), {
    power: '1200',
    overflow_offset: '300',
    soc_min: '90',
    min_time: '20',
    output: 'DO4',
    priority: 'soc',
  });
});

test('SunberrySmartContactControl posts timer and active change when enabling', async () => {
  const calls = [];
  const cookieManager = { getCookie: async () => 'session-cookie' };
  const control = new SunberrySmartContactControl({
    cookieManager,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('192.168.1.50');
  await control.enable({
    start: '06:00',
    stop: '21:00',
    mode: 'battery',
  });

  assert.deepEqual(calls.map(call => call.url), [
    'http://192.168.1.50/heat_pump/timers',
    'http://192.168.1.50/heat_pump/active_change/True',
  ]);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].options.method, 'GET');
  assert.match(String(calls[0].options.body), /start_0=06%3A00/);
  assert.match(String(calls[0].options.body), /mode_0=battery/);
});

test('SunberrySmartContactControl disables active state with GET request', async () => {
  const calls = [];
  const control = new SunberrySmartContactControl({
    cookieManager: { getCookie: async () => 'session-cookie' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('http://192.168.1.50');
  await control.disable();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.1.50/heat_pump/active_change/False');
  assert.equal(calls[0].options.method, 'GET');
});

test('SunberrySmartContactControl posts timer settings without changing active state', async () => {
  const calls = [];
  const control = new SunberrySmartContactControl({
    cookieManager: { getCookie: async () => 'session-cookie' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('192.168.1.50');
  await control.updateTimer({
    start: '07:30',
    stop: '20:45',
    mode: 'combined',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.1.50/heat_pump/timers');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(String(calls[0].options.body), 'start_0=07%3A30&stop_0=20%3A45&mode_0=combined&Mon_0=Mon_0&Tue_0=Tue_0&Wed_0=Wed_0&Thu_0=Thu_0&Fri_0=Fri_0&Sat_0=Sat_0&Sun_0=Sun_0&submit=');
});

test('SunberrySmartContactControl posts settings separately from active state', async () => {
  const calls = [];
  const control = new SunberrySmartContactControl({
    cookieManager: { getCookie: async () => 'session-cookie' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('192.168.1.50');
  await control.updateSettings({
    power: 1400,
    overflowOffset: '',
    socMin: 90,
    minTime: 20,
    output: 'DO1',
    priority: 'soc',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.1.50/heat_pump/settings');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(String(calls[0].options.body), 'power=1400&overflow_offset=&soc_min=90&min_time=20&output=DO1&priority=soc');
});
