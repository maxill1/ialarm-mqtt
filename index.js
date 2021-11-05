const IAlarm = require('ialarm')
const constants = require('ialarm/src/constants')
const IAlarmLogger = require('ialarm/src/logger')
const configHandler = require('./utils/config-handler')
const IAlarmPublisher = require('./utils/mqtt-publisher')
const IAlarmStatusDecoder = require('ialarm/src/status-decoder')()

module.exports = (config) => {
  const logger = IAlarmLogger(config.debug ? 'debug' : 'info')

  if (!config) {
    console.error('Please provide a valid config.json')
    process.exit(1)
  }

  const publisher = new IAlarmPublisher(config)

  let zonesCache = {}
  const pollings = []

  function newAlarm () {
    return new IAlarm(
      config.server.host,
      config.server.port,
      config.server.username,
      config.server.password,
      config.server.zones,
      config.verbose ? 'debug' : 'info',
      config.server.delay)
  }

  function handleError (e) {
    let msg
    if (typeof e === 'string') {
      msg = e
    } else if (e.message) {
      msg = e.message
    }
    const stack = e.stack ? JSON.stringify(e.stack) : ''
    publisher.publishError(msg, stack)
  }

  function getZoneCache (id) {
    if (zonesCache &&
            zonesCache.zones &&
            zonesCache.zones[id]) {
      return zonesCache.zones.find(z => z.id === id)
    }
    return undefined
  };

  /**
   * removes empty or disabled zones
   * @param {*} zones
   * @returns
   */
  function removeEmptyZones (zones) {
    return zones.filter(z => z.typeId > 0 && z.name !== '')
  }

  /**
   * Read and publis state
   */
  function readStatus () {
    if (!configHandler.isFeatureEnabled(config, ['armDisarm', 'sensors'])) {
      return
    }

    const client = newAlarm()

    let status = {
      status_1: ''
    }

    let statusPromise
    // alarm/area status
    if (configHandler.isFeatureEnabled(config, 'armDisarm')) {
      const statusFunction = config.server.areas > 1 ? 'getStatusArea' : 'getStatusAlarm'
      statusPromise = client[statusFunction]()
    } else {
      // fake status
      statusPromise = new Promise((resolve) => {
        resolve({
          status: '' // not relevant, we are just polling sensors
        })
      })
    }

    statusPromise.then(function (statusResponse) {
      status = statusResponse.status_1 ? statusResponse : { status_1: statusResponse.status }

      // H24 triggered or armed and zone alarm goes on area 1 (until we find a way to determine sensor area)
      const mergedStatus = Object.keys(status).reduce(function (tot, current) {
        const areaStatus = status[current]
        if (areaStatus && IAlarmStatusDecoder.isArmed(areaStatus)) {
          return areaStatus
        }
        return tot
      }, status.status_1)

      if (!configHandler.isFeatureEnabled(config, 'sensors')) {
        return {
        // 2
          status: mergedStatus,
          zones: []
        }
      }
      // sensor status with names, type, etc
      return client.getZoneStatus(mergedStatus, zonesCache.zones && zonesCache.zones.length > 0 ? zonesCache.zones : undefined)
    }).then(function (zonesResponse) {
      // H24 triggered or armed and zone alarm goes on area 1 (until we find a way to determine sensor area)
      status.status_1 = zonesResponse.status === 'TRIGGERED' ? zonesResponse.status : status.status_1

      publishFullState(status, zonesResponse.zones || [])
    }).catch(handleError)
  }

  /**
   * Read logs and publish new events
   */
  function readEvents () {
    if (!configHandler.isFeatureEnabled(config, 'events')) {
      return
    }

    newAlarm().getLastEvents().then(function ({ logs }) {
      const lastEvent = logs && logs.length > 1 ? logs[0] : undefined
      if (lastEvent) {
        const zoneCache = getZoneCache(lastEvent.zone)
        if (zoneCache) {
          lastEvent.name = zoneCache.name
          lastEvent.type = zoneCache.type
        }

        let description = lastEvent.zone
        if (lastEvent.name) {
          description = description + ' ' + lastEvent.name
        }
        lastEvent.description = lastEvent.message + ' (zone ' + description + ')'
      } else {
        logger.warning('Received no last event from alarm (logs is missing)...')
      }

      // publish only if changed or empty
      publisher.publishEvent(lastEvent)
    }).catch(handleError)
  }

  /**
     * publish received state and fetch new events
     * @param {*} param0
     */
  function publishFullState (status, zones) {
    // alarm
    publisher.publishStateIAlarm(status)

    // zone config override
    if (zones && config.zones) {
      config.zones.forEach(zoneConfig => {
        const zoneId = zoneConfig.number
        const zoneNumber = parseInt(zoneId)
        const zone = zones.find(z => z.id === zoneNumber)
        if (zone) {
          // normally open /normally closed (default closed)
          if (zoneConfig.contactType === 'NO') {
            const fault = zone[zoneConfig.statusProperty || 'fault']
            // invert open/problem data
            zone[zoneConfig.statusProperty || 'fault'] = !fault
          }
        }
      })
    }

    // publish sensors
    publisher.publishStateSensor(zones)

    // clears errors
    // publisher.publishError()
  }

  /**
     * publish received state and fetch new events
     * @param {*} param0
     */
  function publishStateAndFetchEvents (data) {
    readStatus()

    // notify last event
    setTimeout(function () {
      readEvents()
    }, 1000)

    // reschedule active timers
    pollings.forEach(element => {
      element.refresh()
    })
  }

  function armDisarm (commandType, numArea) {
    if (!configHandler.isFeatureEnabled(config, 'armDisarm')) {
      return
    }

    const alarm = newAlarm()
    if (!commandType || !alarm[commandType]) {
      logger.error(`Received invalid alarm command: ${commandType}`)
    } else {
      logger.info(`Received alarm command: ${commandType}`)
      // force publish on next round
      publisher.resetCache()
      // command
      alarm[commandType](numArea).then(publishStateAndFetchEvents).catch(handleError)

      if (config.debug) {
        logger.info('DEBUG MODE: IGNORING SET COMMAND RECEIVED for alarm.' + commandType + '()')
        logger.info('DEBUG MODE: FAKING SET COMMAND RECEIVED for alarm.' + commandType + '()')
        publisher.publishStateIAlarm(commandType)
      }
    }
  }

  function bypassZone (zoneNumber, bypass) {
    if (!configHandler.isFeatureEnabled(config, 'bypass')) {
      return
    }

    if (!zoneNumber || zoneNumber > constants.maxZones) {
      console.error('bypassZone: received invalid zone number: ' + zoneNumber)
      return
    }
    bypass = bypass || false

    logger.info('Received bypass ' + bypass + ' for zone number ' + zoneNumber)

    // force publish on next round
    publisher.resetCache()
    newAlarm().bypassZone(zoneNumber, bypass).then(publishStateAndFetchEvents).catch(handleError)
  }

  function discovery (enabled) {
    // home assistant mqtt discovery (if not enabled it will reset all /config topics)
    publisher.publishHomeAssistantMqttDiscovery(Object.values(zonesCache.zones), enabled, config.deviceInfo)
    if (!enabled) {
      logger.warn('Home assistant discovery disabled (empty config.hadiscovery)')
    }
  }

  function resetCache () {
    logger.warn('iAlarm cache cleared')
    publisher.resetCache()

    // sending fresh data
    readStatus()
  }

  /**
   * mqtt init
   */
  function startMqtt (onConnected, onDisconnected) {
    // mqtt init
    const commandHandler = {}
    commandHandler.armDisarm = armDisarm
    commandHandler.bypassZone = bypassZone
    commandHandler.discovery = discovery
    commandHandler.resetCache = resetCache
    publisher.connectAndSubscribe(
      commandHandler,
      // connected
      onConnected,
      // disconnected
      onDisconnected)
  }

  /**
   * set up pollings
   * @returns
   */
  function startPolling () {
    // alarm and sensor status
    if (configHandler.isFeatureEnabled(config, ['armDisarm', 'sensors', 'bypass'])) {
      logger.info('Status polling every ', config.server.polling_status, ' ms')
      pollings.push(setInterval(function () {
        publisher.publishAvailable()
        readStatus()
      }, config.server.polling_status))
    } else {
      logger.debug('Status disabled in config file')
    }

    // event messages
    if (configHandler.isFeatureEnabled(config, 'events')) {
      logger.info('Events polling every ', config.server.polling_events, ' ms')
      pollings.push(setInterval(function () {
        readEvents()
      }, config.server.polling_events))
    } else {
      logger.debug('Events disabled in config file')
    }
  }

  // start loop
  function start () {
    logger.info('Starting up...')

    const host = config.server.host
    const port = config.server.port
    const username = config.server.username
    const password = config.server.password

    if (!host || !port || !username || !password) {
      throw new Error('Missing required configuration')
    }

    if (!zonesCache) {
      zonesCache = { zones: {}, caching: true }
    }

    // mqtt connection first
    startMqtt(
      // on connection start tcp polling
      () => {
        // reset timers
        if (pollings.length > 0) {
          clearInterval(pollings)
        }

        logger.info('Setting up first TCP connection to retrieve mac address...')
        // fetching alarm info
        newAlarm().getNet().then(function (network) {
          config.deviceInfo = network
          logger.info(`First connection OK: connected to alarm panel ${JSON.stringify(config.deviceInfo)}`)

          logger.info('Retrieving zone info ...')

          if (configHandler.isFeatureEnabled(config, 'zoneNames')) {
            // initial zone info fetch
            return newAlarm().getZoneInfo()
          }
          // zone names disabled, building them
          const zoneNames = []
          let zonesId = []
          if (Array.isArray(config.server.zones)) {
            zonesId = config.server.zones
          } else {
            for (let index = 0; index < config.server.zones; index++) {
              const zoneNumber = index + 1
              zonesId.push(zoneNumber)
            }
          }

          for (let index = 0; index < zonesId.length; index++) {
            const zoneNumber = zonesId[index]
            zoneNames.push(
              {
                typeId: 2, // using Perimetrale as default
                type: 'Perimetrale',
                voiceId: 1,
                voiceName: 'Fisso',
                id: zoneNumber,
                zone: zoneNumber,
                name: 'Device'
              }
            )
          }
          return zoneNames
        }).then(function (response) {
          logger.info(`got ${Object.keys(response).length} ' zones info'`)
          // remove empty or disabled zones
          zonesCache.zones = removeEmptyZones(response)
          zonesCache.caching = false

          // home assistant discovery (if enabled)
          discovery(config.hadiscovery.enabled)

          // clean errors
          publisher.publishError('OK')

          // we are ready to start tcp polling
          startPolling()
        }).catch((error) => {
          logger.error(`Error starting up: ${error && error.message}`)
          // end polling and close app
          stop(pollings)
        })
      },
      // on disconnection end polling and close app
      () => {
        stop(pollings)
      }
    )
  }

  function stop () {
    logger.info('Stopping...')
    pollings && pollings.forEach(item => {
      clearInterval(item)
    })
    // exit ialarm-mqtt
    process.exit(1)
  }

  start()
}
