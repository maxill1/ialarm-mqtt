# ialarm-mqtt
A mqtt bridge to iAlarm (https://www.antifurtocasa365.it/) and other chinese 'TCP IP' alarm system like Meian and Emooluxr (via node-ialarm library). 

## features:
* arm home
* arm away
* disarm
* zone info (alarm, bypass, fault, low battery, signal loss)
* home assistant [mqtt-discovery](https://www.home-assistant.io/docs/mqtt/discovery/).

## running and config
edit config.json and adjust "mqtt" and "server" settings according to your need. Pay attention to "server.zones" number, by default the are 40 but you may want to reduce it to match your sensor number.

Optionally you can edit "hadiscovery" and topic structure (pincode, zone name prefix, icons, etc).

### running with nodejs
go to the folder containing the project, install the dependencies, edit your config.json and launch.

### dependencies
go to the folder containing the project and run:
```
npm install
```

### running with external config.json file
```
node ialarm-mqtt -c /path/to/my/config
```

### running with docker image
```
docker run --name ialarm-mqtt -v /path/to/my/config:/config maxill1/ialarm-mqtt:latest
```
