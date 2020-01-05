
var pjson = require('../package.json');

module.exports = function (config, zonesToConfig, reset){

    var deviceConfig = {
      manufacturer: "Antifurto365",
      identifiers: "ialarm",
      model: "ialarm",
      name: "IAlarm",
      sw_version: pjson.version
    };

    var _getTopic = function(topicTemplate, data) {
      if (!data) {
        data = {};
      }
      data.discoveryPrefix = config.hadiscovery.discoveryPrefix || "homeassistant";
      var topic = topicTemplate;
      for (const key in data) {
        const value = data[key];
        topic = topic.replace("${" + key + "}", value);
      }
      return topic;
    };

    var configSensor = function(zone, i) {
      var payload = "";
      if (!reset) {
        var icon = config.hadiscovery.zones.default.icon;
        var device_class = config.hadiscovery.zones.default.device_class;
        if (zone.type) {
          var type = zone.type.toLowerCase();
          if (config.hadiscovery.zones[type]) {
            icon = config.hadiscovery.zones[type].icon;
            device_class = config.hadiscovery.zones[type].device_class;
          }
        }

        var zoneName = config.hadiscovery.zoneName;
        if (!zoneName) {
          zoneName = "Zone";
        }
        payload = {
          name: zoneName + " " + zone.id + " " + zone.name,
          availability_topic: config.topics.availability,
          //state_topic           : _getTopic(config.topics.sensors.zone.alarm, {"zoneId}" : zone.id}),
          state_topic: config.topics.sensors.state,
          value_template: "{{ '1' if value_json[" + i + "].problem else '0' }}",
          payload_on: config.payloads.sensorOn,
          payload_off: config.payloads.sensorOff,
          json_attributes_topic: config.topics.sensors.state,
          json_attributes_template: "{{ value_json[" + i + "] | tojson }}",
          unique_id: "alarm_zone_" + zone.id,
          device_class: device_class,
          device: deviceConfig
        };
        if (icon) {
          m.payload.icon = icon;
        }
      }
      return {
        topic: _getTopic(config.hadiscovery.topics.sensorConfig, {
          zoneId : zone.id
        }),
        payload
      };
    };

    var configSensorEvents = function() {
      var payload = "";
      if (!reset) {
        payload = {
          name: config.hadiscovery.events.name
            ? config.hadiscovery.events.name
            : "iAlarm last event",
          availability_topic: config.topics.availability,
          state_topic: config.topics.alarm.event,
          unique_id: "ialarm_events",
          icon: config.hadiscovery.events.icon,
          device: deviceConfig
        };
      }
      return {
        topic: _getTopic(config.hadiscovery.topics.eventsConfig),
        payload
      };
    };

    var configIAlarm = function() {
      var payload = "";
      if (!reset) {
        payload = {
          name: "iAlarm",
          unique_id: "ialarm_mqtt",
          device: deviceConfig,
          availability_topic: config.topics.availability,
          state_topic: config.topics.alarm.state,
          command_topic: config.topics.alarm.command,
          code: config.hadiscovery.code,
          payload_disarm: config.payloads.alarm.disarm,
          payload_arm_home: config.payloads.alarm.armHome,
          payload_arm_away: config.payloads.alarm.armAway,
          payload_available: config.payloads.alarmAvailable,
          payload_not_available: config.payloads.alarmNotvailable
        };
      }
      return {
        topic: _getTopic(config.hadiscovery.topics.alarmConfig),
        payload
      };
    };

    this.createMessages = function(){

        var messages = [];
        var zoneSize = reset?40:zonesToConfig.length || 40;
        for (var i = 0; i <zoneSize; i++) {
            
            if(i>=config.server.zones){
                break;
            }

            var zone;
            if(reset){
                zone = {id : i+1};
            }else{
                zone = zonesToConfig[i];
            }
            //binary sensors
            messages.push(configSensor(zone, i));
        }

        //alarm state
        messages.push(configIAlarm());
        //last event
        messages.push(configSensorEvents());
        return messages;
    };
}