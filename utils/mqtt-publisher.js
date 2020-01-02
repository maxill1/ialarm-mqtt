const mqtt = require('mqtt');

module.exports = function(config) {

  var client  = undefined;

  var _publish = function(topic, data, options){
    if(client){
      console.log("sending topic '"+topic+"' : "+JSON.stringify(data));
      if(typeof data !== "string"){
        data = JSON.stringify(data);
      }
      client.publish(topic, data, options);
    }else{
      console.log(topic+ " - error publishing...not connected");
    }
  }

  this.connectAndSubscribe = function(alarmSetCallback){
    console.log("connection to MQTT broker: ", config.mqtt.host+":"+config.mqtt.port); 
    client  = mqtt.connect('mqtt://'+config.mqtt.host+":"+config.mqtt.port, {
      username: config.mqtt.username, 
      password: config.mqtt.password,
      will: { topic: config.topics.availability, payload: 'offline' }
    })
     
     client.on('connect', function () {

       client.subscribe(config.topics.alarmSet, function (err) {
         if (err) {
           console.log("Error subscribing" + err.toString())
         }
       });

       /*client.subscribe('homeassistant/alarm_control_panel/ialarm/config', function (err) {
         if (!err) {
           client.publish('presence', 'Hello mqtt')
         }
       })*/
     });
     
     client.on('message', function (topic, message) {
       console.log("received topic '"+topic+"' : ", message);
       if(topic === config.topics.alarmSet){
        var commandType = config.alarmSetValues[message];
        if(!commandType){
          commandType = message.toString();
          console.debug("Using MQTT message as command: " +commandType); 
        }
        
        console.log("Alarm set command: " +commandType + " ("+message+")"); 
        if(alarmSetCallback){
          alarmSetCallback(commandType);
        }
       }
     })

     client.on('error', function (err) {
       // message is Buffer
       console.log(err)
       client.end()
     })
  }

  this.publishStateSensor = function(zones){
      var m = {};
      m.topic = config.topics.sensorStatus;
      m.payload = zones;
      _publish(m.topic, m.payload);
  }

  this.publishStateIAlarm = function(status){
      var m = {};
      m.topic = config.topics.alarmStatus;
      m.payload = status.toLowerCase();
      _publish(m.topic, m.payload);
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