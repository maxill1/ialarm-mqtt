
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
                if(config.hadiscovery.zones[type]
                    && config.hadiscovery.zones[type].icon){
                    icon = config.hadiscovery.zones[type].icon;
                    device_class = config.hadiscovery.zones[type].device_class;
                }
            }
            
            var zoneName = config.hadiscovery.zoneName;
            if(!zoneName){
                zoneName = "Zone";
            }

            //TODO trasformare in binary sensors https://www.home-assistant.io/integrations/binary_sensor/
            /*m.payload = {name: zoneName+" "+zone.id +' '+ zone.name, 
                        //device_class: "None",
                        availability_topic : config.topics.availability,
                        state_topic        : sensorState, 
                        value_template     : "{{ value_json["+i+"].message}}",
                        unique_id          : "alarm_zone_"+zone.id,
                        icon               : icon,
                        device             : deviceConfig
            };*/
            m.payload = {name: zoneName+" "+zone.id +' '+ zone.name, 
                        //device_class: "None",
                        availability_topic    : config.topics.availability,
                        state_topic           : config.topics.sensorSingleState.replace("${zoneId}", zone.id), 
                        payload_on            : config.values.sensorOn,
                        payload_off            : config.values.sensorOff,
                        //json_attributes_topic : config.topics.sensorSingleAttrs.replace("${zoneId}", zone.id), 
                        json_attributes_topic : config.topics.sensorState, 
                        json_attributes_template:  "{{ value_json["+i+"] | tojson }}",
                        unique_id             : "alarm_zone_"+zone.id,
                        device_class          : device_class,
                        //icon                  : icon,
                        device                : deviceConfig
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
            //config per ogni zona che serve per l'hadiscovery e stato 
            messages.push(configSensor(zone, i));
        }

        //config e stato antifurto
        messages.push(configIAlarm());
        return messages;
    }
}