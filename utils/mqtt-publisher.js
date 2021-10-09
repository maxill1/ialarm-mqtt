const mqtt = require('mqtt');

module.exports = function (config) {

    var client = undefined;

    var _cache = {
        data: {}, enabled: config.mqtt.cache !== undefined, time: function () {
            const expr = config.mqtt.cache;
            if (expr) {
                var molt = 0;

                if (expr.endsWith("s")) {
                    molt = 1000;
                } else if (expr.endsWith("m")) {
                    molt = 60000;
                } else if (expr.endsWith("h")) {
                    molt = 60000 * 60;
                } else if (expr.endsWith("d")) {
                    molt = 60000 * 60 * 24;
                } else {
                    console.log("Using default cache: 5m");
                    //default 5 min
                    return 5 * 60000;
                }
                return expr.substring(0, expr.length - 1) * molt;
            }
            return 0;
        }()
    };

    var _resetCache = function (topic) {
        if (topic) {
            _cache.data[topic]
        } else {
            _cache.data = {};
        }
    }

    this.resetCache = _resetCache;

    var _decodeStatus = function (status) {
        try {
            const currentStatus = status.toLowerCase();
            var values = config.payloads.alarmDecoder;
            if (values && currentStatus) {
                for (const key in values) {
                    if (values.hasOwnProperty(key)) {
                        const item = values[key];
                        if (Array.isArray(item)) {
                            for (let index = 0; index < item.length; index++) {
                                const element = item[index];
                                if (element.toLowerCase() === currentStatus) {
                                    return key;
                                }
                            }
                        } else {
                            if (item.toLowerCase() === currentStatus) {
                                return key;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log("error")
        }
        return status;
    }

    var _publishAndLog = function (topic, data, options) {
        var dataLog;
        if (data) {
            if (config.verbose) {
                dataLog = JSON.stringify(data);
            } else if (typeof data === 'string') {
                dataLog = data;
            } else if (Array.isArray(data)) {
                dataLog = "Array of " + data.length + " elements";
            } else {
                dataLog = "Object with " + Object.keys(data).length + " keys";
            }
        } else {
            dataLog = data;
        }
        if (_publish(topic, data, options)) {
            console.log("sending topic '" + topic + "' : " + dataLog);
        }
    }

    var _cacheExpireDate = function (date) {
        return new Date(date.getTime() + _cache.time);
    }

    var _sameData = function (topic, obj2) {

        //cache empty
        if (!_cache.enabled || !_cache.data[topic] || !_cache.data[topic].lastChecked
            //cache expired
            || new Date() > _cacheExpireDate(_cache.data[topic].lastChecked)
            //HA config topic
            || topic.endsWith("/config")) {
            //needs republishing
            return false;
        }

        //deep check
        var obj1 = _cache.data[topic].payload;
        return _sameObject(obj1, obj2);
    }

    var _sameObject = function (obj1, obj2) {
        if (Object.keys(obj1).length != Object.keys(obj2).length) {
            return false;
        }
        for (const key in obj1) {
            //ignoring lastChecked
            if (key === 'lastChecked') {
                continue;
            }
            if (obj1.hasOwnProperty(key)) {
                const value1 = obj1[key];
                const value2 = obj2[key];
                if (typeof value1 !== typeof value2) {
                    return false;
                }
                if (typeof value1 === 'object') {
                    //checking childs
                    return _sameObject(value1, value2);
                }
                if (value1 !== value2) {
                    return false;
                }
            }
        }
        //assuming it's the same object
        return true;
    }

    var _publish = function (topic, data, options) {

        if (_sameData(topic, data)) {
            console.log(topic + " - not publishing...unchanged");
            return false;
        }

        if (client) {

            options = options || {};
            options.retain = config.mqtt.retain || false;

            var payload = data;
            if (typeof data !== "string") {
                payload = JSON.stringify(data);
            }
            client.publish(topic, payload, options);
            //cache the original data, ignoring config
            if (!topic.endsWith("/config")) {
                _cache.data[topic] = { payload: data, lastChecked: data.lastChecked || new Date() };
                console.log("Caching " + topic + " until " + _cacheExpireDate(_cache.data[topic].lastChecked));
            }
            return true;
        } else {
            console.log(topic + " - error publishing...not connected");
            return false;
        }
    }

    this.connectAndSubscribe = function (alarmCommands) {

        var clientId = config.mqtt.clientId || "ialarm-mqtt-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        console.log("connection to MQTT broker: ", config.mqtt.host + ":" + config.mqtt.port);
        client = mqtt.connect('mqtt://' + config.mqtt.host + ":" + config.mqtt.port, {
            username: config.mqtt.username,
            password: config.mqtt.password,
            clientId: clientId,
            will: { topic: config.topics.availability, payload: 'offline' }
        })

        client.on('connect', function () {
            console.log("connected...");
            var topicsToSubscribe = [
                config.topics.alarm.command,
                config.topics.alarm.bypass.replace("${zoneId}", "+"),
                config.topics.alarm.discovery,
                config.topics.alarm.resetCache
            ];
            console.log("subscribing to " + JSON.stringify(topicsToSubscribe));
            client.subscribe(topicsToSubscribe, function (err) {
                if (err) {
                    console.log("Error subscribing" + err.toString());
                }
                _resetCache();
            });
        });

        client.on("message", function (topic, message) {
            var command;
            try {
                command = message.toString();
            } catch (error) {
                command = message;
            }
            console.log("received topic '" + topic + "' : ", command);

            //arm/disarm topic
            if (topic === config.topics.alarm.command) {
                var ialarmCommand = _decodeStatus(command);
                console.log("Alarm command: " + ialarmCommand + " (" + command + ")");
                if (alarmCommands.armDisarm) {
                    alarmCommands.armDisarm(ialarmCommand);
                    console.log("Executed: " + ialarmCommand + " (" + command + ")");
                }

            } else if (topic === config.topics.alarm.discovery) { //any payload
                console.log("Requested new HA discovery...");
                if (alarmCommands.discovery && command) {
                    var on = command === 'on' || command === 1 || command == "true";
                    alarmCommands.discovery(on);
                }
            } else if (topic === config.topics.alarm.resetCache) { //any payload
                if (alarmCommands.resetCache) {
                    alarmCommands.resetCache();
                }
            } else {
                //bypass topic
                //var topicRegex = new RegExp(/ialarm\/alarm\/zone\/(\d{1,2})\/bypass/gm);
                //"ialarm\/alarm\/zone\/(\\d{1,2})\/bypass"
                var strRegex = config.topics.alarm.bypass
                    .replace("/", "/")
                    .replace("${zoneId}", "(\\d{1,2})"); //.replace("+", "(\\d{1,2})")
                var topicRegex = new RegExp(strRegex, "gm");
                var match = topicRegex.exec(topic);
                if (match) {
                    var zoneNumber = match[1];
                    console.log("Alarm bypass: zone " + zoneNumber + " (" + command + ")");

                    var accepted = ["1", "0", "true", "false", "on", "off"];
                    var knownCommand = false;
                    for (let index = 0; index < accepted.length; index++) {
                        const cmd = accepted[index];
                        if (cmd === command.toLowerCase()) {
                            knownCommand = true;
                            break;
                        }
                    }
                    if (!knownCommand) {
                        console.log(
                            "Alarm bypass zone " +
                            zoneNumber +
                            " ignored invalid command: " +
                            command
                        );
                        return;
                    }
                    var bypass =
                        command === "1" ||
                        command.toLowerCase() === "true" ||
                        command.toLowerCase() === "on";
                    if (bypass) {
                        console.log("Alarm bypass zone " + zoneNumber);
                    } else {
                        console.log("Alarm bypass removed from zone " + zoneNumber);
                    }
                    if (alarmCommands.bypassZone) {
                        alarmCommands.bypassZone(zoneNumber, bypass);
                    }
                }
            }
        });

        client.on('error', function (err) {
            // message is Buffer
            console.log(err)
            client.end()
        })
    }



    this.publishStateSensor = function (zones) {

        if (!zones) {
            console.log("No zone found to publish");
            return;
        }

        if (!config.topics.sensors) {
            //don't publish sensors
            console.log("config.json has no 'config.topics.sensors' configured. Skipping.");
            return;
        }

        var configuredZones = zones.length;

        //one payload with all sensors data (sensors attrs)
        if (!config.topics.sensors.topicType || config.topics.sensors.topicType === 'state') {
            _publishAndLog(config.topics.sensors.state, zones);
        }
        //multiple payload with single sensor data
        if (zones && zones.length > 0 && (!config.topics.sensors.topicType || config.topics.sensors.topicType === 'zone')) {

            console.log("sending topic '" + config.topics.sensors.zone.alarm + "' for " + configuredZones + " zones");
            console.log("sending topic '" + config.topics.sensors.zone.active + "' for " + configuredZones + " zones");
            console.log("sending topic '" + config.topics.sensors.zone.lowBattery + "' for " + configuredZones + " zones");
            console.log("sending topic '" + config.topics.sensors.zone.fault + "' for " + configuredZones + " zones");

            for (var i = 0; i < configuredZones; i++) {
                var zone = zones[i];
                var pub = _publish;
                if (config.verbose) {
                    pub = _publishAndLog;
                }
                pub(config.topics.sensors.zone.alarm.replace("${zoneId}", zone.id), zone.alarm ? config.payloads.sensorOn : config.payloads.sensorOff);
                pub(config.topics.sensors.zone.active.replace("${zoneId}", zone.id), zone.bypass ? config.payloads.sensorOn : config.payloads.sensorOff);
                pub(config.topics.sensors.zone.lowBattery.replace("${zoneId}", zone.id), zone.lowbat ? config.payloads.sensorOn : config.payloads.sensorOff);
                pub(config.topics.sensors.zone.fault.replace("${zoneId}", zone.id), zone.fault ? config.payloads.sensorOn : config.payloads.sensorOff);
            }
        }
    }

    this.publishStateIAlarm = function (status) {
        var m = {};
        m.topic = config.topics.alarm.state;
        //decode status
        var alarmState = _decodeStatus(status);
        m.payload = (config.payloads.alarm && config.payloads.alarm[alarmState]) || status;
        _publishAndLog(m.topic, m.payload);
    }

    this.publishAvailable = function () {
        var m = {};
        m.topic = config.topics.availability;
        m.payload = "online";
        _publish(m.topic, m.payload);
    }

    this.publishError = function (error) {
        var m = {};
        m.topic = config.topics.error;
        m.payload = error;
        _publish(m.topic, m.payload);
    }

    this.publishEvent = function (data) {
        var m = {};
        m.topic = config.topics.alarm.event;
        m.payload = data;
        _publish(m.topic, m.payload);
    }

    this.publishHomeAssistantMqttDiscovery = function (zones, on) {

        //Reset of 40 zones
        const iAlarmHaDiscovery = require('./mqtt-hadiscovery');
        var messages = new iAlarmHaDiscovery(config, zones, true).createMessages();
        for (let index = 0; index < messages.length; index++) {
            const m = messages[index];
            _publishAndLog(m.topic, m.payload, { retain: true });
        }

        if (on) {
            //let's wait HA processes all the entity reset, then submit again the discovered entity
            setTimeout(function () {
                //mqtt discovery messages to publish
                var messages = new iAlarmHaDiscovery(config, zones, false).createMessages();
                for (let index = 0; index < messages.length; index++) {
                    const m = messages[index];
                    _publishAndLog(m.topic, m.payload, { retain: true });//config
                }
            }, 5000);
        }
    }

}