
var pjson = require('../package.json');

module.exports = function (config, zonesToConfig, reset) {

    var deviceConfig = {
        manufacturer: "Antifurto365",
        identifiers: "ialarm",
        model: "ialarm",
        name: "IAlarm",
        sw_version: pjson.version
    };

    var _getTopic = function (topicTemplate, data) {
        if (!data) {
            data = {};
        }
        data.discoveryPrefix = config.hadiscovery.discoveryPrefix || "homeassistant";
        var topic = topicTemplate;
        for (const key in data) {
            const value = data[key];
            //${key}
            topic = topic.replace("${" + key + "}", value);
        }
        return topic;
    };

    var configSensor = function (zone, i) {
        var payload = "";
        if (!reset) {
            var zoneName = config.hadiscovery.zoneName;
            if (!zoneName) {
                zoneName = "Zone";
            }


            //optional
            var icon;
            var device_class;
            var statusProperty = "problem"; //default problem (code != 0, es. 16 )
            //priority to zone config
            if (config.zones && config.zones[zone.id]) {
                icon = config.zones[zone.id].icon;
                device_class = config.zones[zone.id].device_class;
                if (config.zones[zone.id].statusProperty) {
                    statusProperty = config.zones[zone.id].statusProperty;
                }
            }

            payload = {
                name: zoneName + " " + zone.id + " " + zone.name,
                availability_topic: config.topics.availability,
                //state_topic           : _getTopic(config.topics.sensors.zone.alarm, {"zoneId}" : zone.id}),
                state_topic: config.topics.sensors.state,
                value_template: "{{ '1' if value_json[" + i + "]." + statusProperty + " else '0' }}",
                payload_on: config.payloads.sensorOn,
                payload_off: config.payloads.sensorOff,
                json_attributes_topic: config.topics.sensors.state,
                json_attributes_template: "{{ value_json[" + i + "] | tojson }}",
                unique_id: "alarm_zone_" + zone.id,
                device: deviceConfig,
                qos: config.topics.sensors.sensors_qos
            };

            //fallback to generic hadiscovery
            if (config.hadiscovery.zones) {
                if (zone.type) {
                    var type = zone.type.toLowerCase();
                    if (config.hadiscovery.zones[type]) {
                        icon = icon || config.hadiscovery.zones[type].icon;
                        device_class = device_class || config.hadiscovery.zones[type].device_class;
                    }
                }
                if (!icon) {
                    icon = config.hadiscovery.zones.default.icon;
                }
                if (!device_class) {
                    device_class = config.hadiscovery.zones.default.device_class;
                }

            }
            //icon is not supported on binary sensor, only switches, light, sensor, etc
            if (payload.state_topic.indexOf("/binary_sensor/") === -1) {
                payload.icon = icon;
            }
            payload.device_class = device_class || "safety"; //default
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.sensorConfig, {
                zoneId: zone.id
            }),
            payload
        };
    };

    /**
     * Log event (last)
     * @returns 
     */
    var configSensorEvents = function () {
        var payload = "";
        if (!reset) {
            payload = {
                name: config.hadiscovery.events.name
                    ? config.hadiscovery.events.name
                    : "iAlarm last event",
                availability_topic: config.topics.availability,
                state_topic: config.topics.alarm.event,
                value_template: "{{value_json.description}}",
                json_attributes_topic: config.topics.alarm.event,
                json_attributes_template: "{{ value_json | tojson }}",
                unique_id: "ialarm_events",
                icon: config.hadiscovery.events.icon,
                device: deviceConfig,
                qos: config.topics.sensors.sensors_qos
            };
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.eventsConfig),
            payload
        };
    };

    var configSwitchBypass = function (zone, i) {
        var zoneName = config.hadiscovery.zoneName || "Zone";
        var bypassName = config.hadiscovery.bypass.name || "Bypass";
        var payload = "";
        if (!reset) {
            payload = {
                name: bypassName + " " + zoneName + " " + zone.id + " " + zone.name,
                availability_topic: config.topics.availability,
                state_topic: config.topics.sensors.state,
                value_template: "{{ '1' if value_json[" + i + "].bypass else '0' }}",
                payload_on: config.payloads.sensorOn,
                payload_off: config.payloads.sensorOff,
                command_topic: _getTopic(config.topics.alarm.bypass, {
                    zoneId: zone.id
                }),
                unique_id: "alarm_bypass_zone_" + zone.id,
                icon: config.hadiscovery.bypass.icon,
                device: deviceConfig,
                qos: config.topics.sensors.sensors_qos
            };
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.bypassConfig, {
                zoneId: zone.id
            }),
            payload
        };
    };

    /**
    * switch to clear cached values
    * @param {*} zone 
    * @param {*} i 
    * @returns 
    */
    var configSwitchClearCache = function () {
        var payload = "";
        if (!reset) {
            payload = {
                name: "iAlarm clean cache",
                availability_topic: config.topics.availability,
                state_topic: config.topics.alarm.configStatus,
                value_template: `{{ value_json.cacheClear }}`,
                command_topic: config.topics.alarm.resetCache,
                payload_on: 'ON',
                payload_off: 'OFF',
                unique_id: "alarm_clear_cache",
                icon: 'mdi:reload-alert',
                device: deviceConfig,
                qos: config.topics.sensors.sensors_qos
            };
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.clearCacheConfig),
            payload
        };
    };

    /**
    * switch to clear discovery
    * @param {*} zone 
    * @param {*} i 
    * @returns 
    */
    var configSwitchClearDiscovery = function () {
        var payload = "";
        if (!reset) {
            payload = {
                name: "iAlarm clean discovery",
                availability_topic: config.topics.availability,
                state_topic: config.topics.alarm.configStatus,
                value_template: `{{ value_json.discoveryClear }}`,
                command_topic: config.topics.alarm.discovery,
                payload_on: 'ON',
                payload_off: 'OFF',
                unique_id: "alarm_clear_discovery",
                icon: 'mdi:refresh',
                device: deviceConfig,
                qos: config.topics.sensors.sensors_qos
            };
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.clearDiscoveryConfig),
            payload
        };
    };



    /**
     * switch to cancel triggered sensors alarms
     * @param {*} zone 
     * @param {*} i 
     * @returns 
     */
    var configSwitchCancelTriggered = function () {
        var payload = "";
        if (!reset) {
            payload = {
                name: "iAlarm cancel triggered",
                availability_topic: config.topics.availability,
                state_topic: config.topics.alarm.configStatus,
                value_template: `{{ value_json.cancel }}`,
                command_topic: config.topics.alarm.command,
                payload_on: 'cancel',
                payload_off: 'OFF',
                unique_id: "alarm_cancel_trigger",
                icon: 'mdi:alarm-light',
                device: deviceConfig,
                qos: config.topics.sensors.sensors_qos
            };
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.clearTriggeredConfig),
            payload
        };
    };

    var configIAlarm = function () {
        var payload = "";
        if (!reset) {
            payload = {
                name: "iAlarm",
                unique_id: "ialarm_mqtt",
                device: deviceConfig,
                availability_topic: config.topics.availability,
                state_topic: config.topics.alarm.state,
                command_topic: config.topics.alarm.command,
                payload_disarm: config.payloads.alarm.disarm,
                payload_arm_home: config.payloads.alarm.armHome,
                payload_arm_away: config.payloads.alarm.armAway,
                payload_available: config.payloads.alarmAvailable,
                payload_not_available: config.payloads.alarmNotvailable,
                qos: config.topics.alarm_qos
            };
            //optional
            if (config.hadiscovery.code) {
                payload.code = config.hadiscovery.code;
            }
        }
        return {
            topic: _getTopic(config.hadiscovery.topics.alarmConfig),
            payload
        };
    };

    this.createMessages = function () {

        var messages = [];
        var zoneSize = reset ? 40 : zonesToConfig.length || 40;
        for (var i = 0; i < zoneSize; i++) {


            var zone;
            if (reset) {
                zone = { id: i + 1 };
            } else {
                zone = zonesToConfig[i];
                //disabled/not in use zone
                if (zone.typeId === 0) {
                    console.log(`Ignoring unused zone ${zone.id}`)
                    continue;
                }
            }



            //binary sensors
            messages.push(configSensor(zone, i));

            //bypass switches
            messages.push(configSwitchBypass(zone, i));
        }

        //switch to clear cache and discovery configs
        messages.push(configSwitchClearCache());
        messages.push(configSwitchClearDiscovery());
        //cancel alarm triggered
        messages.push(configSwitchCancelTriggered());

        //alarm state
        messages.push(configIAlarm());
        //last event
        messages.push(configSensorEvents());
        return messages;
    };
}
