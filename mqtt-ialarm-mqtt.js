const config = require('./mqtt-ialarm-config');
const mqtt = require('mqtt');

function ialarmPublisher(){
    var client  = undefined;
    var disabled = true; //TODO

    var _publish = function(topic, data){
      if(client && !disabled){
        console.log("sending topic: ", topic, data); 
        client.publish(topic, data);
      }else{
        console.log(topic+ " - error publishing...not connected");
      }
    }

    this.connectAndSubscribe = function(){
      console.log("connection to MQTT broker: ", config.mqtt.host+":"+config.mqtt.port); 
      client  = mqtt.connect('mqtt://'+config.mqtt.host+":"+config.mqtt.port, {username: config.mqtt.username, password: config.mqtt.password})
       
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
 
         if(topic === config.topics.alarmSet){
           //TODO
           console.log("Received alarm set")
         }
 
         // message is Buffer
         console.log(topic, message.toString())
 
         client.end()
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


}

module.exports = ialarmPublisher;