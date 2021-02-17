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

## Installation
via npx, npm install -g or docker
https://github.com/maxill1/ialarm-mqtt/wiki/Installation

## Configuration
edit [config.json](config.json) and adjust "mqtt" and "server" settings according to your need:
https://github.com/maxill1/ialarm-mqtt/wiki/Configuration

## Home assistant integration
Go here for some info and example.
https://github.com/maxill1/ialarm-mqtt/wiki/Home-Assistant-Integration
