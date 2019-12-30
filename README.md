# ialarm-mqtt
this is a mqtt bridge to iAlarm (node-ialarm). It support home assistant mqtt-discovery.

## running with nodejs
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
