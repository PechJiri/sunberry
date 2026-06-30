# Sunberry Devices Business Behavior

This document describes the intended business behavior of the split Sunberry Homey devices. It is the source of truth for how Sunberry portal values are mapped into Homey capabilities and Homey Energy.

## Shared Behavior

All Sunberry Homey devices represent one physical Sunberry unit. The app splits that unit into separate Homey devices so Homey Energy can model each role correctly:

- `Sunberry Battery`
- `Sunberry Solar`
- `Sunberry Home Consumption`
- `Sunberry Smart Meter`
- `Sunberry Smart Contact`

The user can enter either the real device IP address or `sunberry.local` during pairing. When `sunberry.local` is used, the app resolves it to an IPv4 address and stores that IP in the paired Homey device. This avoids runtime failures when Homey's app runtime cannot resolve `.local` names reliably.

All HTTP reads go through a shared request queue keyed by the resolved base URL. This prevents Battery, Solar, and Home Consumption polling from sending requests to the same physical Sunberry unit at exactly the same time.

The request queue also leaves a short gap between requests to the same physical Sunberry unit. This protects older Raspberry Pi/UniPi based installations from receiving several back-to-back HTTP requests at the exact same moment.

Transient polling failures, such as a temporary HTTP 500 from one Sunberry page, do not immediately mark a Homey device as unavailable. A device shows a warning for the first failed polling attempts and is marked unavailable only after three consecutive failed polling attempts. After that point polling backs off to an hourly self-healing check. Any successful poll resets the failure counter, clears the warning when supported by the Homey runtime, marks the device available, and updates Homey's last-seen timestamp.

Polling uses a short startup jitter and skips overlapping runs for the same Homey device. If a previous polling cycle is still running, a new timer tick reuses that in-flight cycle instead of starting another HTTP read.

Sunberry HTML endpoint responses are expected to be small. Oversized responses are rejected before parsing to avoid unnecessary memory use if the device returns an unexpected page.

## Battery Device

Source endpoint:

- `/battery/values`

Homey device:

- Driver: `sunberry_battery`
- Class: `battery`
- Energy model:
  - `homeBattery: true`
  - `meterPowerImportedCapability: meter_power.imported`
  - `meterPowerExportedCapability: meter_power.exported`

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| Battery state | internal normalization | `Nabijeni` = charging, `Vybijeni` = discharging, idle/unknown = 0 W |
| Battery state | `battery_charging_state` | Standard Homey state: `charging`, `discharging`, or `idle` |
| Kapacita baterie, percent | `measure_battery` | Standard battery percentage |
| Kapacita baterie, Wh | `stored_energy_kWh` | Stored energy in kWh; intentionally not named as a battery percentage capability |
| Vykon baterie | `measure_power` | Positive while charging, negative while discharging |
| Integrated positive battery power | `meter_power.imported` | Estimated cumulative charged kWh |
| Integrated negative battery power | `meter_power.exported` | Estimated cumulative discharged kWh |
| Max nabijeni | `battery_max_charging_power` | Current charging limit reported by Sunberry |
| Teplota baterii | `measure_temperature` | Battery temperature |

Homey Energy sign convention:

- Positive `measure_power` means the battery is consuming power and charging.
- Negative `measure_power` means the battery is delivering power and discharging.
- `meter_power.imported` tracks energy charged into the battery.
- `meter_power.exported` tracks energy discharged from the battery.
- These cumulative kWh values are estimates derived from instantaneous battery W and the polling interval. They are not billing-grade meter readings.

Force charging behavior:

- Flow action charging limits and the capability button setting are clamped to the current `battery_max_charging_power`.
- Values below the minimum valid charging limit are rejected.
- `Max vybijeni` is parsed from the portal when present, but it is not exposed as an active capability because Sunberry currently supports controlling charging, not forced discharging.
- Force charging is controlled through the Sunberry battery-management request already used by the app. It is represented by the custom `force_charging` capability and existing Flow cards, not by Homey's `target_power` capability.

Block discharge behavior:

