# Sunberry Devices Business Behavior

This document describes the intended business behavior of the split Sunberry Homey devices. It is the source of truth for how Sunberry portal values are mapped into Homey capabilities and Homey Energy.

## Shared Behavior

All Sunberry Homey devices represent one physical Sunberry unit. The app splits that unit into separate Homey devices so Homey Energy can model each role correctly:

- `Sunberry Battery`
- `Sunberry Solar`
- `Sunberry Home Consumption`
- `Sunberry Smart Meter`
- `Sunberry Smart Contact` when the optional Sunberry feature is enabled
- `Sunberry Boiler 1F` or `Sunberry Boiler 3F` when the optional Sunberry feature is enabled

## Homey SDK And Energy Review Notes

The implementation was reviewed against the Homey Apps SDK v3 and Homey Energy documentation:

- Energy model reference: https://apps.developer.homey.app/the-basics/devices/energy
- Device and capability reference: https://apps.developer.homey.app/the-basics/devices/capabilities
- SDK v3 reference: https://apps-sdk-v3.developer.homey.app/

Reviewed decisions:

- The physical Sunberry unit is intentionally split into separate Homey devices because Homey Energy models different energy roles through device classes and energy metadata.
- `Sunberry Battery` uses device class `battery`, `energy.homeBattery`, signed `measure_power`, and imported/exported cumulative battery meters.
- `Sunberry Solar` uses device class `solarpanel`, positive `measure_power`, and `meterPowerExportedCapability: meter_power`. In Homey terminology this means energy exported from the Solar device into the Homey Energy model, not necessarily exported to the public grid.
- `Sunberry Smart Meter` is the only device that reports estimated public-grid import/export to Homey Energy. It uses Homey's cumulative import/export meter metadata and computes net power from house load, solar production and battery power.
- `Sunberry Home Consumption` deliberately does not report Energy import/export meters because the Sunberry GRID page represents house load by phase, not a verified utility grid meter.
- `Sunberry Battery` deliberately does not implement `target_power`. Sunberry can force charging and block discharge, but it cannot accept the full Homey target-power contract of charge, discharge and idle setpoints.
- Optional Smart Contact and Boiler devices use standard `onoff` only where Homey control maps to a concrete Sunberry active-state request. Their timer and settings payloads are always posted as complete Sunberry form payloads.
- Custom telemetry capabilities use Homey's custom capability model and are named for user-facing meaning, while standard capabilities are used for Homey Energy where the semantics match.
- Package, lockfile, Homey compose manifest, generated manifest and Homey changelog versions are kept aligned by `test/homey-metadata.test.js`.

Known limits after review:

- Estimated kWh values are derived from instantaneous W and polling intervals. They are suitable for Homey Energy visualization, not billing-grade metering.
- Optional Sunberry pages can be disabled by the installer. Pairing those optional devices will fail on installations where the page is not present.
- Existing users upgrading from the old all-in-one device must add the split devices and move Flows manually.

The user can enter either the real device IP address or `sunberry.local` during pairing. When `sunberry.local` is used, the app resolves it to an IPv4 address and stores that IP in the paired Homey device. This avoids runtime failures when Homey's app runtime cannot resolve `.local` names reliably.

All HTTP reads go through a shared request queue keyed by the resolved base URL. This prevents Battery, Solar, and Home Consumption polling from sending requests to the same physical Sunberry unit at exactly the same time.

The request queue also leaves a short gap between requests to the same physical Sunberry unit. This protects older Raspberry Pi/UniPi based installations from receiving several back-to-back HTTP requests at the exact same moment.

Transient polling failures, such as a temporary HTTP 500 from one Sunberry page, do not immediately mark a Homey device as unavailable. A device shows a warning for the first failed polling attempts and is marked unavailable only after three consecutive failed polling attempts. After that point polling continues with capped exponential backoff so the device can recover promptly after a short Sunberry outage. Any successful poll resets the failure counter, clears the warning when supported by the Homey runtime, marks the device available, and updates Homey's last-seen timestamp.

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

- `Sepnutý` means the contact is turned on.
- `Rozpojený` means the contact is turned off.

The Homey app itself remains English. Czech labels are used only for parsing the Sunberry portal response.

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| Stav kontaktu | `smart_contact_closed` | Custom boolean sensor shown as `Contact turned on`. `YES` = Sepnutý, `NO` = Rozpojený. |
| Čas posledního sepnutí | `smart_contact_last_closed_at` | Last turn-on timestamp as reported by Sunberry. |
| Čas posledního rozpojení | `smart_contact_last_opened_at` | Last turn-off timestamp as reported by Sunberry. |

Control behavior:

