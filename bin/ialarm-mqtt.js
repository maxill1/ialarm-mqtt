#!/usr/bin/env node

const ialarmMqtt = require('../');
try {

    var _checkConfig = function(object, paths, index, defaultValue) {
      if (!index) {
        index = 0;
      }
      if (paths === undefined || paths.length === 0 || index >= paths.length) {
        return;
      }
      const key = Array.isArray(paths) ? paths[index] : paths;
      var exists = object !== undefined && object[key] !== undefined;
      if (!exists) {
        if (defaultValue && index === paths.length - 1) {
          //create default
          console.log(
            "Config.json value not specified on " +
              config.file +
              " using default '" +
              defaultValue +
              "' on " +
              JSON.stringify(paths)
          );
          object[key] = defaultValue;
        } else {
          throw "subscribe error: " +
            config.file +
            " is missing '" +
            paths[index] +
            "' on " +
            JSON.stringify(paths) +
            ". See: " +
            JSON.stringify(config.topics);
        }
      }
      _checkConfig(object[key], paths, index + 1, defaultValue);
    };

    var parseArgs = function (key, cmdArgs) {
        var data = {};
        try {
    
            var cmdArgs = process.argv.slice(2);
            if (cmdArgs && cmdArgs.length > 0) {
                for (let index = 0; index < cmdArgs.length; index++) {
                    const item = cmdArgs[index];
                    if (item === '-w' || item === '-d' || item === '-p' || item === '-t' || item === '-c') {
                        data[item] = cmdArgs[index + 1];
                        console.error("Found arg " + item + " with value " + data[item]);
                    }
                }
            }
        } catch (error) {
            console.error("Error parsing arguments: ", error);
        }
        return data;
    }
    
    var cmdArgs = parseArgs();
    
    if (!cmdArgs['-c']) {
        console.log("please provide the path of the folder containing config.json: ", "ialarm-mqtt -c /path");
        process.exit(1);
    }

    var configPath = cmdArgs['-c'];
    if(!configPath.endsWith("/")){
        configPath = configPath+"/"
    }
    console.log("Found external config.json", configPath);
    configFile = configPath + 'config.json'
    var config = require(configFile);
    
    if (config) {
        config.file = configFile;
        //checks
        _checkConfig(config, ['mqtt', 'host']);
        _checkConfig(config, ['mqtt', 'port']);
        _checkConfig(config, ['topics', 'availability']);
        _checkConfig(config, ['topics', 'alarm', 'command']);
        _checkConfig(config, ['topics', 'alarm', 'state']);
        _checkConfig(config, ['topics', 'alarm', 'event']);
        _checkConfig(config, ['topics', 'alarm', 'bypass'], 0, "ialarm/alarm/zone/${zoneId}/bypass");
        _checkConfig(config, ['topics', 'alarm', 'discovery'], 0, "ialarm/alarm/discovery");
        _checkConfig(config, ['payloads', 'alarmAvailable']);
        _checkConfig(config, ['payloads', 'alarmNotvailable']);
        _checkConfig(config, ['payloads', 'alarmDecoder']);
        _checkConfig(config, ['payloads', 'alarm']);
        _checkConfig(config, ['payloads', 'sensorOn']);
        _checkConfig(config, ['payloads', 'sensorOff']);


        if(!config.hadiscovery){
          config.hadiscovery = { enabled : false, topics : {}, events : {}, bypass: {}};
        }
        _checkConfig(config, ['hadiscovery', 'discoveryPrefix'], 0, "homeassistant");
        _checkConfig(config, ['hadiscovery', 'topics', 'alarmConfig'], 0, "${discoveryPrefix}/alarm_control_panel/ialarm/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'eventsConfig'], 0, "${discoveryPrefix}/sensor/ialarm/events/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'sensorConfig'], 0, "${discoveryPrefix}/binary_sensor/ialarm/${zoneId}/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'bypassConfig'], 0, "${discoveryPrefix}/switch/ialarm/${zoneId}/config");
        _checkConfig(config, ['hadiscovery', 'zoneName'], 0, "Zone");

        ialarmMqtt(config)
    } else {
        console.error('file config.json does not exist')
        process.exit(1)
    }
} catch (e) {
    console.error('error loading config.json', e)
    process.exit(1)
}