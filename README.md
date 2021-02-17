# ialarm-mqtt
A mqtt bridge to iAlarm (https://www.antifurtocasa365.it/) and other chinese 'TCP IP' alarm system like Meian and Emooluxr (via node-ialarm library). 

<a href="https://www.buymeacoffee.com/maxill1" target="_blank">
<img src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" alt="Buy Me A Coffee"></a>

## features:
* arm home
* arm away
* disarm
* zone info (ok/problem, open, alarm, bypass, fault, low battery, signal loss) - NOTE: in order to obtain 'open' property in real time you must enable "DoorDetect" ("Ispezione sensori porta" on italian guard ip panel) in your alarm web panel options (http://192.168.1.x/Option.htm)
* home assistant [mqtt-discovery](https://www.home-assistant.io/docs/mqtt/discovery/)

## Home assistant integration
Go here for some info and example.
https://github.com/maxill1/ialarm-mqtt/wiki/Home-Assistant-Integration

## config
edit [config.json](config.json) and adjust "mqtt" and "server" settings according to your need. 

### servers
```
"server" : {
        "host": "192.168.1.x", //alarm web panel ip
        "port": "80", //alarm web panel port
        "username": "admin", //alarm web panel username
        "password": "password", //alarm web panel password
        "zones": 40, //number of zones to publish/handle. Can be a number (40 means all from 1 to 40) or an array of included zones [1,2,3,4,5,6,15,19,22]
        "polling" : {
            "status" : 30000,
            "events" : 10000
        }
    },
    "mqtt" : {
        "host": "192.168.1.x", //mqtt server ip
        "port": "1883", //mqtt server port
        "username": "admin", //mqtt server username
        "password": "password", //mqtt server password
        "clientId": "ialarm-mqtt" //mqtt client id (unique: if already exists mqtt server will disconnect the first. To autogenerate a random client id remove the 'clientId' property)
    },
```

### topics
```
    "topics" : {
        "availability": "ialarm/alarm/availability", //Last will topic for online/offline
        "error" : "ialarm/alarm/error", //errors
        "alarm" : {
            "state" : "ialarm/alarm/state", //current alarm status
            "command" : "ialarm/alarm/set", //alarm set command
            "event" : "ialarm/alarm/event", //last event string as recorded in the alarm log,
            "discovery" : "ialarm/alarm/discovery", //false=disable discovery (empty /config topics for all entities), true=enable discovery (send new /config topics for all entities)
            "resetCache" : "ialarm/alarm/resetCache", //with empty or any payload (reset the cache and send fresh sensor and alarm data)
            "bypass": "ialarm/alarm/zone/${zoneId}/bypass" //command to bypass/restore a zone
        },
        "sensors" : {
            "topicType" : "state", //'state' for publishing only "state" topic, 'zone' for publishing only "zone" topics (alarm, active, lowBattery and fault), '' (or undefined) for both types 
            "state": "ialarm/sensors/state", //array containing all zones data in one payload
            "zone": {
                "alarm": "ialarm/sensors/${zoneId}/alarm", //single zone sensor for movement/alert detection (on or off)
                "active": "ialarm/sensors/${zoneId}/active", //single zone sensor representing the active (on) or bypass (off) state
                "lowBattery": "ialarm/sensors/${zoneId}/battery", //single zone sensor for low battery detection (on)
                "fault": "ialarm/sensors/${zoneId}/fault" //single zone sensor for fault detection (on)
            }
        }
    }

```

### payloads

Example with home assistant default payloads
```	
    "payloads": {
        "alarmAvailable" : "online", 
        "alarmNotvailable" : "offline",
		//decode alarmCommand received state (accepting multiple payloads)
        "alarmDecoder": {
            "armAway" : ["armAway", "armedAway", "armed_away", "arm_away", "AA", "AwayArm"],
            "armHome" : ["armHome", "armedHome", "armed_home", "arm_home", "SA", "HomeArm" ,"StayArm", "armStay", "armedStay", "arm_stay", "armed_stay"],
            "disarm" : ["disarm", "disarmed", "D"],
            "cancel" : ["cancel", "canceled", "C"],
            "trigger": [ "trigger",  "triggered", "T"]
        },
		//published payload in "alarmState" command (accepting multiple payloads)
        "alarm":{
            "armAway" : "armed_away",
            "armHome" : "armed_home",
            "disarm" : "disarmed",
            "cancel" : "cancel",
            "triggered": "triggered"
        },
        "sensorOn" : "1", //binary sensor on value
        "sensorOff" : "0" //binary sensor off value
    },

```

Example with mqttthing (homebridge) default payloads
```	
    "payloads": {
        "alarmAvailable" : "online", 
        "alarmNotvailable" : "offline",
        "alarmDecoder": {
            "armAway" : ["AA", "AwayArm"],
            "armHome" : ["SA", "StayArm"],
            "disarm" : ["D"],
            "cancel" : ["cancel"], //not used by mqqtthing
            "trigger": ["T"]
        },
        "alarm":{
            "armAway" : "AA",
            "armHome" : "SA",
            "disarm" : "D",
            "cancel" : "cancel", //not used by mqqtthing
            "triggered": "T"
        }
    },

```

### specific zone config

Most of the sensors are normally closed but some water leak works as normally open contact, so to correcly report them to home assistant the sensor can configured as "contactType" : "NO" and "statusProperty" : "open" (normally we check "problem" which is related to the status code != 0 and in this case is 16)To report the sensor as a different kind (smoke, gas, door, moisture, etc) just change "device_class" to [one of those supported by Home Assistant](https://www.home-assistant.io/integrations/binary_sensor/#device-class).
```	
     "zones": {
        "39": {
            "contactType": "NO",
            "device_class": "moisture",
            "statusProperty": "open"
        }
    }

```

## running with docker image
```
docker run --name ialarm-mqtt --restart always -v /path/to/my/config:/config maxill1/ialarm-mqtt:latest
```

or using docker-compose:
```
version: '3.3'
services:
  ialarm:
    image: maxill1/ialarm-mqtt:latest
    container_name: ialarm-mqtt
    volumes:
        - /path/to/my/config:/config
    restart: always
```

for testing version:
```
docker run --name ialarm-mqtt --restart always -v /path/to/my/config:/config maxill1/ialarm-mqtt:dev
```
or using docker-compose:
```
version: '3.3'
services:
  ialarm:
    image: maxill1/ialarm-mqtt:dev
    container_name: ialarm-mqtt
    volumes:
        - /path/to/my/config:/config
    restart: always
```

## running with nodejs

```
npx ialarm-mqtt

```
or 

```
npm install -g ialarm-mqtt 
ialarm-mqtt -c /path/to/my/config
```