- Homey's standard `onoff` capability controls whether the Sunberry Smart Contact function is active.
- Turning `onoff` on posts one all-week timer to `/heat_pump/timers` and then calls `/heat_pump/active_change/True`.
- Turning `onoff` off calls `/heat_pump/active_change/False`.
- The custom Flow action `Turn on Smart Contact with mode` posts a complete all-week timer payload using the device's current start/stop settings, overrides only the selected mode, and then calls `/heat_pump/active_change/True`.
- The timer always uses all days of the week. Its start time, stop time, and mode are configured in the device advanced settings.

Advanced settings behavior:

The Sunberry settings form is intentionally sent separately from activation. When one of these advanced settings changes, the app posts the settings payload to `/heat_pump/settings`:

| Homey setting | Sunberry field | Notes |
| --- | --- | --- |
| Smart Contact timer start | `start_0` | Used when turning the device on and by the Flow action. Format `HH:MM`. |
| Smart Contact timer stop | `stop_0` | Used when turning the device on and by the Flow action. Format `HH:MM`. |
| Smart Contact timer mode | `mode_0` | Dropdown. Allowed values: `battery`, `pv_overflow`, `combined`, `off`. |
| Switched load power | `power` | Total switched load power in W. Used for battery energy estimation and PV overflow threshold calculation. |
| Overflow offset | `overflow_offset` | Optional W offset for PV overflow modes. The PV overflow threshold is switched load power plus overflow offset. |
| Minimum battery SOC | `soc_min` | Percent, 0-100. Battery modes use this as the lower turn-off boundary when SOC priority is selected. |
| Minimum closed time | `min_time` | Minutes. Time-priority modes keep the contact on until this time has elapsed. |
| Digital output | `output` | Dropdown. Allowed values: `DO1`, `DO2`, `DO3`, `DO4`. |
| Default Battery Mode Priority | `priority` | Dropdown. Allowed values: `soc`, `time`. Does not affect pure PV overflow mode. |

Timer settings are also sent as a complete form payload. When the timer start, timer stop, or timer mode setting changes, the app posts the complete all-week timer payload to `/heat_pump/timers` without changing the active switch state. When the user turns `onoff` on, or uses the Flow action, the app posts the same complete timer payload first and then calls `/heat_pump/active_change/True`.

Timer mode mapping:

| Sunberry mode label | `mode_0` value |
| --- | --- |
| Přetoky | `pv_overflow` |
| Kombinované | `combined` |
| Vypnuto | `off` |
| Baterie | `battery` |

The default timer payload is full-day battery mode: `start_0=00:00`, `stop_0=23:59`, `mode_0=battery`, with all days of the week enabled.

### Smart Contact Modes

Mode 1: Battery mode with Default Battery Mode Priority = SOC.

- Sunberry turns the contact on when current SOC is above Minimum battery SOC by enough energy to run the switched load for Minimum closed time.
- Sunberry turns the contact off when battery SOC drops to Minimum battery SOC.
- This is suitable for loads that tolerate frequent switching.

Mode 2: Battery mode with Default Battery Mode Priority = Time.

- Sunberry turns the contact on when current SOC is above Minimum battery SOC by enough energy to run the switched load for Minimum closed time.
- Sunberry turns the contact off only after Minimum closed time has elapsed.
- This is suitable for loads that should not switch frequently.

Mode 3: PV overflow mode.

- Default Battery Mode Priority does not affect this mode.
- Sunberry turns the contact on when current overflow is higher than Overflow offset plus Switched load power.
- Sunberry turns the contact off after overflow ends and Minimum closed time has elapsed.
- This is suitable for loads that tolerate frequent switching.

Mode 4: Combined mode with Default Battery Mode Priority = SOC.

- Sunberry can turn the contact on from battery logic when current SOC is high enough to run the switched load for Minimum closed time.
- Sunberry turns the contact off when battery SOC drops to Minimum battery SOC or when overflow is lost.
- Sunberry can also turn the contact on when current overflow is higher than Overflow offset plus Switched load power.
- This is suitable for loads that tolerate frequent switching.

Mode 5: Combined mode with Default Battery Mode Priority = Time.

- Sunberry can turn the contact on from battery logic when current SOC is high enough to run the switched load for Minimum closed time.
- Sunberry turns the contact off only after Minimum closed time has elapsed.
- Sunberry can also turn the contact on when current overflow is higher than Overflow offset plus Switched load power.
- This is suitable for loads that should not switch frequently.

Mode 6: Off mode.

- Sunberry disables the timer while preserving all timer and Smart Contact settings.

Limitations:

- The app does not currently mirror the Sunberry active switch from the settings page during polling. The `onoff` state reflects Homey control actions.
- The app configures a single all-week timer when enabling the feature. It does not manage multiple timers or per-day timer schedules.
- The Smart Contact page may not exist on installations where the installer did not enable the feature. Pairing the Smart Contact device will fail for those installations.

