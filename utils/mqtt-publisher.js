const mqtt = require('mqtt')
const configHandler = require('./config-handler')

module.exports = function (config) {
  const logger = require('ialarm/src/logger')(config.verbose ? 'debug' : 'info')

  let client

  const _cache = {
    data: {},
    enabled: config.mqtt.cache !== undefined,
    time: (function () {
      const expr = config.mqtt.cache
      if (expr) {
        let molt = 0

        if (expr.endsWith('s')) {
          molt = 1000
        } else if (expr.endsWith('m')) {
          molt = 60000
        } else if (expr.endsWith('h')) {
          molt = 60000 * 60
        } else if (expr.endsWith('d')) {
          molt = 60000 * 60 * 24
        } else {
          logger.info('Using default cache: 5m')
          // default 5 min
          return 5 * 60000
        }
        return expr.substring(0, expr.length - 1) * molt
      }
      return 0
    }())
  }

  const _resetCache = function (topic) {
    if (topic) {
      _cache.data[topic]
    } else {
      _cache.data = {}
    }
  }

  this.resetCache = _resetCache

  const _decodeStatus = function (status) {
    try {
      const currentStatus = status.toLowerCase()
      const values = config.payloads.alarmDecoder
      if (values && currentStatus) {
        for (const key in values) {
          if (values.hasOwnProperty(key)) {
            const item = values[key]
            if (Array.isArray(item)) {
              for (let index = 0; index < item.length; index++) {
                const element = item[index]
                if (element.toLowerCase() === currentStatus) {
                  return key
                }
              }
            } else {
              if (item.toLowerCase() === currentStatus) {
                return key
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('error')
    }
    return status
  }

  const _publishAndLog = function (topic, data, options) {
    let dataLog
    if (data) {
      if (config.verbose) {
        dataLog = JSON.stringify(data)
      } else if (typeof data === 'string') {
        dataLog = data
      } else if (Array.isArray(data)) {
        dataLog = 'Array of ' + data.length + ' elements'
      } else {
        dataLog = 'Object with ' + Object.keys(data).length + ' keys'
      }
    } else {
      dataLog = data
    }
    if (_publish(topic, data, options)) {
      logger.info("sending topic '" + topic + "' : " + dataLog)
    }
  }

  const _cacheExpireDate = function (date) {
    return new Date(date.getTime() + _cache.time)
  }

  const _sameData = function (topic, obj2) {
    // cache empty
    if (!_cache.enabled || !_cache.data[topic] || !_cache.data[topic].lastChecked ||
            // cache expired
            new Date() > _cacheExpireDate(_cache.data[topic].lastChecked) ||
            // HA config topic
            topic.endsWith('/config')) {
      // needs republishing
      return false
    }

    // deep check
    const obj1 = _cache.data[topic].payload
    return _sameObject(obj1, obj2)
  }

  const _sameObject = function (obj1, obj2) {
    if (Object.keys(obj1).length != Object.keys(obj2).length) {
      return false
    }
    for (const key in obj1) {
      // ignoring lastChecked
      if (key === 'lastChecked') {
        continue
      }
      if (obj1.hasOwnProperty(key)) {
        const value1 = obj1[key]
        const value2 = obj2[key]
        if (typeof value1 !== typeof value2) {
          return false
        }
        if (typeof value1 === 'object') {
          // checking childs
          if (!_sameObject(value1, value2)) {
            return false
          }
          // next
        } else if (value1 !== value2) {
          return false
        }
      }
    }
    // assuming it's the same object
    return true
  }

  const _publish = function (topic, data, options) {
    if (_sameData(topic, data)) {
      return false
    }

    if (client) {
      options = options || {}
      options.retain = config.mqtt.retain || false

      let payload = data
      if (typeof data !== 'string') {
        payload = JSON.stringify(data)
      }
      client.publish(topic, payload, options)
      // cache the original data, ignoring config
      if (!topic.endsWith('/config')) {
        _cache.data[topic] = { payload: data, lastChecked: (data && data.lastChecked) || new Date() }
        logger.info('Caching ' + topic + ' until ' + _cacheExpireDate(_cache.data[topic].lastChecked))
      }
      return true
    } else {
      logger.error(topic + ' - error publishing...not connected')
      return false
    }
  }

  this.connectAndSubscribe = function (alarmCommands, onConnected, onDisconnected) {
    const clientId = config.mqtt.clientId || 'ialarm-mqtt-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    logger.info(`MQTT connecting to broker ${config.mqtt.host}:${config.mqtt.port} with cliendId ${clientId}`)
    client = mqtt.connect('mqtt://' + config.mqtt.host + ':' + config.mqtt.port, {
      username: config.mqtt.username,
      password: config.mqtt.password,
      clientId: clientId,
      will: { topic: config.topics.availability, payload: 'offline' }
    })

    client.on('connect', function () {
      logger.info(`MQTT connected to broker ${config.mqtt.host}:${config.mqtt.port} with cliendId ${clientId}`)
      const topicsToSubscribe = [
        config.topics.alarm.discovery,
        config.topics.alarm.resetCache
      ]
      // arm/disarm/cancel
      if (configHandler.isFeatureEnabled(config, 'armDisarm')) {
        topicsToSubscribe.push(config.topics.alarm.command.replace('${areaId}', '+'))
      }
      // bypass
      if (configHandler.isFeatureEnabled(config, 'bypass')) {
        topicsToSubscribe.push(config.topics.alarm.bypass.replace('${zoneId}', '+'))
      }

      if (topicsToSubscribe.length > 0) {
        logger.info(`subscribing to ${JSON.stringify(topicsToSubscribe)}`)
        client.subscribe(topicsToSubscribe, function (err) {
          if (err) {
            logger.error('Error subscribing' + err.toString())
          }
          _resetCache()
        })
      } else {
        logger.info('No topic to subscribe to')
      }

      onConnected()
    })

    client.on('message', function (topic, message) {
      let command
      try {
        command = message.toString()
      } catch (error) {
        command = message
      }
      logger.info("received topic '" + topic + "' : ", command)

      if (topic === config.topics.alarm.discovery) { // any payload
        logger.info('Requested new HA discovery...')
        if (alarmCommands.discovery && command) {
          const on = command && (command.toLowerCase() === 'on' || command === 1 || command == 'true')
          alarmCommands.discovery(on)
        }
        _publish(config.topics.alarm.configStatus, {
          cacheClear: 'OFF',
          discoveryClear: 'OFF',
          cancel: 'OFF'
        })
      } else if (topic === config.topics.alarm.resetCache) { // any payload
        if (alarmCommands.resetCache) {
          alarmCommands.resetCache()
        }
        _publish(config.topics.alarm.configStatus, {
          cacheClear: 'OFF',
          discoveryClear: 'OFF',
          cancel: 'OFF'
        })
      } else {
        // arm/disarm topic
        const armRegex = new RegExp(config.topics.alarm.command
          .replace('/', '/')
          .replace('${areaId}', '(\\d{1,2})'), 'gm')
        const armMatch = armRegex.exec(topic)
        if (armMatch) {
          const numArea = armMatch[1]
          logger.info('Alarm arm/disarm/cancel: area ' + numArea + ' (' + command + ')')
          const ialarmCommand = _decodeStatus(command)
          if (alarmCommands.armDisarm) {
            alarmCommands.armDisarm(ialarmCommand, numArea)
            logger.info('Executed: ' + ialarmCommand + ' (' + command + ')')
            return
          }
        }

        // bypass topic
        // "ialarm\/alarm\/zone\/(\\d{1,2})\/bypass"
        const topicRegex = new RegExp(config.topics.alarm.bypass
          .replace('/', '/')
          .replace('${zoneId}', '(\\d{1,2})'), 'gm')
        const match = topicRegex.exec(topic)
        if (match) {
          const zoneNumber = match[1]
          logger.info('Alarm bypass: zone ' + zoneNumber + ' (' + command + ')')

          const accepted = ['1', '0', 'true', 'false', 'on', 'off']
          let knownCommand = false
          for (let index = 0; index < accepted.length; index++) {
            const cmd = accepted[index]
            if (cmd === command.toLowerCase()) {
              knownCommand = true
              break
            }
          }
          if (!knownCommand) {
            logger.error(
              'Alarm bypass zone ' +
                            zoneNumber +
                            ' ignored invalid command: ' +
                            command
            )
            return
          }
          const bypass =
                        command === '1' ||
                        command.toLowerCase() === 'true' ||
                        command.toLowerCase() === 'on'
          if (bypass) {
            logger.info('Alarm bypass zone ' + zoneNumber)
          } else {
            logger.info('Alarm bypass removed from zone ' + zoneNumber)
          }
          if (alarmCommands.bypassZone) {
            alarmCommands.bypassZone(zoneNumber, bypass)
          }
        }
      }
    })

    client.on('error', function (err) {
      logger.error(`Error connecting to MQTT broker: ${err && err.message}`)
      if (onDisconnected) {
        onDisconnected()
      }
      client.end()
    })
  }

  this.publishStateSensor = function (zones) {
    if (!zones) {
      logger.info('No zone found to publish')
      return
    }

    if (!config.topics.sensors) {
      // don't publish sensors
      logger.warn("config file has no 'config.topics.sensors' configured. Skipping.")
      return
    }

    const configuredZones = zones.length

    // one payload with all sensors data (sensors attrs)
    if (!config.topics.sensors.topicType || config.topics.sensors.topicType === 'state') {
      // legacy state: array of zones
      _publishAndLog(config.topics.sensors.state, zones)
    }

    // multiple payload with single sensor data based on zone.id to avoid misplaced index
    if (config.hadiscovery) {
      for (let i = 0; i < configuredZones; i++) {
        const zone = zones[i]
        // full zone status (only if changed)
        _publishAndLog(config.topics.sensors.zone.state.replace('${zoneId}', zone.id), zone)
      }
    }

    // publishing also as object based on zone.id to avoid misplaced index
    if (zones.length > 0 && (!config.topics.sensors.topicType || config.topics.sensors.topicType === 'zone')) {
      logger.debug("sending topic '" + config.topics.sensors.zone.alarm + "' for " + configuredZones + ' zones')
      logger.debug("sending topic '" + config.topics.sensors.zone.active + "' for " + configuredZones + ' zones')
      logger.debug("sending topic '" + config.topics.sensors.zone.lowBattery + "' for " + configuredZones + ' zones')
      logger.debug("sending topic '" + config.topics.sensors.zone.fault + "' for " + configuredZones + ' zones')

      for (let i = 0; i < configuredZones; i++) {
        const zone = zones[i]
        let pub = _publish
        if (config.verbose) {
          pub = _publishAndLog
        }

        // single zone properties
        if (publishZonesProperties) {
          pub(config.topics.sensors.zone.alarm.replace('${zoneId}', zone.id), zone.alarm ? config.payloads.sensorOn : config.payloads.sensorOff)
          pub(config.topics.sensors.zone.active.replace('${zoneId}', zone.id), zone.bypass ? config.payloads.sensorOn : config.payloads.sensorOff)
          pub(config.topics.sensors.zone.lowBattery.replace('${zoneId}', zone.id), zone.lowbat ? config.payloads.sensorOn : config.payloads.sensorOff)
          pub(config.topics.sensors.zone.fault.replace('${zoneId}', zone.id), zone.fault ? config.payloads.sensorOn : config.payloads.sensorOff)
        }
      }
    }
  }

  this.publishStateIAlarm = function (status) {
    if (status) {
      for (const statusNumber in status) {
        // decode status
        const areaStatus = status[statusNumber]
        const alarmState = _decodeStatus(areaStatus)
        status[statusNumber] = (config.payloads.alarm && config.payloads.alarm[alarmState]) || areaStatus
      }
    }
    _publishAndLog(config.topics.alarm.state, status)
  }

  this.publishAvailable = function () {
    const m = {}
    m.topic = config.topics.availability
    m.payload = 'online'
    _publish(m.topic, m.payload)
  }

  this.publishError = function (errorMessage, stack) {
    if (errorMessage) {
      logger.error(`Publishing error: ${errorMessage}`, stack)
    }
    _publish(config.topics.error, {
      message: errorMessage,
      stack: stack,
      date: new Date()

    })
  }

  this.publishEvent = function (data) {
    const m = {}
    m.topic = config.topics.alarm.event
    m.payload = data
    _publish(m.topic, m.payload)
  }

  this.publishHomeAssistantMqttDiscovery = function (zones, on, deviceInfo) {
    // Reset of 128 zones
    const IAlarmHaDiscovery = require('./mqtt-hadiscovery')
    const messages = new IAlarmHaDiscovery(config, zones, true, deviceInfo).createMessages()
    for (let index = 0; index < messages.length; index++) {
      const m = messages[index]
      _publishAndLog(m.topic, m.payload, { retain: true })
    }

    if (on) {
      logger.info('Setting up Home assistant discovery...')
      // let's wait HA processes all the entity reset, then submit again the discovered entity
      setTimeout(function () {
        // mqtt discovery messages to publish
        const messages = new IAlarmHaDiscovery(config, zones, false, deviceInfo).createMessages()
        for (let index = 0; index < messages.length; index++) {
          const m = messages[index]
          _publishAndLog(m.topic, m.payload, { retain: true })// config
        }
      }, 5000)
    }
  }
}
