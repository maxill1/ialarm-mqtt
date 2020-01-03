
var pjson = require('../package.json');

module.exports = function (config, zonesToConfig, reset){

    var deviceConfig = {"manufacturer": "Antifurto365",
                    "identifiers": "ialarm",
                    "model": "ialarm",
                    "name": "IAlarm", 
                    "sw_version": pjson.version  
                };

    var configSensor = function(zone, i){
        var m = {};
        m.topic = config.hadiscovery.topics.sensorConfig.replace("${zoneId}", zone.id);
        
        if(reset){
            m.payload = "";
        }else{
            //TODO decode types
            var icon = config.hadiscovery.zones.default.icon;
            var device_class = config.hadiscovery.zones.default.device_class;
            if(zone.type){
                var type = zone.type.toLowerCase();
                if(config.hadiscovery.zones[type]){
                    icon = config.hadiscovery.zones[type].icon;
                    device_class = config.hadiscovery.zones[type].device_class;
                }
            }
            
            var zoneName = config.hadiscovery.zoneName;
            if(!zoneName){
                zoneName = "Zone";
            }
            m.payload = {name: zoneName+" "+zone.id +' '+ zone.name, 
                        availability_topic    : config.topics.availability,
                        state_topic           : config.topics.sensorSingleState.replace("${zoneId}", zone.id), 
                        payload_on            : config.values.sensorOn,
                        payload_off            : config.values.sensorOff,
                        json_attributes_topic : config.topics.sensorState, 
                        json_attributes_template:  "{{ value_json["+i+"] | tojson }}",
                        unique_id             : "alarm_zone_"+zone.id,
                        device_class          : device_class,
                        device                : deviceConfig
            };
            if(icon){
                m.payload.icon = icon;
            }
        }
        return m;
    }

    var configSensorEvents = function(){
        var m = {};
        m.topic = config.hadiscovery.topics.eventsConfig;
        
        if(reset){
            m.payload = "";
        }else{
            m.payload = {name: config.hadiscovery.events.name?config.hadiscovery.events.name:"iAlarm last event", 
                        availability_topic : config.topics.availability,
                        state_topic        : config.topics.event, 
                        unique_id          : "ialarm_events",
                        icon               : config.hadiscovery.events.icon,
                        device             : deviceConfig
            };
        }
        return m;
    }

    var configIAlarm = function(){
        var m = {};
        m.topic = config.hadiscovery.topics.alarmConfig;
            if(reset){
            m.payload = "";
        }else{
            m.payload = {
                        name                  : "iAlarm", 
                        unique_id             : "ialarm_mqtt",
                        device                : deviceConfig,
                        availability_topic    : config.topics.availability,
                        state_topic           : config.topics.alarmState, 
                        command_topic         : config.topics.alarmCommand,
                        code                  : config.hadiscovery.code,
                        payload_disarm        : config.values.alarmStates.disarm,
                        payload_arm_home      : config.values.alarmStates.armHome,
                        payload_arm_away      : config.values.alarmStates.armAway,
                        payload_available     : config.values.alarmAvailable,
                        payload_not_available : config.values.alarmNotvailable
                        };
        }
        return m;
    }

    this.createMessages = function(){

        var messages = [];
        var zoneSize = 40;
        if(!reset){
            zoneSize = zonesToConfig.length;
        }
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
    }
}