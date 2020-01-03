# ialarm-mqtt
A mqtt bridge to iAlarm (https://www.antifurtocasa365.it/) and other chinese 'TCP IP' alarm system like Meian and Emooluxr (via node-ialarm library). 

<a href="https://www.buymeacoffee.com/maxill1" target="_blank">
<img src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" alt="Buy Me A Coffee"></a>

## features:
* arm home
* arm away
* disarm
* zone info (alarm, bypass, fault, low battery, signal loss)
* home assistant [mqtt-discovery](https://www.home-assistant.io/docs/mqtt/discovery/).

## config
edit [config.json](config.json) and adjust "mqtt" and "server" settings according to your need. Pay attention to "server.zones" number, by default the are 40 but you may want to reduce it to match your sensor number.

Optionally you can edit "hadiscovery" and topic structure (pincode, zone name prefix, icons, etc) or remove the entire "hadiscovery" node to disable home assistant mqtt discovery.

### topics
```
    "topics" : {
        "availability": "homeassistant/alarm_control_panel/ialarm/availability", //Last will topic for online/offline
        "alarmState" : "homeassistant/alarm_control_panel/ialarm/state", //current alarm status
        "alarmCommand" : "homeassistant/alarm_control_panel/ialarm/set", //alarm set command
        "error" : "homeassistant/alarm_control_panel/ialarm/error", //errors
        "event" : "homeassistant/alarm_control_panel/ialarm/event" //last event string as recorded in the alarm log
        "sensorState": "homeassistant/binary_sensor/ialarm/state", //all zones sensor states
        "sensorSingleState": "homeassistant/binary_sensor/ialarm/${zoneId}", //single zone sensor for movement/alert detection (on or off)
        "sensorSingleActive": "homeassistant/binary_sensor/ialarm/${zoneId}/active", //single zone sensor representing the active (on) or bypass (off) state
        "sensorSingleLowBattery": "homeassistant/binary_sensor/ialarm/${zoneId}/battery",  //single zone sensor for low battery detection (on)
        "sensorSingleFault": "homeassistant/binary_sensor/ialarm/${zoneId}/fault"  //single zone sensor for fault detection (on)
    }
```

### payloads

Example with home assistant default payloads
```	
    "values": {
        "alarmAvailable" : "online", 
        "alarmNotvailable" : "offline",
		//decode alarmCommand received state (accepting multiple payloads)
        "alarmStateDecoder": {
            "armAway" : ["armAway", "armedAway", "armed_away", "arm_away", "AA", "AwayArm"],
            "armHome" : ["armHome", "armedHome", "armed_home", "arm_home", "SA", "HomeArm" ,"StayArm", "armStay", "armedStay", "arm_stay", "armed_stay"],
            "disarm" : ["disarm", "disarmed", "D"],
            "cancel" : ["cancel", "canceled", "C"],
            "trigger": [ "trigger",  "triggered", "T"]
        },
		//published payload in "alarmState" command (accepting multiple payloads)
        "alarmStates":{
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
    "values": {
        "alarmAvailable" : "online", 
        "alarmNotvailable" : "offline",
        "alarmStateDecoder": {
            "armAway" : ["AA", "AwayArm"],
            "armHome" : ["SA", "StayArm"],
            "disarm" : ["D"],
            "cancel" : ["cancel"], //not used by mqqtthing
            "trigger": ["T"]
        },
        "alarmStatesHomebridge":{
            "armAway" : "AA",
            "armHome" : "SA",
            "disarm" : "D",
            "cancel" : "cancel", //not used by mqqtthing
            "triggered": "T"
        }
    },

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

## running with docker image
```
docker run --name ialarm-mqtt -v /path/to/my/config:/config maxill1/ialarm-mqtt:latest
```
