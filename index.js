const iAlarm = require("ialarm");
const iAlarmPublisher = require('./utils/mqtt-publisher');

module.exports = (config) => {

    if (!config) {
        console.error('Please provide a valid config.json');
        process.exit(1);
    }

    const publisher = new iAlarmPublisher(config);

    var zonesCache = {};
    var deviceInfo = {};


    function newAlarm() {
        return new iAlarm(
            config.server.host,
            config.server.port,
            config.server.username,
            config.server.password,
            config.server.zones)
    }

    function handleError(e) {
        let msg = "error " + JSON.stringify(e);
        publisher.publishError(msg);
    }

    function getZoneCache(id) {
        if (zonesCache &&
            zonesCache.zones &&
            zonesCache.zones[id]) {
            return zonesCache.zones.find(z => z.id === id);
        }
        return undefined;
    };

    function initZoneCache(initCallback) {

        console.log("Loading zone cache...");

        var host = config.server.host;
        var port = config.server.port;
        var username = config.server.username;
        var password = config.server.password;

        if (!host || !port || !username || !password) {
            throw 'Missing required configuration'
        }


        if (!zonesCache) {
            zonesCache = { zones: {}, caching: true };
        }

        //fetching alarm info
        newAlarm().getNet().then(function (network) {
            console.log(network);
            deviceInfo = network;

            //initial zone info fetch
            newAlarm().getZoneInfo().then(function (response) {
                var info = "got " + Object.keys(response).length + " zones info";
                console.log(info);
                //remove empty or disabled zones
                zonesCache.zones = removeEmptyZones(response);
                zonesCache.caching = false;
                initCallback();
            }, handleError).catch(handleError);

        }, handleError).catch(handleError);


    }

    /**
     * removes empty or disabled zones
     * @param {*} zones 
     * @returns 
     */
    function removeEmptyZones(zones) {
        return zones.filter(z => z.typeId > 0 && z.name !== '')
    }

    /**
     * Read and publis state
     */
    function readStatus() {
        try {
            newAlarm().getStatus().then(publishFullState, handleError).catch(handleError);
        } catch (e) {
            handleError(e);
        }
    }

    /**
     * Read logs and publish new events
     */
    function readEvents() {

        try {
            newAlarm().getEvents().then(function (events) {

                const lastEvent = events && events.length > 1 ? events[0] : undefined;
                if (lastEvent) {
                    var zoneCache = getZoneCache(lastEvent.zone);
                    if (zoneCache) {
                        lastEvent.name = zoneCache.name;
                        lastEvent.type = zoneCache.type;
                    }

                    var description = lastEvent.zone;
                    if (lastEvent.name) {
                        description = description + " " + lastEvent.name;
                    }
                    lastEvent.description = lastEvent.message + " (zone " + description + ")";
                }

                //publish only if changed or empty
                publisher.publishEvent(lastEvent);

            }, handleError).catch(handleError);

        } catch (e) {
            handleError(e);
        }
    }

    /**
     * publish received state and fetch new events 
     * @param {*} param0 
     */
    function publishFullState(data) {

        if (data.status.event === 'response') {
            console.log(data)
        }

        //we want to publish emtpy statues
        const { status, zones } = data ? data : {};

        //console.log(`New alarm status: ${status}`);
        //alarm
        publisher.publishStateIAlarm(status);


        //zone config override
        if (zones && config.zones) {
            for (const zoneId in config.zones) {
                const zoneConfig = config.zones[zoneId];
                if (zoneConfig) {
                    const zoneNumber = parseInt(zoneId)
                    var zone = zones.find(z => z.id === zoneNumber);
                    if (zone) {
                        //normally open /normally closed (default closed)
                        if (zoneConfig["contactType"] === 'NO') {
                            const fault = zone[zoneConfig.statusProperty || 'fault'];
                            //invert open/problem data
                            zone[zoneConfig.statusProperty || 'fault'] = !fault;
                        }
                    }
                }
            }
        }

        //publish sensors
        publisher.publishStateSensor(zones);
    }

    /**
     * publish received state and fetch new events 
     * @param {*} param0 
     */
    function publishStateAndFetchEvents(data) {

        publishFullState(data)

        //notify last event
        setTimeout(function () {
            readEvents();
        }, 500);
    }

    function armDisarm(commandType) {
        const alarm = newAlarm();
        if (!commandType || !alarm[commandType]()) {
            console.log(`Received invalid alarm command: ${commandType}`);
        } else {
            console.log(`Received alarm command: ${commandType}`);
            //force publish on next round
            publisher.resetCache();
            //command
            alarm[commandType]().then(publishStateAndFetchEvents, handleError).catch(handleError);

            if (config.debug) {
                console.log("DEBUG MODE: IGNORING SET COMMAND RECEIVED for alarm." + commandType + "()");
                console.log("DEBUG MODE: FAKING SET COMMAND RECEIVED for alarm." + commandType + "()");
                publisher.publishStateIAlarm(commandType);
                return;
            }
        }
    }

    function bypassZone(zoneNumber, bypass) {

        if (!zoneNumber || zoneNumber > 40) {
            console.error("bypassZone: received invalid zone number: " + zoneNumber);
            return;
        }

        if (!bypass) {
            bypass = false;
        }

        console.log("Received bypass " + bypass + " for zone number " + zoneNumber)

        //force publish on next round
        publisher.resetCache();
        newAlarm().bypassZone(zoneNumber, bypass).then(publishStateAndFetchEvents, handleError).catch(handleError);
    }

    function discovery(enabled, deviceInfo) {
        //home assistant mqtt discovery (if not enabled it will reset all /config topics)
        publisher.publishHomeAssistantMqttDiscovery(Object.values(zonesCache.zones), enabled, deviceInfo);
        if (!enabled) {
            console.log("Home assistant discovery disabled (empty config.hadiscovery)");
        }
    }


    function resetCache() {
        console.log("iAlarm cache cleared");
        publisher.resetCache();

        //sending fresh data
        readStatus();
    }

    //start loop
    function start() {
        console.log("Starting up...");

        console.log("Status polling every ", config.server.polling.status, " ms");
        console.log("Events polling every ", config.server.polling.events, " ms");

        //load zone names
        initZoneCache(function () {

            //mqtt init
            var commandHandler = {};
            commandHandler.armDisarm = armDisarm;
            commandHandler.bypassZone = bypassZone;
            commandHandler.discovery = discovery;
            commandHandler.resetCache = resetCache;
            publisher.connectAndSubscribe(commandHandler);

            //if enabled
            discovery(config.hadiscovery.enabled, deviceInfo);

            //alarm and sensor status
            setInterval(function () {
                publisher.publishAvailable();

                readStatus();
            }, config.server.polling.status);

            //event messages
            setInterval(function () {
                readEvents();
            }, config.server.polling.events);


        });

    }

    start();
}