- Battery discharge blocking is controlled through the Sunberry battery-management request already used by the app.
- When block discharge is enabled, the Sunberry portal can show `Klidovy rezim`, which is normalized to `battery_charging_state = idle` and `measure_power = 0`.
- Idle cannot be commanded as a general power setpoint. In practice the battery becomes idle when Sunberry reaches its minimum discharge limit or when discharge is explicitly blocked.

Homey `target_power` decision:

- `target_power` is intentionally not implemented for `sunberry_battery`.
- Homey defines positive `target_power` as charging, negative `target_power` as discharging, and `0 W` as idle.
- Sunberry can force charging and can block or allow discharge, but it cannot set an exact discharge power and cannot generally set an idle power target.
- Adding `target_power` would advertise a bidirectional power-control contract the physical device cannot fulfill. This would create misleading Homey Energy behavior and failed "Set target power" actions for negative or zero targets.
- If Sunberry later exposes exact charge and discharge power setpoints, `target_power` and probably `target_power_mode` should be reconsidered. At that point the minimum Homey compatibility would need to be raised to at least the Homey version that supports those capabilities.

## Solar Device

Source endpoint:

- `/pv/values`

Business meaning:

The PV window reports the current solar inverter input power for PV strings `PV1` and `PV2`, in watts and as a percentage of the maximum possible power for each string. The portal reports photovoltaic production down to `0 W`. `PV2` may be missing or effectively unused on some installations.

Homey device:

- Driver: `sunberry_solar`
- Class: `solarpanel`
- Energy model:
  - `meterPowerExportedCapability: meter_power`

Homey Energy meaning:

`meterPowerExportedCapability` is Homey Energy terminology for energy generated by the solar panel and exported from the Solar device into the Homey Energy model. It does not mean the energy is exported to the public grid. In the real Sunberry installation, the inverter can route generated energy to the house load, battery charging, or the grid.

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| PV1 power | `measure_pv1` | PV string 1 current power |
| PV2 power | `measure_pv2` | PV string 2 current power; missing values count as 0 W |
| PV1 + PV2 | `measure_power` | Total current solar production |
| Integrated PV total | `meter_power` | Estimated cumulative generated solar kWh |

Missing value handling:

- Missing `PV2` data is treated as `0 W`.
- Reported `0 W` values are preserved as `0 W` and do not add to cumulative solar kWh.

Solar cumulative behavior:

- `measure_power` is always normalized as a non-negative generated W value.
- `meter_power` is estimated by integrating `measure_power` between successful polls.
- The first successful sample initializes the estimator and does not add kWh.
- The app skips integration after long polling gaps to avoid artificial jumps after downtime or network outages.
- The cumulative solar kWh value is an estimate derived from instantaneous PV W and the polling interval. It is useful for Homey Energy visualization, but it is not a billing-grade production meter.

## Home Consumption Device

Source endpoints:

- `/grid/values`
- `/backup/values`

Homey device:

- Driver: `sunberry_grid`
- Class: `sensor`
- Energy model:
  - No Homey Energy cumulative grid meter is exposed.
  - Sunberry GRID values represent current house consumption by phase, not a verified net import/export meter at the public grid boundary.
  - Treating these values as `meter_power.imported` would make Homey report house load as grid import even when solar production and battery charging cover the load locally.

### GRID Window

Business meaning:

The Sunberry Home Consumption device uses the Sunberry GRID window as its source. This window shows the current house load for each phase (`L1`, `L2`, `L3`) and total, in watts and as a percentage of the maximum possible load. The inverter cannot measure very small loads precisely; values below 30 W are displayed as `<30 W`.

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| L1 | `measure_L1` | Signed instantaneous W |
| L2 | `measure_L2` | Signed instantaneous W |
| L3 | `measure_L3` | Signed instantaneous W |
| Celkem | `measure_total` | Signed instantaneous total W |

Threshold handling:

- Values displayed as `<30 W` are treated as `0 W`.
- This applies to individual phases and total.
- These threshold values do not add to imported or exported kWh.

Signed phase behavior:

- Positive values mean current house consumption on that phase.
- Negative values mean the installation is exporting on that phase.
- These signed values are exposed for user visibility and Flow logic only.
- They are not integrated into Homey Energy kWh because the Sunberry GRID page is not a verified net grid import/export meter.

