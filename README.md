# Sunberry

Smart local monitoring and control for Sunberry photovoltaic installations in Homey.

## Version 3 Breaking Change

Sunberry is now exposed as separate Homey devices instead of one all-in-one device. Existing users must remove the old Sunberry device, add the new devices, and move their Flows to the new device model.

Core devices:

- Sunberry Battery
- Sunberry Solar
- Sunberry Home Consumption
- Sunberry Smart Meter

Optional devices are available when the installer enabled the corresponding Sunberry portal feature:

- Sunberry Smart Contact
- Sunberry Boiler 1F
- Sunberry Boiler 3F

Homey Energy uses Battery, Solar and Smart Meter for the native energy model. Home Consumption remains telemetry-only because Sunberry GRID values represent house load, not a verified public grid import meter. Several kWh values are estimated from instantaneous W values and polling intervals, so they are intended for Homey Energy visualization rather than billing-grade metering.
