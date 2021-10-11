#!/usr/bin/env node

const ialarmMqtt = require('../');
try {
    var configFile;

    var _checkConfig = function (object, paths, index, defaultValue) {
        if (!index) {
            index = 0;
        }
        if (paths === undefined || paths.length === 0 || index >= paths.length) {
            return;
        }
        const key = Array.isArray(paths) ? paths[index] : paths;
        var exists = object !== undefined && object[key] !== undefined;
        if (!exists) {
            if (defaultValue !== undefined && index === paths.length - 1) {
                //create default
                console.log(
                    "Config.json value not specified on " +
                    configFile +
                    " using default '" +
                    defaultValue +
                    "' on " +
                    JSON.stringify(paths)
                );
                object[key] = defaultValue;
            } else {
                throw "subscribe error: " +
                configFile +
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
                    if (item === '-w' || item === '-d' || item === '-p' || item === '-t' || item === '-c' || item === '--hassos') {
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

    if (!cmdArgs['--hassos'] && !cmdArgs['-c']) {
        console.log("please provide the path of the folder containing config.json: ", "ialarm-mqtt -c /path");
        process.exit(1);
    }

    //merge default config.json with options.json
    var config;
    if (cmdArgs['--hassos']) {
        configFile = cmdArgs['--hassos'];
        console.log("Trying to merge HASSOS options file (" + cmdArgs['--hassos'] + ") with default config.json");
        var hassos = require(cmdArgs['--hassos']);
        //default file
        config = require('../config.json');
        //merge main nodes
        config.server = hassos.server;
        config.mqtt = hassos.mqtt;

        //merge polling
        config.server.polling = {
            events: hassos.server.polling_events,
            status: hassos.server.polling_status
        }
        //merge hadiscovery values
        config.hadiscovery.code = hassos.code || '';
        config.hadiscovery.zoneName = hassos.zoneName || 'Zone';
        config.hadiscovery.events = hassos.events;
        config.hadiscovery.bypass = hassos.bypass;

        //merge zones
        hassos.zones && hassos.zones.forEach(zone => {
            config.zones['' + zone.number] = zone;
        });

    } else {

        var configPath = cmdArgs['-c'];
        //if is a json file
        if (configPath.endsWith(".json")) {
            configFile = configPath;
            console.log("Found external config.json", configPath);
            config = require(configFile);
        } else {
            //Folder
            if (!configPath.endsWith("/")) {
                configPath = configPath + "/"
            }
            console.log("Searching external config.json in path", configPath);
            //loading external file
            configFile = configPath + 'config.json';
            config = require(configFile);
        }
    }


    if (config) {
        //checks
        _checkConfig(config, ['mqtt', 'host']);
        _checkConfig(config, ['mqtt', 'port']);
        _checkConfig(config, ['topics', 'availability']);
        _checkConfig(config, ['topics', 'alarm', 'command']);
        _checkConfig(config, ['topics', 'alarm', 'state']);
        _checkConfig(config, ['topics', 'alarm', 'event']);
        _checkConfig(config, ['topics', 'alarm', 'bypass'], 0, "ialarm/alarm/zone/${zoneId}/bypass");
        _checkConfig(config, ['topics', 'alarm', 'discovery'], 0, "ialarm/alarm/discovery");
        _checkConfig(config, ['topics', 'alarm', 'resetCache'], 0, "ialarm/alarm/resetCache");
        _checkConfig(config, ['topics', 'alarm', 'configStatus'], 0, "ialarm/alarm/configStatus");
        _checkConfig(config, ['payloads', 'alarmAvailable']);
        _checkConfig(config, ['payloads', 'alarmNotvailable']);
        _checkConfig(config, ['payloads', 'alarmDecoder']);
        _checkConfig(config, ['payloads', 'alarm']);
        _checkConfig(config, ['payloads', 'sensorOn']);
        _checkConfig(config, ['payloads', 'sensorOff']);


        if (!config.hadiscovery) {
            config.hadiscovery = { enabled: false, topics: {}, events: {}, bypass: {} };
        }
        if (!config.hadiscovery.topics) {
            config.hadiscovery.topics = {};
        }
        _checkConfig(config, ['hadiscovery', 'enabled'], 0, true);
        _checkConfig(config, ['hadiscovery', 'discoveryPrefix'], 0, "homeassistant");
        _checkConfig(config, ['hadiscovery', 'topics', 'alarmConfig'], 0, "${discoveryPrefix}/alarm_control_panel/ialarm/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'eventsConfig'], 0, "${discoveryPrefix}/sensor/ialarm/events/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'sensorConfig'], 0, "${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/fault/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'sensorBatteryConfig'], 0, "${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/battery/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'sensorAlarmConfig'], 0, "${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/alarm/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'sensorConnectivityConfig'], 0, "${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/connectivity/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'bypassConfig'], 0, "${discoveryPrefix}/switch/ialarm/${zoneId}/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'clearCacheConfig'], 0, "${discoveryPrefix}/switch/ialarm/clear_cache/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'clearDiscoveryConfig'], 0, "${discoveryPrefix}/switch/ialarm/clear_discovery/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'clearTriggeredConfig'], 0, "${discoveryPrefix}/switch/ialarm/clear_triggered/config");
        _checkConfig(config, ['hadiscovery', 'topics', 'alarm_qos'], 0, 2);
        _checkConfig(config, ['hadiscovery', 'topics', 'sensors_qos'], 0, 0);
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