The app intentionally does not estimate cumulative import/export kWh from Sunberry GRID values. Doing so would overstate grid import whenever the house load is covered by local solar production or battery discharge.

Flow behavior:

- Home Consumption exposes phase and total telemetry capabilities.
- It does not provide dedicated import/export kWh Flow triggers because those values are no longer estimated.

### BACKUP Window

Business meaning:

The BACKUP window shows the current backup load for each phase (`L1`, `L2`, `L3`) and total, in watts and as a percentage of the maximum possible load. The inverter cannot measure very small loads precisely; values below 30 W are displayed as `<30 W`.

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| Backup L1 | `measure_backup_L1` | Instantaneous W |
| Backup L2 | `measure_backup_L2` | Instantaneous W |
| Backup L3 | `measure_backup_L3` | Instantaneous W |
| Backup Celkem | `measure_backup_total` | Instantaneous total W |

Backup values are exposed as informational capabilities only. They are not used for Homey Energy cumulative import/export calculations.

## Smart Meter Device

Source endpoints:

- `/grid/values`
- `/battery/values`
- `/pv/values`

Homey device:

- Driver: `sunberry_smart_meter`
- Class: `sensor`
- Energy model:
  - `energy.cumulative: true`
  - `cumulativeImportedCapability: meter_power.imported`
  - `cumulativeExportedCapability: meter_power.exported`

Business meaning:

The Smart Meter device is a report-only computed meter for Homey Energy. It estimates the net public grid exchange from values that Sunberry exposes separately:

```text
net grid power = house consumption + battery power - solar production
```

Where:

- `house consumption` is `/grid/values` total from the Sunberry GRID page.
- `battery power` is signed using the app convention: positive while charging, negative while discharging.
- `solar production` is `PV1 + PV2`.

Mapped values:

| Computed value | Homey capability | Notes |
| --- | --- | --- |
| Net grid power | `measure_power` | Positive = importing from grid, negative = exporting to grid |
| Integrated positive net power | `meter_power.imported` | Estimated cumulative imported kWh |
| Integrated negative net power | `meter_power.exported` | Estimated cumulative exported kWh |

Example:

If the house consumes `875 W`, the battery charges at `2900 W`, and solar produces `3900 W`, the computed net grid power is `-125 W`. That means the installation is exporting about `125 W` to the public grid, even though the Home Consumption device still shows `875 W` of house load.

Limitations:

- The Smart Meter is not a billing-grade meter.
- Import/export kWh values are estimates derived from instantaneous W and the polling interval.
- The first successful sample initializes the estimator and does not add kWh.
- The app skips integration after long polling gaps to avoid artificial jumps after downtime or network outages.
- The calculation assumes Sunberry GRID total means current house consumption, not a net grid meter. Current screenshots and observed behavior support that assumption.

Performance behavior:

Smart Meter polling reads battery, solar, and grid values. The shared Sunberry client keeps a short in-memory HTML cache by endpoint and resolved base URL, so multiple Homey devices polling the same physical Sunberry unit within a short window can reuse fresh endpoint reads instead of sending duplicate requests to the Raspberry Pi/UniPi. The cache window is long enough to cover startup jitter and request queue spacing, but shorter than the minimum polling interval, so devices in the same polling cycle tend to display the same sampled values while the next cycle can refresh them.

## Smart Contact Device

Source endpoints:

- `/heat_pump/heat_pump_values`
- `/heat_pump/timers`
- `/heat_pump/active_change/True`
- `/heat_pump/active_change/False`
- `/heat_pump/settings`

Homey device:

- Driver: `sunberry_smart_contact`
- Class: `sensor`
- Energy model:
  - No Homey Energy role. The device represents a report-only contact state plus Sunberry Smart Contact control.

Business meaning:

The Smart Contact device maps the optional Sunberry `Chytrý kontakt` feature. The Sunberry portal exposes the physical contact state as Czech labels:

- `Sepnutý` means the contact is closed.
- `Rozpojený` means the contact is open.