## Boiler Devices

Source endpoint:

- `/boiler/boiler_values`

The visible Sunberry page `/boiler/boiler_values_page` is only a portal wrapper. It loads the actual values through `/boiler/boiler_values`, so the Homey app polls the values endpoint directly.

Homey devices:

- Driver: `sunberry_boiler_1f`
- Name: `Sunberry Boiler 1F`
- Class: `sensor`
- Capabilities: `onoff`, `measure_power`, `meter_power`, `boiler_temperature_sensor_connected`, `measure_temperature`

- Driver: `sunberry_boiler_3f`
- Name: `Sunberry Boiler 3F`
- Class: `sensor`
- Capabilities: `onoff`, `measure_power`, `meter_power`, `boiler_temperature_sensor_connected`, `measure_temperature`, `measure_L1`, `measure_L2`, `measure_L3`

Business meaning:

The Boiler devices map the optional Sunberry `Bojler` feature. The Sunberry values window reports water temperature when a temperature sensor is connected and current heater power in W plus percent of the configured maximum heater power. If no temperature sensor is connected, Sunberry shows text equivalent to `No temperature sensor connected`; the app exposes that as `boiler_temperature_sensor_connected = NO` and publishes `measure_temperature = 0 C`.

The app intentionally exposes two separate boiler device types:

- `Sunberry Boiler 1F` is for single-phase boilers. It reports the one heater row as standard `measure_power`.
- `Sunberry Boiler 3F` is for three-phase boilers. It reports standard `measure_power` as the total of L1, L2, and L3, and also exposes per-phase power through `measure_L1`, `measure_L2`, and `measure_L3`.

Mapped values:

| Sunberry value | Homey capability | Notes |
| --- | --- | --- |
| Heater power, single-phase | `measure_power` | 1F total current boiler power |
| L1 + L2 + L3 heater power | `measure_power` | 3F total current boiler power |
| Integrated total heater power | `meter_power` | Estimated cumulative boiler kWh |
| Temperature sensor present | `boiler_temperature_sensor_connected` | Custom boolean sensor shown as `Temperature sensor connected`. `YES` = temperature value is present, `NO` = Sunberry reports no temperature sensor connected. |
| Water temperature | `measure_temperature` | Standard Homey temperature. Shows the reported temperature when connected, otherwise `0 C`. |
| 3F L1 heater power | `measure_L1` | 3F only |
| 3F L2 heater power | `measure_L2` | 3F only |
| 3F L3 heater power | `measure_L3` | 3F only |

Boiler cumulative energy behavior:

- `meter_power` is estimated by integrating the standard total `measure_power` value between successful polls.
- For `Sunberry Boiler 1F`, `measure_power` is the single heater power reported by Sunberry.
- For `Sunberry Boiler 3F`, `measure_power` is the total heater power, calculated as `L1 + L2 + L3`.
- Negative or invalid heater power samples are treated as `0 W`, because the boiler is a consumer and does not generate electricity.
- The first successful sample initializes the estimator and does not add kWh.
- The app skips integration after long polling gaps to avoid artificial jumps after downtime or network outages.
- The cumulative boiler kWh value is an estimate derived from instantaneous W and the polling interval. It is useful for Homey Energy visualization, but it is not a billing-grade meter reading from Sunberry.

Control behavior:

- Homey's standard `onoff` capability controls whether the Sunberry Boiler function is active.
- Turning `onoff` on first posts one all-week timer to `/boiler/timers`, then calls `/boiler/boiler_active_change/True`.
- Turning `onoff` off calls `/boiler/boiler_active_change/False`.
- The Flow action `Turn on Boiler with Power Routing mode` is available for both `Sunberry Boiler 1F` and `Sunberry Boiler 3F`. It posts the same all-week timer and activates the boiler, but overrides only Power Routing for that run with either `with` or `without`.
- The app configures a single timer from `00:00` to `23:59` for all days of the week.
- The timer payload always includes minimum water temperature, maximum water temperature, all weekday fields, and the submit field.
- `Power Routing` follows the Sunberry checkbox behavior. When enabled, the timer payload includes `power_routing_0=on`. When disabled, the checkbox field is omitted, which is how the Sunberry form submits an unchecked checkbox.
- The app obtains a session cookie from `/boiler/settings` before posting timers or changing the active state.

Advanced settings behavior:

- `Default Minimum Water Temperature`: default minimum temperature for the all-week timer. Allowed range is 0-60 C.
- `Default Maximum Water Temperature`: default maximum temperature for the all-week timer. Allowed range is 30-80 C.
- `Power Routing`: when enabled, Sunberry tries to heat using available surplus power and avoids heating while the battery is discharging. When disabled, Sunberry may also use grid energy according to its own boiler logic.
- Changing one of these settings posts a complete all-week timer payload to `/boiler/timers` without changing the active switch state.
- The Flow action override does not persist back into advanced settings. It only changes the timer payload used for that activation.
- The minimum temperature must not be higher than the maximum temperature.

