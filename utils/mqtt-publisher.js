const mqtt = require('mqtt');

module.exports = function(config) {

  var client  = undefined;

  var _decodeStatus = function(status){
    var values = config.payloads.alarmDecoder;
    if(values){
      for (const key in values) {
        if (values.hasOwnProperty(key)) {
          const item = values[key];
          if(Array.isArray(item)){
            for (let index = 0; index < item.length; index++) {
              const element = item[index];
              if(element.toLowerCase() === status.toLowerCase()){
                return key;
              }
            }
          }else{
            if(item.toLowerCase() === status.toLowerCase()){
              return key;
            }
          }
        }
      }
    }
    return status;
  }

  var _publishAndLog = function(topic, data, options){
    var dataLog;
    if(data){
      if(config.verbose){
        dataLog = JSON.stringify(data);
      }else if(typeof data === 'string'){
        dataLog = data;
      }else if(Array.isArray(data)){
        dataLog = "Array of "+ data.length+ " elements";
      }else{
        dataLog = "Object with "+ Object.keys(data).length+ " keys";
      }
    }
    console.log("sending topic '"+topic+"' : "+dataLog);
    _publish(topic, data, options);
  }
  var _publish = function(topic, data, options){
    if(client){
      if(typeof data !== "string"){
        data = JSON.stringify(data);
      }
      client.publish(topic, data, options);
    }else{
      console.log(topic+ " - error publishing...not connected");
    }
  }

  this.connectAndSubscribe = function(alarmCommands){

    var clientId = config.mqtt.clientId || "ialarm-mqtt-"+Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    console.log("connection to MQTT broker: ", config.mqtt.host+":"+config.mqtt.port); 
    client  = mqtt.connect('mqtt://'+config.mqtt.host+":"+config.mqtt.port, {
      username: config.mqtt.username, 
      password: config.mqtt.password,
      clientId : clientId,
      will: { topic: config.topics.availability, payload: 'offline' }
    })
     
     client.on('connect', function () {
      console.log("connected..."); 
      var topicsToSubscribe = [config.topics.alarm.command, config.topics.alarm.bypass.replace("${zoneId}", "+")];
      console.log("subscribing to "+JSON.stringify(topicsToSubscribe)); 
      client.subscribe(topicsToSubscribe, function(err) {
        if (err) {
          console.log("Error subscribing" + err.toString());
        }
      });
     });
     
     client.on('message', function (topic, message) {
      var command;
       try {
         command = message.toString();
       } catch (error) {
         command = message;
       }
       console.log("received topic '"+topic+"' : ", command);
       if(topic === config.topics.alarm.command){
        var ialarmCommand = _decodeStatus(command);
        console.log("Alarm command: " +ialarmCommand + " ("+command+")"); 
        if(alarmCommands.command){
          alarmCommands.command(ialarmCommand);
        }
      }

      //bypass topic
      //var topicRegex = new RegExp(/ialarm\/alarm\/zone\/(\d{1,2})\/bypass/gm);
      //"ialarm\/alarm\/zone\/(\\d{1,2})\/bypass"
      var strRegex = config.topics.alarm.bypass.replace("/", "\/").replace("${zoneId}", "(\\d{1,2})"); //.replace("+", "(\\d{1,2})")
      var topicRegex = new RegExp(strRegex, "gm");
      var match = topicRegex.exec(topic);
      if(match){
        var zoneNumber = match[1];

        var accepted = ["1", "0", "true", "false", "on", "off"];
        var knownCommand = false;
        for (let index = 0; index < accepted.length; index++) {
          const cmd = accepted[index];
          if(cmd === command.toLowerCase()){
            knownCommand = true;
            break;
          }
        }
        if(!knownCommand){
          console.log("Alarm bypass zone "+zoneNumber + " ignored invalid command: "+command); 
          return;
        }
        var bypass = command === "1" || command.toLowerCase() === "true" || command.toLowerCase() === "on";
        if(bypass){
          console.log("Alarm bypass zone "+zoneNumber); 
        }else{
          console.log("Alarm bypass removed from zone "+zoneNumber); 
        }
        if(alarmCommands.bypassZone){
          alarmCommands.bypassZone(zoneNumber, bypass);
        }
      }
     })

     client.on('error', function (err) {
       // message is Buffer
       console.log(err)
       client.end()
     })
  }

  this.publishStateSensor = function (zones) {

    if(!config.topics.sensors){
      //don't publish sensors
      console.log("config.json has no 'config.topics.sensors' configured. Skipping.");
      return;
    }

    var configuredZones = config.server.zones || zones.length || 40;

    //one payload with all sensors data (sensors attrs)
    if(!config.topics.sensors.topicType || config.topics.sensors.topicType === 'state'){
      _publishAndLog(config.topics.sensors.state, zones.slice(0, configuredZones));
    }
    //multiple payload with single sensor data
    if (zones && zones.length > 0 && (!config.topics.sensors.topicType || config.topics.sensors.topicType === 'zone')) {

      console.log("sending topic '"+config.topics.sensors.zone.alarm+"' for "+configuredZones + " zones");
      console.log("sending topic '"+config.topics.sensors.zone.active+"' for "+configuredZones + " zones");
      console.log("sending topic '"+config.topics.sensors.zone.lowBattery+"' for "+configuredZones + " zones");
      console.log("sending topic '"+config.topics.sensors.zone.fault+"' for "+configuredZones + " zones");

      for (var i = 0; i < configuredZones; i++) {
        var zone = zones[i];
        var pub = _publish;
        if(config.verbose){
          pub = _publishAndLog;
        }
        pub(config.topics.sensors.zone.alarm.replace("${zoneId}", zone.id), zone.alarm?config.payloads.sensorOn:config.payloads.sensorOff);
        pub(config.topics.sensors.zone.active.replace("${zoneId}", zone.id), zone.bypass?config.payloads.sensorOn:config.payloads.sensorOff);
        pub(config.topics.sensors.zone.lowBattery.replace("${zoneId}", zone.id), zone.lowbat?config.payloads.sensorOn:config.payloads.sensorOff);
        pub(config.topics.sensors.zone.fault.replace("${zoneId}", zone.id), zone.fault?config.payloads.sensorOn:config.payloads.sensorOff);
      }
    }
  }

  this.publishStateIAlarm = function(status){
      var m = {};
      m.topic = config.topics.alarm.state;
      //decode status
      var alarmState = _decodeStatus(status);
      m.payload = (config.payloads.alarm && config.payloads.alarm[alarmState]) || status;
      _publishAndLog(m.topic, m.payload);
  }

  this.publishAvailable = function(){
      var m = {};
      m.topic = config.topics.availability;
      m.payload = "online";
      _publish(m.topic, m.payload);
  }

  this.publishError = function(error){
      var m = {};
      m.topic = config.topics.error;
      m.payload = error;
      _publish(m.topic, m.payload);
  }

  this.publishEvent = function(data){
      var m = {};
      m.topic = config.topics.alarm.event;
      m.payload = data;
      _publish(m.topic, m.payload);
  }

  this.publishHomeAssistantMqttDiscovery = function(zones, reset){
    //mqtt discovery messages to publish
    const iAlarmHaDiscovery = require('./mqtt-hadiscovery');
    var messages = new iAlarmHaDiscovery(config, zones, reset).createMessages();
    for (let index = 0; index < messages.length; index++) {
      const m = messages[index];
      _publish(m.topic, "");//reset
      _publish(m.topic, m.payload, {retain: true});//config
    }
  }

}