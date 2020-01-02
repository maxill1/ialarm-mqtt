var mqtt = require('mqtt');
const iAlarm = require("ialarm");
const config = require('./mqtt-ialarm-config');
const publisher = new (require('./mqtt-ialarm-publisher'));

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

        //home assistant mqtt discovery
        publisher.publishHomeAssistantMqttDiscovery(Object.values(globalContext.zonesCache.zones));
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

            //add zone names
            if(status.zones){
                for (var i = 0; i < status.zones.length; i++) {
                    var zone = status.zones[i];
                    var zoneCache = getZoneCache(zone.id);
                    if(zoneCache){
                    zone.name = zoneCache.name;
                    zone.type = zoneCache.type;
                    }
                }
            }
            //output
            //uno stato per tutti i sensori
            publisher.publishStateSensor(status.zones);

            // stato antifurto
            publisher.publishStateIAlarm(status.status);

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
                lastEvent =  "recent events:" + ev.date + " "+ev.message+" (zone "+description +")";
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

function commandHandler(commandType){

    var commandName = config.alarmStatus[commandType];
    if(!commandName){
      console.error("Received invalid alarm command: "+commandType);
      return;
    }

    console.log("Received alarm command: "+commandType)
    const alarm = newIAlarm();
    alarm.on("command", function (status) {
      console.log("new alarm status: "+status.status);
      //notify status and last event
      publisher.publishStateSensor(status.zones);
      publisher.publishStateIAlarm(status.status);

      setTimeout(function(){
        //readStatus();
        readEvents();
      }, 500);
    });
    alarm.on("response", function (response) {
      //console.log("Responded: "+response);
    });
    alarm.on("error", function (err) {
      console.error(err);
    });

    alarm[commandName]();
}


//start loop
function start(){
    console.log("Starting up...");

    console.log("Status polling every ", config.server.polling.status, " ms"); 
    console.log("Events polling every ", config.server.polling.events, " ms"); 

    //load zone names
    initZoneCache();

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