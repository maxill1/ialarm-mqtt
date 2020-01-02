#!/usr/bin/env node

const ialarmMqtt = require('../');
try {

    var parseArgs = function (key, cmdArgs) {
        var data = {};
        try {
    
            var cmdArgs = process.argv.slice(2);
            if (cmdArgs && cmdArgs.length > 0) {
                for (let index = 0; index < cmdArgs.length; index++) {
                    const item = cmdArgs[index];
                    if (item === '-w' || item === '-d' || item === '-p' || item === '-t' || item === '-c') {
                        data[item] = cmdArgs[index + 1];
                        console.error("Found arg " + item + " with value " + data[item]);
                    }
                }
            }
        } catch (error) {
            console.error("Error parsing arguments: ", error);
        }
        return data;
    }
    
    var cmdArgs = parseArgs();
    
    if (!cmdArgs['-c']) {
        console.log("please provide the path of the folder containing config.json: ", "ialarm-mqtt -c /path");
        process.exit(1);
    }

    var configPath = cmdArgs['-c']+"/";
    console.log("Found external config.json", configPath);
    configFile = configPath + 'config.json'
    var config = require(configFile);
    
    if (config) {
        ialarmMqtt(config)
    } else {
        console.error('file config.json does not exist')
        process.exit(1)
    }
} catch (e) {
    console.error('error loading config.json', e)
    process.exit(1)
}