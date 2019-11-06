
const config = require('./mqtt-ialarm-constants');
var pjson = require('./package.json');

function autodiscovery (zonesToConfig, reset){

    var deviceConfig = {"manufacturer": "Antifurto365",
                    "identifiers": "ialarm",
                    "model": "ialarm",
                    "name": "IAlarm", 
                    "sw_version": pjson.version  
                };


    var configSensor = function(zone, i){
        var m = {};
        m.topic = config.autodiscovery.topic.sensorConfig.replace("${zoneId}", zone.id);
        
        if(reset){
            m.payload = "";
        }else{
            //TODO decode types
            var icon = config.autodiscovery.zones.default.icon;
            if(zone.type){
                var type = zone.type.toLowerCase();
                if(config.autodiscovery.zones[type]
                    && config.autodiscovery.zones[type].icon){
                    icon = config.autodiscovery.zones[type].icon;
                }
            }
            
            var zoneName = config.autodiscovery.zoneName;
            if(!zoneName){
                zoneName = "Zone";
            }

            //TODO trasformare in binary sensors https://www.home-assistant.io/integrations/binary_sensor/
            m.payload = {name: zoneName+" "+zone.id +' '+ zone.name, 
                        //device_class: "None",
                        availability_topic : config.topic.availability,
                        state_topic: "homeassistant/sensor/ialarm/state", 
                        value_template: "{{ value_json["+i+"].message}}",
                        unique_id : "alarm_zone_"+zone.id,
                        icon : icon,
                        device: deviceConfig
            };
        }
        return m;
    }

    var configIAlarm = function(){
        var m = {};
        m.topic = config.autodiscovery.topic.alarmConfig;
            if(reset){
            m.payload = "";
        }else{
            m.payload = {
                        name                : "iAlarm", 
                        availability_topic  : config.topic.availability,
                        state_topic         : config.topic.alarmStatus, 
                        command_topic       : config.topic.alarmSet,
                        unique_id           : "ialarm_mqtt",
                        code                : config.autodiscovery.code,
                        device: deviceConfig
                        };
        }
        return m;
    }


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
        //config per ogni zona che serve per l'autodiscovery e stato 
        messages.push(configSensor(zone, i));
    }


    //config e stato antifurto
    messages.push(configIAlarm());

    this.publishConfigs = function(){
        
        for (var i = 0; i <messages.length; i++) {
            var m = messages[i];
            //TODO publish mqtt
        }
    }
}

