#!/usr/bin/env node
import { ialarmMqtt } from '../index.js'
import { configHandler } from '../utils/config-handler.js'

try {
  const parseArgs = function (cmdArgs) {
    const data = {}
    try {
      if (cmdArgs && cmdArgs.length > 0) {
        for (let index = 0; index < cmdArgs.length; index++) {
          const item = cmdArgs[index]
          if (item === '-w' || item === '-d' || item === '-p' || item === '-t' || item === '-c' || item === '--hassos') {
            data[item] = cmdArgs[index + 1]
            console.error('Found arg ' + item + ' with value ' + data[item])
          }
        }
      }
    } catch (error) {
      console.error('Error parsing arguments: ', error)
    }
    return data
  }

  const cmdArgs = parseArgs(process.argv.slice(2))

  if (!cmdArgs['--hassos'] && !cmdArgs['-c']) {
    console.log('please provide the path of the folder containing configuration file: ', 'ialarm-mqtt -c /path')
    process.exit(1)
  }

  const config = cmdArgs['--hassos'] ? configHandler.readHassOsOptions(cmdArgs['--hassos']) : configHandler.readConfigFile(cmdArgs['-c'])

  if (config) {
    ialarmMqtt(config)
  } else {
    console.error('configuration file is empty')
    process.exit(1)
  }
} catch (e) {
  console.error('error loading configuration file', e)
  process.exit(1)
}
