const iAlarm = require("ialarm");
const iAlarmPublisher = require('./utils/mqtt-publisher');

module.exports = (config) => {

    if(!config){
        console.error('Please provide a valid config.json');
        process.exit(1);
    }

    const publisher = new iAlarmPublisher(config);

    var globalContext = {};

    function newIAlarm(){
        console.debug("Creating new iAlarm connection")
        return new iAlarm(config.server.host, config.server.port,
                            config.server.username, config.server.password,
                            config.server.zones);
    }

    function handleError(e){
        let error = e;
        if(e.message){
            error = e.message;
        }
        let msg = "error " +error;
        console.log(msg);
        console.log(e);
        publisher.publishError(msg);
    }

    function getZoneCache(id){
        if(globalContext.zonesCache &&
        globalContext.zonesCache.zones &&
        globalContext.zonesCache.zones[id]){
        return globalContext.zonesCache.zones[id];
        }
        return undefined;
    };

    function initZoneCache(){
        
        console.log("Loading zone cache...");

        var host = config.server.host;
        var port = config.server.port;
        var username = config.server.username;
        var password = config.server.password;

        if (!host || !port || !username || !password) {
            throw 'Missing required configuration'
        }

        const alarm = newIAlarm();
        alarm.on("error", function (err) {
            console.log("error: "+err);
            publisher.publishError(err);
        });

        alarm.on('allZones', function (zones) {
            var info = "got "+Object.keys(zones).length+" zones info";
            console.log(info);
            globalContext.zonesCache.zones = zones;
            globalContext.zonesCache.caching = false;

            //home assistant mqtt discovery (if present)
            if(config.hadiscovery){
                publisher.publishHomeAssistantMqttDiscovery(Object.values(globalContext.zonesCache.zones));
            }
        });

        alarm.on('zoneInfo', function (zoneInfo) {
            console.log("zoneInfo: "+JSON.stringify(zoneInfo));
        });

        if(!globalContext.zonesCache){
            globalContext.zonesCache = {};
        }
        if(!globalContext.zonesCache.zones  && !globalContext.zonesCache.caching){
            globalContext.zonesCache.zones = {};
            globalContext.zonesCache.caching = true;
            alarm.getAllZones();
        }
    }

    function readStatus(){

        try {
            const alarm = newIAlarm();

            alarm.on("response", function (response) {
                //console.log("Responded: "+response);
            });
            alarm.on("error", function (err) {
                publisher.publishError(err);
            });

            alarm.on("status", function (status) {
                //console.debug("status: "+JSON.stringify(status));

                //alarm state
                publisher.publishStateIAlarm(status.status);

                var lastChecked = new Date();
                //add zone names
                if(status.zones){
                    for (var i = 0; i < status.zones.length; i++) {
                        var zone = status.zones[i];
                        var zoneCache = getZoneCache(zone.id);
                        if(zoneCache){
                            zone.name = zoneCache.name;
                            zone.type = zoneCache.type;
                        }
                        //state decode
                        zone.problem = zone.message && zone.message !== 'OK';
                        zone.alarm = zone.message && zone.message === 'zone alarm';
                        zone.bypass = zone.message && zone.message === 'zone bypass';
                        zone.lowbat = zone.message && zone.message === 'wireless detector low battery' || zone.message && zone.message === 'wireless detector loss';
                        zone.fault = zone.message && zone.message === 'zone fault';     
                        zone.lastChecked = lastChecked;                 
                    }
                }
                //sensor states
                publisher.publishStateSensor(status.zones);
            });

            if(config.server.waitnames && (!globalContext.zonesCache || globalContext.zonesCache.caching)){
                console.log("loading "+serverconfig.server.zones+" zones cache...");
            }else{
                console.log("checking iAlarm status...");
                alarm.getStatus();
            }

        } catch (e) {
        handleError(e);
        }
    }

    function readEvents(){

        try {

            const alarm = newIAlarm();

            alarm.on("response", function (response) {
                //console.log("Responded: "+response);
            });
            alarm.on("error", function (err) {
                publisher.publishError(err);
            });

            alarm.on("events", function (events) {
                let lastEvent = "No events";
                if(events.length>0){

                    for (var i = 0; i < events.length; i++) {
                        var zoneCache = getZoneCache(events[i].zone);
                        if(zoneCache){
                        events[i].name = zoneCache.name;
                        events[i].type = zoneCache.type;
                        }
                    }

                    let ev = events[0];
                    var description = ev.zone;
                    if(ev.name){
                        description = description+ " "+ ev.name;
                    }
                    lastEvent =  ev.date + " "+ev.message+" (zone "+description +")";
                    //publish only if changed or empty
                    if(lastEvent && (!globalContext.lastEventCache || lastEvent!==globalContext.lastEventCache)){
                        globalContext.lastEventCache = lastEvent;
                        publisher.publishEvent(lastEvent);
                    }
                }
            });

            alarm.getEvents();

        } catch (e) {
            handleError(e);
        }
    }

    function armDisarm(commandType){

        if(!commandType){
            console.error("Received invalid alarm command: "+commandType);
            return;
        }

        console.log("Received alarm command: "+commandType)
        const alarm = newIAlarm();
        alarm.on("command", function (status) {
            console.log("new alarm status: "+status.status);
            //alarm
            publisher.publishStateIAlarm(status.status);
            //notify last event
            setTimeout(function(){
                readEvents();
            }, 500);
            //and sensors
            publisher.publishStateSensor(status.zones);
            
 
        });
        alarm.on("response", function (response) {
        //console.log("Responded: "+response);
        });
        alarm.on("error", function (err) {
            console.error(err);
        });

        if(config.debug){
           console.log("DEBUG MODE: IGNORING SET COMMAND RECEIVED for alarm."+ commandType + "()");
           console.log("DEBUG MODE: FAKING SET COMMAND RECEIVED for alarm."+ commandType + "()");
           publisher.publishStateIAlarm(commandType);
           return;
        }
        alarm[commandType]();
    }

    function bypassZone(zoneNumber, bypass){

        if(!zoneNumber || zoneNumber>40){
            console.error("bypassZone: received invalid zone number: "+zoneNumber);
            return;
        }

        if(!bypass){
            bypass = false;
        }

        console.log("Received bypass "+bypass+" for zone number "+zoneNumber)
        const alarm = newIAlarm();
        alarm.on("command", function (status) {
            console.log("new alarm status: "+status.status);
            //alarm
            publisher.publishStateIAlarm(status.status);
            //notify last event
            setTimeout(function(){
                readEvents();
            }, 500);
            //and sensors
            publisher.publishStateSensor(status.zones);
        });
        alarm.on("response", function (response) {
        //console.log("Responded: "+response);
        });
        alarm.on("error", function (err) {
            console.error(err);
        });

        alarm.bypassZone(zoneNumber, bypass);
    }


    //start loop
    function start(){
        console.log("Starting up...");

        console.log("Status polling every ", config.server.polling.status, " ms"); 
        console.log("Events polling every ", config.server.polling.events, " ms"); 

        //load zone names
        initZoneCache();

        var commandHandler = {};
        commandHandler.armDisarm = armDisarm;
        commandHandler.bypassZone = bypassZone;

        publisher.connectAndSubscribe(commandHandler);

        //alarm and sensor status
        setInterval(function(){
            publisher.publishAvailable();

            readStatus();
        }, config.server.polling.status);

        //event messages
        setInterval(function(){
            readEvents();
        }, config.server.polling.events);

    }

    start();
}