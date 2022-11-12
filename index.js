
import { MeianSocket, MeianDataHandler, MeianConstants, MeianLogger, MeianConnection, MeianStatusDecoder } from 'ialarm'
import { MqttPublisher } from './utils/mqtt-publisher.js'
import { configHandler } from './utils/config-handler.js'

export const ialarmMqtt = (config) => {
  const logger = MeianLogger(config.debug ? 'debug' : 'info')

  if (!config) {
    console.error('Please provide a valid config.json')
    process.exit(1)
  }

  let errorCount = 0
  let discovered = false

  const publisher = new MqttPublisher(config)

  // TODO config.server.delay for concurrent commands

  // single connection for all messages
  const socket = new MeianSocket(
    config.server.host,
    config.server.port,
    config.server.username,
    config.server.password,
    config.verbose ? 'debug' : 'info',
    config.server.zones
  )

  function connectToAlarm () {
    logger.info('Starting TCP connection...')
    // connect
    socket.connect()
  }

  function executeCommand (commands, args) {
    try {
      const delay = MeianConnection.status.isReady() ? 0 : 200
      // idle or autenticating
      const requestTime = new Date().getTime()
      const commandInterval = setInterval(async () => {
        const executionTime = new Date().getTime()
        // async command
        if (MeianConnection.status.isReady() || (executionTime - requestTime) > 10000) {
          clearInterval(commandInterval)
          await socket.executeCommand(commands, args)
        } else {
          logger.info(`A request is in progress...we will wait for response before sending ${JSON.stringify(commands)} (${JSON.stringify(args)})`)
        }
      },
      delay)
    } catch (error) {
      handleError(error)
    }
  }

  /**
   * ready to send commands
   */
  socket.onConnected(async (connectionResponse) => {
    logger.info(`logged in (${connectionResponse})`)

    logger.info('Setting up first TCP command to retrieve mac address...')
    // send commands
    executeCommand('GetNet')
    logger.info(`First connection OK: alarm panel responded ${JSON.stringify(config.deviceInfo)}`)
    logger.info('Retrieving zone info ...')
    if (configHandler.isFeatureEnabled(config, 'zoneNames')) {
      executeCommand('GetZone')
    }

    // availability
    publisher.publishAvailable(true)

    // we are ready to start tcp polling
    startPolling()
  })

  // command
  socket.onResponse(async (commandResponse) => {
    try {
      // formatted payload
      const payload = commandResponse.payloads?.data
      // mac address, ip, etc
      if (payload.GetNet) {
        parseNet(payload.GetNet)
      }

      // parse zone names and put them into cache
      if (payload.GetZone) {
        parseZones(payload.GetZone)
      }

      try {
        if (commandResponse.payloads?.rawData && commandResponse.payloads?.rawData?.GetArea) {
          logger.info(`******** DEBUG ******* GetArea RAW: ${JSON.stringify(commandResponse.payloads?.rawData?.GetArea)}`)
        }
      } catch (error) {
        logger.info(`******** DEBUG ******* GetArea payload: ${JSON.stringify(commandResponse)}`)
      }

      // status and sensors
      if ((payload.GetAlarmStatus || payload.GetArea) && payload.GetByWay) {
        if (payload.GetArea) {
          logger.info(`******** DEBUG ******* GetArea formatted: ${JSON.stringify(payload.GetArea)}`)
        }
        parseStatusAndSensors(payload.GetAlarmStatus || payload.GetArea, payload.GetByWay, payload.GetZone || zonesCache.zones)
      }

      if (payload.SetByWay || payload.SetAlarmStatus || payload.SetArea) {
        if (payload.SetByWay) {
          // gets the latest state sensor from mqtt cache and updates only the submitted properties
          const zoneNumber = payload.SetByWay.zone + 1
          publisher.updateStateSensor(zoneNumber, { bypass: payload.SetByWay.bypass })
        }
        if (payload.SetAlarmStatus) {
          publisher.publishStateIAlarm({
            status_1: payload.SetAlarmStatus
          })
        }
        // TODO UNTESTED!!! SetArea
        if (payload.SetArea && payload.SetArea.status_1) {
          publisher.publishStateIAlarm(payload.SetArea)
        }

        logger.debug(`Received response: ${JSON.stringify(commandResponse)}`)
        if (!isPolling()) {
          startPolling()
        }
      }

      Object.keys(commandResponse).forEach(command => {
        if (commandResponse[command] && (commandResponse[command].error || commandResponse[command].timeout)) {
          logger.log('error', `${command} responded with an error "${commandResponse[command].error}" or timed out ${commandResponse[command].timeout}`)
        }
      })

      // once received GetNet and GetZones we are ready to start discovery
      if (zonesCache.zones && !discovered) {
      // home assistant discovery (if enabled)
        discovery(config.hadiscovery.enabled)
      }
    } catch (error) {
      handleError(error)
    }
  })

  function isResponseValid (response) {
    return response && !response.error
  }

  /**
   * Mac address, ip, etc
   * @param {*} GetNet
   */
  function parseNet (GetNet) {
    if (!isResponseValid(GetNet)) {
      return
    }
    config.deviceInfo = GetNet
  }

  /**
   * Zone Names
   * @param {*} GetZone
   */
  function parseZones (GetZone) {
    if (!isResponseValid(GetZone)) {
      return
    }

    let zoneNames = []
    // zone names disabled, building them
    if (!configHandler.isFeatureEnabled(config, 'zoneNames')) {
      // config check
      if (!Array.isArray(config.server.zones)) {
        throw new Error('config.server.zones must be an array')
      }

      for (let index = 0; index < config.server.zones.length; index++) {
        const zoneNumber = config.server.zones[index]
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
    } else if (GetZone) {
      zoneNames = MeianDataHandler.getZoneInfo(GetZone)
    }

    if (zoneNames && zoneNames.length > 0) {
      logger.info(`got ${Object.keys(zoneNames).length} ' zones info'`)
      // remove empty or disabled zones
      zonesCache.zones = removeDisabledZones(zoneNames, config.server.showUnnamedZones)
      zonesCache.caching = false
    }
  }

  /**
   * Alarm status and sensors data
   * @param {*} GetAlarmStatus
   * @param {*} GetByWay
   * @param {*} GetZone
   */
  function parseStatusAndSensors (GetAlarmStatus, GetByWay, GetZone) {
    // create stubs
    GetByWay = isResponseValid(GetByWay) ? GetByWay : { zones: [] }
    GetZone = isResponseValid(GetZone) ? GetZone : { zones: [] }

    // full response
    const zonesResponse = MeianDataHandler.getZoneStatus(
      GetAlarmStatus, // alarm status
      GetByWay, // sensor states
      GetZone, // zone names (cache or previous fetch)
      config.server.zones // configured zones
    )

    // mqtt
    publishFullState(zonesResponse.status, zonesResponse.zones || [])

    // alarm is responding
    if (zonesResponse.status && zonesResponse.zones) {
      publisher.publishConnectionStatus(!MeianConnection.status.isDisconnected(), 'OK')
    }
  }

  // push events
  socket.onPush(async (pushResponse) => {
    logger.debug(`Received push: ${JSON.stringify(pushResponse)}`)

    if (!configHandler.isFeatureEnabled(config, 'events')) {
      logger.debug('Events disabled in config file')
      return
    }

    try {
      const data = pushResponse.data
      if (data || !data.zone) {
        const zoneCache = getZoneCache(data.zone)
        if (zoneCache) {
          data.name = zoneCache.name || data.zoneName
          data.type = zoneCache.type
        }

        let description = data.zone
        if (data.name) {
          description = description + ' ' + data.name
        }
        description = data.content + ' (zone ' + description + ')'

        // publish only if changed or empty
        publisher.publishEvent({
          ...data,
          description,
          lastUpdated: new Date().toISOString()
        })
      } else {
        logger.warning(`Received an empty push event: ${JSON.stringify(data)}`)
      }
    } catch (error) {
      handleError(error)
    }
  })

  socket.onDisconnected(async (disconnectionResponse) => {
    logger.info(`disconnected (type: ${disconnectionResponse}, errorCount: ${errorCount})`)
    // availability
    publisher.publishAvailable(false)
    errorCount = 0
  })

  socket.onError(async (error) => {
    errorCount++
    // clean errors
    publisher.publishConnectionStatus(!MeianConnection.status.isDisconnected(), error.message || 'Generic error')

    logger.info(`Error ${error.message} - ${JSON.stringify(error.stack)}`)

    // stop
    stopPolling()

    // disconnect
    if (errorCount > 10) {
      socket.disconnect('error')

      // retry after some time
      setTimeout(() => {
        connectToAlarm()
      }, 5000)
    }
  })

  let zonesCache = {}
  const pollings = []

  function handleError (e) {
    let msg
    if (typeof e === 'string') {
      msg = e
    } else if (e.message) {
      msg = e.message
    }
    const stack = e.stack ? JSON.stringify(e.stack) : ''
    publisher.publishConnectionStatus(!MeianConnection.status.isDisconnected(), msg, stack)
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
  function removeDisabledZones (zones, showUnnamedZones) {
    return zones.filter(z => {
      if (!z.typeId || z.typeId <= 0) {
        logger.info(`removeDisabledZones: filtering out zone ${z.id} with typeId disabled`, z)
        return false
      }
      if (!showUnnamedZones && !z.name) {
        logger.info(`removeDisabledZones: filtering out zone ${z.id} with empty name`, z)
        return false
      }
      return true
    })
  }

  /**
   * Read and publis state
   */
  async function fetchStatus () {
    try {
      if (!configHandler.isFeatureEnabled(config, ['armDisarm', 'sensors'])) {
        return
      }

      const commands = []
      if (configHandler.isFeatureEnabled(config, 'sensors')) {
        // sensor status with names, type, etc
        commands.push('GetByWay')
      }
      // if needed fetch zones
      if ((!zonesCache.zones || zonesCache.zones.length === 0) &&
            configHandler.isFeatureEnabled(config, 'zoneNames')) {
        commands.push('GetZone')
      }

      // if needed fetch alarm/area status
      if (configHandler.isFeatureEnabled(config, 'armDisarm')) {
        const command = config.server.areas > 1 ? 'GetArea' : 'GetAlarmStatus'
        commands.push(command)
      }

      // 1, 2 or 3 commands
      executeCommand(commands)
    } catch (error) {
      handleError(error)
    }
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
  }

  async function armDisarm (commandType, numArea) {
    if (!configHandler.isFeatureEnabled(config, 'armDisarm')) {
      return
    }
    try {
      const alarmStatusName = MeianStatusDecoder.fromStatusToTcpValue(commandType)
      if (!commandType || !alarmStatusName) {
        logger.error(`Received invalid alarm command: ${commandType}`)
      } else {
        logger.info(`Received alarm command: ${commandType}`)

        // stop polling
        stopPolling()

        // force publish on next round
        publisher.resetCache()
        // command
        const commandName = config.server.areas > 1 ? 'SetArea' : 'SetAlarmStatus'
        const commandArgs = config.server.areas > 1 ? [[numArea, alarmStatusName]] : [[alarmStatusName]]
        executeCommand(commandName, commandArgs)

        if (config.debug) {
          logger.info('DEBUG MODE: IGNORING SET COMMAND RECEIVED for alarm.' + commandType + '()')
          logger.info('DEBUG MODE: FAKING SET COMMAND RECEIVED for alarm.' + commandType + '()')
          publisher.publishStateIAlarm(commandType)
        }
      }
    } catch (error) {
      handleError(error)
    }
  }

  async function bypassZone (zoneNumber, bypass) {
    if (!configHandler.isFeatureEnabled(config, 'bypass')) {
      return
    }

    try {
      if (!zoneNumber || zoneNumber > MeianConstants.maxZones) {
        console.error('bypassZone: received invalid zone number: ' + zoneNumber)
        return
      }
      bypass = bypass || false

      // stop polling
      stopPolling()

      logger.info('Received bypass ' + bypass + ' for zone number ' + zoneNumber)

      // force publish on next round
      publisher.resetCache()

      // zone 0-indexed
      executeCommand('SetByWay', [[zoneNumber - 1, bypass]])
    } catch (error) {
      handleError(error)
    }
  }

  function discovery (enabled) {
    // clean errors
    publisher.publishConnectionStatus(!MeianConnection.status.isDisconnected(), 'OK')

    // home assistant mqtt discovery (if not enabled it will reset all /config topics)
    publisher.publishHomeAssistantMqttDiscovery(Object.values(zonesCache.zones), enabled, config.deviceInfo)
    if (!enabled) {
      logger.warn('Home assistant discovery disabled (empty config.hadiscovery)')
    }
    discovered = true
  }

  function resetCache () {
    logger.warn('iAlarm cache cleared')
    publisher.resetCache()

    // sending fresh data
    fetchStatus()
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
   * stop polling
   */
  function stopPolling () {
    // reset timers
    if (pollings.length > 0) {
      clearInterval(pollings)
    }
  }

  /**
   * Check if any timeout is currently active
   * @returns
   */
  function isPolling () {
    return pollings && pollings.length > 0
  }

  /**
   * set up pollings
   * @returns
   */
  function startPolling () {
    if (isPolling()) {
      return
    }

    pollings.push(setInterval(function () {
      publisher.publishAvailable(true)
    }, 300000))

    // alarm and sensor status
    if (configHandler.isFeatureEnabled(config, ['armDisarm', 'sensors', 'bypass'])) {
      logger.info(`Status polling every ${config.server.polling_status}ms`)
      pollings.push(setInterval(function () {
        if ((!zonesCache.zones || zonesCache.zones.length === 0) && !config.deviceInfo) {
          publisher.publishConnectionStatus(!MeianConnection.status.isDisconnected(), 'Missing network and zone infos')
          return
        }
        fetchStatus()
      }, config.server.polling_status))
    } else {
      logger.debug('Status disabled in config file')
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
        stopPolling()
        connectToAlarm()
      },
      // on disconnection end polling and close app
      () => {
        stop(pollings)
      }
    )
  }

  function stop () {
    logger.info('Stopping...')
    // reset timers
    stopPolling()

    // exit ialarm-mqtt
    process.exit(1)
  }

  start()
}
