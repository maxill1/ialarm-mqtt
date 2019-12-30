var fs = require('fs');

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

var configFile = './config.json';
var configPath = "./";
if (cmdArgs['-c']) {
    configPath = cmdArgs['-c']+"/";
    console.log("Found external config.json", configPath);
    configFile = configPath + 'config.json'
}

var config;
try {
    config = require(configFile)
} catch (error) {
    console.log("Fallback to default config.json");
    configFile = './config.json';
    config = require(configFile)
}

console.log("Config:", config);

module.exports = config;