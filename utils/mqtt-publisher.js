const mqtt = require('mqtt');

module.exports = function(config) {

  var client  = undefined;

  var _decodeStatus = function(status){
    var values = config.values.alarmStateDecoder;
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

  this.connectAndSubscribe = function(alarmCommandCallback){
    console.log("connection to MQTT broker: ", config.mqtt.host+":"+config.mqtt.port); 
    client  = mqtt.connect('mqtt://'+config.mqtt.host+":"+config.mqtt.port, {
      username: config.mqtt.username, 
      password: config.mqtt.password,
      will: { topic: config.topics.availability, payload: 'offline' }
    })
     
     client.on('connect', function () {

       client.subscribe(config.topics.alarmCommand, function (err) {
         if (err) {
           console.log("Error subscribing" + err.toString())
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
       if(topic === config.topics.alarmCommand){
        var ialarmCommand = _decodeStatus(command);
        console.log("Alarm command: " +ialarmCommand + " ("+command+")"); 
        if(alarmCommandCallback){
          alarmCommandCallback(ialarmCommand);
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
    //full data (sensors attrs)
    _publishAndLog(config.topics.sensorState, zones);

    //single sensors
    if (zones && zones.length > 0) {

      console.log("sending topic '"+config.topics.sensorSingleState+"' for "+zones.length + " zones");
      console.log("sending topic '"+config.topics.sensorSingleActive+"' for "+zones.length + " zones");
      console.log("sending topic '"+config.topics.sensorSingleLowBattery+"' for "+zones.length + " zones");
      console.log("sending topic '"+config.topics.sensorSingleFault+"' for "+zones.length + " zones");

      for (var i = 0; i < zones.length; i++) {
        var zone = zones[i];
        var pub = _publish;
        if(config.verbose){
          pub = _publishAndLog;
        }
        pub(config.topics.sensorSingleState.replace("${zoneId}", zone.id), zone.problem?config.values.sensorOn:config.values.sensorOff);
        pub(config.topics.sensorSingleActive.replace("${zoneId}", zone.id), zone.bypass?config.values.sensorOn:config.values.sensorOff);
        pub(config.topics.sensorSingleLowBattery.replace("${zoneId}", zone.id), zone.lowbat?config.values.sensorOn:config.values.sensorOff);
        pub(config.topics.sensorSingleFault.replace("${zoneId}", zone.id), zone.fault?config.values.sensorOn:config.values.sensorOff);
      }
    }
  }

  this.publishStateIAlarm = function(status){
      var m = {};
      m.topic = config.topics.alarmState;
      //decode status
      var alarmState = _decodeStatus(status);
      m.payload = (config.values.alarmStates && config.values.alarmStates[alarmState]) || status;
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
      m.topic = config.topics.event;
      m.payload = data;
      _publish(m.topic, m.payload);
  }

  this.publishHomeAssistantMqttDiscovery = function(zones, reset){
    //mqtt discovery messages to publish
    const iAlarmHaDiscovery = require('./mqtt-hadiscovery');
    var messages = new iAlarmHaDiscovery(config, zones, reset).createMessages();
    for (let index = 0; index < messages.length; index++) {
      const m = messages[index];
      _publish(m.topic, m.payload, {retain: true});
    }
  }

}