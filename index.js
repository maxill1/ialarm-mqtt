const iAlarm = require("ialarm/ialarm-tcp");
const iAlarmPublisher = require('./utils/mqtt-publisher');

module.exports = (config) => {

    if (!config) {
        console.error('Please provide a valid config.json');
        process.exit(1);
    }

    const publisher = new iAlarmPublisher(config);

    var globalContext = {};


    function newAlarm() {
        return new iAlarm(
            config.server.host,
            config.server.port,
            config.server.username,
            config.server.password)
    }

    function handleError(e) {
        let error = e;
        if (e.message) {
            error = e.message;
        }
        let msg = "error " + error;
        console.log(msg);
        console.log(e);
        publisher.publishError(msg);
    }

    function getZoneCache(id) {
        if (globalContext.zonesCache &&
            globalContext.zonesCache.zones &&
            globalContext.zonesCache.zones[id]) {
            return globalContext.zonesCache.zones.find(z => z.id === id);
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


        if (!globalContext.zonesCache) {
            globalContext.zonesCache = { zones: {}, caching: true };
        }

        //initial zone info fetch
        newAlarm().getZoneInfo().then(function (response) {
            var info = "got " + Object.keys(response).length + " zones info";
            console.log(info);
            globalContext.zonesCache.zones = response.filter(z => z.typeId > 0 && z.name !== '');
            globalContext.zonesCache.caching = false;
            initCallback();
        }, handleError).catch(handleError);
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
                if (events.length > 0) {

                    for (var i = 0; i < events.length; i++) {
                        var zoneCache = getZoneCache(events[i].zone);
                        if (zoneCache) {
                            events[i].name = zoneCache.name;
                            events[i].type = zoneCache.type;
                        }
                    }

                    let ev = events[0];
                    var description = ev.zone;
                    if (ev.name) {
                        description = description + " " + ev.name;
                    }
                    const lastEvent = {
                        ...events[0],
                        description: ev.message + " (zone " + description + ")"
                    };
                    //publish only if changed or empty
                    if (lastEvent && (!globalContext.lastEventCache || lastEvent !== globalContext.lastEventCache)) {
                        globalContext.lastEventCache = lastEvent;
                        publisher.publishEvent(lastEvent);
                    }
                }
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

        //we want to publish emtpy statues
        const { status, zones } = data ? data : {};

        //console.log(`New alarm status: ${status}`);
        //alarm
        publisher.publishStateIAlarm(status);

        //add zone names
        if (zones) {
            for (let zoneNumber = 0; zoneNumber < config.zones.length; zoneNumber++) {
                var zone = zones.find(z => z.id === zoneNumber);
                if (zone) {
                    const zoneConfig = config.zones[zoneNumber];
                    //normally open /normally closed (default closed)
                    if (zoneConfig["contactType"] === 'NO') {
                        //invert open/problem data
                        zone.open = !zone.open;
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

    function discovery(enabled) {
        //home assistant mqtt discovery (if not enabled it will reset all /config topics)
        publisher.publishHomeAssistantMqttDiscovery(Object.values(globalContext.zonesCache.zones), enabled);
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
            discovery(config.hadiscovery.enabled);

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