The Homey app itself remains English. Czech labels are used only for parsing the Sunberry portal response.

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| Stav kontaktu | `alarm_contact` | Standard Homey contact alarm. `true` means open, `false` means closed. |
| Stav kontaktu | `smart_contact_closed` | Informational boolean state. `true` = closed, `false` = open. |
| Čas posledního sepnutí | `smart_contact_last_closed_at` | Last close timestamp as reported by Sunberry. |
| Čas posledního rozpojení | `smart_contact_last_opened_at` | Last open timestamp as reported by Sunberry. |

Control behavior:

- Homey's standard `onoff` capability controls whether the Sunberry Smart Contact function is active.
- Turning `onoff` on posts one all-week timer to `/heat_pump/timers` and then calls `/heat_pump/active_change/True`.
- Turning `onoff` off calls `/heat_pump/active_change/False`.
- The timer always uses all days of the week. Its start time, stop time, and mode are configured in the device advanced settings.

Advanced settings behavior:

The Sunberry settings form is intentionally sent separately from activation. When one of these advanced settings changes, the app posts the settings payload to `/heat_pump/settings`:

| Homey setting | Sunberry field | Notes |
| --- | --- | --- |
| Smart Contact timer start | `start_0` | Used only when turning the device on. Format `HH:MM`. |
| Smart Contact timer stop | `stop_0` | Used only when turning the device on. Format `HH:MM`. |
| Smart Contact timer mode | `mode_0` | Allowed values: `battery`, `pv_overflow`, `combined`, `off`. |
| Switched load power | `power` | Total switched load power in W. |
| Overflow offset | `overflow_offset` | Optional W offset. Empty value is preserved as empty. |
| Minimum battery SOC | `soc_min` | Percent, 0-100. |
| Minimum closed time | `min_time` | Minutes. |
| Digital output | `output` | Allowed values: `DO1`, `DO2`, `DO3`, `DO4`. |
| Battery mode priority | `priority` | Allowed values: `soc`, `time`. |

Timer settings are also sent as a complete form payload. When the timer start, timer stop, or timer mode setting changes, the app posts the complete all-week timer payload to `/heat_pump/timers` without changing the active switch state. When the user turns `onoff` on, the app posts the same complete timer payload first and then calls `/heat_pump/active_change/True`.

Timer mode mapping:

| Sunberry mode label | `mode_0` value |
| --- | --- |
| Přetoky | `pv_overflow` |
| Kombinované | `combined` |
| Vypnuto | `off` |
| Baterie | `battery` |

The default timer payload is full-day battery mode: `start_0=00:00`, `stop_0=23:59`, `mode_0=battery`, with all days of the week enabled.

Limitations:

- The app does not currently mirror the Sunberry active switch from the settings page during polling. The `onoff` state reflects Homey control actions.
- The app configures a single all-week timer when enabling the feature. It does not manage multiple timers or per-day timer schedules.
- The Smart Contact page may not exist on installations where the installer did not enable the feature. Pairing the Smart Contact device will fail for those installations.

## Maintenance Notes

- Parser behavior for `<30 W` and signed GRID values is covered by `test/sunberry-parsers.test.js`.
- Smart Contact contact-state parsing is covered by `test/sunberry-parsers.test.js`.
- Battery charged/discharged kWh estimation behavior is covered by `test/battery-energy-estimator.test.js`.
- Home Consumption Energy exclusion behavior is covered by `test/sunberry-grid-energy-model.test.js`.
- Smart Meter net import/export estimation behavior is covered by `test/energy-balance-estimator.test.js`.
- Smart Meter Homey Energy metadata is covered by `test/sunberry-smart-meter-energy-model.test.js`.
- Smart Contact control payloads are covered by `test/smart-contact-control.test.js`.
- Smart Contact Homey metadata is covered by `test/sunberry-smart-contact-energy-model.test.js`.
- Solar kWh estimation behavior is covered by `test/solar-energy-estimator.test.js`.
- Request queue behavior is covered by `test/sunberry-client.test.js`.
- Request throttling behavior is covered by `test/sunberry-request-queue.test.js`.
- Pairing and `.local` resolution behavior is covered by `test/sunberry-pairing.test.js`.
