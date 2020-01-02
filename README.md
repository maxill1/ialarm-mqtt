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

## running and config
edit [config.json](config.json) and adjust "mqtt" and "server" settings according to your need. Pay attention to "server.zones" number, by default the are 40 but you may want to reduce it to match your sensor number.

Optionally you can edit "hadiscovery" and topic structure (pincode, zone name prefix, icons, etc) or remove the entire "hadiscovery" node to disable home assistant mqtt discovery.

### running with nodejs

```
npx ialarm-mqtt

```
or 

```
npm install -g ialarm-mqtt 
ialarm-mqtt -c /path/to/my/config
```

### running with docker image
```
docker run --name ialarm-mqtt -v /path/to/my/config:/config maxill1/ialarm-mqtt:latest
```
