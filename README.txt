The app provides basic data and control for your Sunberry module (SolidSun version Unipy 103 S). It primarily offers data on consumption for each phase, total consumption, and basic actions to control the battery.
All this works in combination with the GoodWe ET inverter (a combination installed by SolidSun in the Czech Republic).
I have asked SolidSun for documentation, and if they provide it, I will try to add more actions, though I may not always have the means to test them.

Version 3.0.0 is a breaking change. The app exposes Sunberry as three Homey devices: Sunberry Battery, Sunberry Solar, and Sunberry Home Consumption. Existing users of the old all-in-one device must re-pair their Sunberry host after upgrading.

If you have problem with getting data or sending data to your device, try setting device IP adress in device settings.
