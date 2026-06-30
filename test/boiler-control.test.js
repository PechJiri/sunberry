'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildBoiler1FSettingsPayload,
  buildBoiler3FSettingsPayload,
  buildBoilerTimerPayload,
  SunberryBoilerControl,
} = require('../lib/SunberryBoilerControl');

test('buildBoilerTimerPayload creates full-day all-week payload with power routing enabled', () => {
  assert.equal(
    String(new URLSearchParams(buildBoilerTimerPayload({
      minTemperature: 40,
      maxTemperature: 60,
      powerRouting: true,
    }))),
    'start_0=00%3A00&stop_0=23%3A59&min_temperature_0=40&max_temperature_0=60&power_routing_0=on&Mon_0=Mon_0&Tue_0=Tue_0&Wed_0=Wed_0&Thu_0=Thu_0&Fri_0=Fri_0&Sat_0=Sat_0&Sun_0=Sun_0&submit='
  );
});

test('buildBoilerTimerPayload omits unchecked power routing like the Sunberry form', () => {
  assert.equal(
    String(new URLSearchParams(buildBoilerTimerPayload({
      minTemperature: 45,
      maxTemperature: 65,
      powerRouting: false,
    }))),
    'start_0=00%3A00&stop_0=23%3A59&min_temperature_0=45&max_temperature_0=65&Mon_0=Mon_0&Tue_0=Tue_0&Wed_0=Wed_0&Thu_0=Thu_0&Fri_0=Fri_0&Sat_0=Sat_0&Sun_0=Sun_0&submit='
  );
});

test('SunberryBoilerControl posts timer and active change when enabling', async () => {
  const calls = [];
  const cookieRequests = [];
  const control = new SunberryBoilerControl({
    cookieManager: {
      getCookie: async (...args) => {
        cookieRequests.push(args);
        return 'session-cookie';
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('192.168.1.50');
  await control.enable({
    minTemperature: 40,
    maxTemperature: 60,
    powerRouting: true,
  });

  assert.deepEqual(cookieRequests, [
    ['http://192.168.1.50', '/boiler/settings'],
    ['http://192.168.1.50', '/boiler/settings'],
  ]);
  assert.deepEqual(calls.map(call => call.url), [
    'http://192.168.1.50/boiler/timers',
    'http://192.168.1.50/boiler/boiler_active_change/True',
  ]);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[0].options.headers.Cookie, 'session=session-cookie');
  assert.equal(calls[0].options.headers.Referer, 'http://192.168.1.50/boiler/settings');
  assert.equal(String(calls[0].options.body), 'start_0=00%3A00&stop_0=23%3A59&min_temperature_0=40&max_temperature_0=60&power_routing_0=on&Mon_0=Mon_0&Tue_0=Tue_0&Wed_0=Wed_0&Thu_0=Thu_0&Fri_0=Fri_0&Sat_0=Sat_0&Sun_0=Sun_0&submit=');
});

test('SunberryBoilerControl disables boiler active state with GET request', async () => {
  const calls = [];
  const control = new SunberryBoilerControl({
    cookieManager: { getCookie: async () => 'session-cookie' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('http://192.168.1.50');
  await control.disable();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.1.50/boiler/boiler_active_change/False');
  assert.equal(calls[0].options.method, 'GET');
});

test('SunberryBoilerControl posts timer settings without changing active state', async () => {
  const calls = [];
  const control = new SunberryBoilerControl({
    cookieManager: { getCookie: async () => 'session-cookie' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('192.168.1.50');
  await control.updateTimer({
    minTemperature: 42,
    maxTemperature: 58,
    powerRouting: false,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.1.50/boiler/timers');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(String(calls[0].options.body), 'start_0=00%3A00&stop_0=23%3A59&min_temperature_0=42&max_temperature_0=58&Mon_0=Mon_0&Tue_0=Tue_0&Wed_0=Wed_0&Thu_0=Thu_0&Fri_0=Fri_0&Sat_0=Sat_0&Sun_0=Sun_0&submit=');
});

test('buildBoiler1FSettingsPayload creates complete single-phase settings payload', () => {
  assert.equal(
    String(new URLSearchParams(buildBoiler1FSettingsPayload({
      power: 3000,
      regulationOffset: 300,
      phaseConnected: 'S',
      output: 'DO2',
    }))),
    'boiler_power=3000&regulation_offset=300&no_phases=1&phase_connected=S&regulation_type=asymmetric&output_R=DO3&output_S=DO2&output_T=DO3'
  );
});

test('SunberryBoilerControl posts complete 1F settings payload to boiler settings', async () => {
  const calls = [];
  const cookieRequests = [];
  const control = new SunberryBoilerControl({
    cookieManager: {
      getCookie: async (...args) => {
        cookieRequests.push(args);
        return 'session-cookie';
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { status: 302, text: async () => '' };
    },
  });

  control.setBaseUrl('192.168.1.50');
  await control.updateSettings(buildBoiler1FSettingsPayload({
    power: 3000,
    regulationOffset: 300,
    phaseConnected: 'R',
    output: 'DO1',
  }));

  assert.deepEqual(cookieRequests, [['http://192.168.1.50', '/boiler/settings']]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://192.168.1.50/boiler/settings');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Cookie, 'session=session-cookie');
  assert.equal(String(calls[0].options.body), 'boiler_power=3000&regulation_offset=300&no_phases=1&phase_connected=R&regulation_type=asymmetric&output_R=DO1&output_S=DO3&output_T=DO3');
});

test('buildBoiler3FSettingsPayload creates symmetric three-phase settings payload', () => {
  assert.equal(
    String(new URLSearchParams(buildBoiler3FSettingsPayload({
      power: 3000,
      regulationOffset: 300,
      regulationType: 'symmetric',
      outputL1: 'DO3',
      outputL2: 'DO1',
      outputL3: 'DO4',
    }))),
    'boiler_power=3000&regulation_offset=300&no_phases=3&phase_connected=R&regulation_type=symmetric&output_R=DO3&output_S=DO3&output_T=DO3'
  );
});

test('buildBoiler3FSettingsPayload creates asymmetric three-phase settings payload', () => {
  assert.equal(
    String(new URLSearchParams(buildBoiler3FSettingsPayload({
      power: 3000,
      regulationOffset: 300,
      regulationType: 'asymmetric',
      outputL1: 'DO1',
      outputL2: 'DO3',
      outputL3: 'DO4',
    }))),
    'boiler_power=3000&regulation_offset=300&no_phases=3&phase_connected=R&regulation_type=asymmetric&output_R=DO1&output_S=DO3&output_T=DO4'
  );
});