Single-phase installation settings:

The `Sunberry Boiler 1F` device also manages the single-phase installation part of the Sunberry boiler settings form. Changing one of these settings posts a complete payload to `/boiler/settings`:

- `Boiler Power`: total configured heater power in W.
- `Regulation Offset`: minimum surplus power kept outside boiler heating. Sunberry routes only surplus above this offset to the boiler.
- `Connected Boiler Phase`: physical phase used by the boiler. Homey shows this as `L1`, `L2`, or `L3`, and the portal payload uses `R`, `S`, or `T`.
- `Connected Output`: digital output `DO1` to `DO4` used to switch the selected phase.

For the 1F device the app always sends `no_phases=1` and `regulation_type=asymmetric`. The selected output is written only to the output field matching the selected connected phase (`output_R`, `output_S`, or `output_T`). The other hidden phase output fields are sent as `DO3`, matching the fixed single-phase behavior used by the app.

Three-phase installation settings:

The `Sunberry Boiler 3F` device manages the three-phase installation part of the Sunberry boiler settings form. Changing one of these settings posts a complete payload to `/boiler/settings`:

- `Boiler Power`: total configured heater power in W.
- `Regulation Offset`: minimum surplus power kept outside boiler heating.
- `Regulation Type`: `Symmetric` or `Asymmetric`.
- `Output L1`, `Output L2`, `Output L3`: digital outputs `DO1` to `DO4`.

For the 3F device the app always sends `no_phases=3` and `phase_connected=R`, because the connected phase field is not meaningful for a three-phase boiler. In symmetric regulation the app sends the `Output L1` value to all three output fields (`output_R`, `output_S`, and `output_T`), matching the Sunberry behavior where all phases are switched together. In asymmetric regulation the app sends `Output L1` to `output_R`, `Output L2` to `output_S`, and `Output L3` to `output_T`.

Sunberry mode behavior:

- Without a connected temperature sensor and with Power Routing enabled, Sunberry disables heating while the battery is discharging. Otherwise it uses recent overflow measurements and sets boiler power to use the allowed surplus power after the configured offset.
- Without a connected temperature sensor and with Power Routing disabled, Sunberry behaves like a timer-controlled standby mode: during the active timer it can heat at 100%.
- With a connected temperature sensor and with Power Routing enabled, Sunberry heats at 100% below the minimum temperature, turns off above the maximum temperature, and between those limits uses surplus-aware routing when the battery is not discharging.
- With a connected temperature sensor and with Power Routing disabled, Sunberry turns off above maximum temperature, heats at 100% below minimum temperature, and between those limits adjusts power gradually to settle near the middle of the configured interval.
- A missing temperature sensor is valid. In that case the Homey app keeps polling power and `onoff`, sets `boiler_temperature_sensor_connected` to `NO`, and sets standard `measure_temperature` to `0 C` so Homey does not keep showing a stale temperature.

Limitations:

- The app only manages a single all-week timer for Homey control. It does not manage multiple boiler timers or per-day schedules.
- The app supports the basic 1F and 3F installation settings described above. It does not manage multiple physical boiler profiles beyond the selected Homey device type.
- The app does not currently mirror the Sunberry active switch from the settings page during polling. The `onoff` state reflects Homey control actions.
- The app does not infer whether a physical installation is 1F or 3F during pairing. The user should add the device type that matches the Sunberry boiler configuration.
- The Boiler page may not exist on installations where the installer did not enable the feature. Pairing the Boiler device will fail for those installations.
## Maintenance Notes

- Parser behavior for `<30 W` and signed GRID values is covered by `test/sunberry-parsers.test.js`.
- Smart Contact contact-state parsing is covered by `test/sunberry-parsers.test.js`.
- Boiler value parsing is covered by `test/sunberry-parsers.test.js`.
- Boiler Homey metadata is covered by `test/sunberry-boiler-device-model.test.js`.
- Boiler control payloads are covered by `test/boiler-control.test.js`.
- Boiler Homey settings behavior is covered by `test/boiler-device-settings.test.js`.
- Boiler Flow card behavior is covered by `test/boiler-flow-cards.test.js` and `test/boiler-flow-compose.test.js`.
- Boiler kWh estimation behavior is covered by `test/boiler-energy-estimator.test.js`.
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
- Host normalization for plain hostnames, IP addresses and `http://...` settings is covered by `test/sunberry-host-resolver.test.js`.
- Homey/package/changelog version consistency is covered by `test/homey-metadata.test.js`.
