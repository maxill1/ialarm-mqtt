const IAlarm = require('ialarm')
const IAlarmPublisher = require('./utils/mqtt-publisher')

module.exports = (config) => {
  if (!config) {
    console.error('Please provide a valid config.json')
    process.exit(1)
  }

  const publisher = new IAlarmPublisher(config)

  let zonesCache = {}

  function newAlarm () {
    return new IAlarm(
      config.server.host,
      config.server.port,
      config.server.username,
      config.server.password,
      config.server.zones)
  }

  function handleError (e) {
    const msg = e.message ? e : { message: JSON.stringify(e) }
    publisher.publishError(msg)
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
    newAlarm().getStatus(zonesCache.zones && zonesCache.zones.length > 0 ? zonesCache.zones : undefined).then(publishFullState).catch(handleError)
  }

  /**
     * Read logs and publish new events
     */
  function readEvents () {
    newAlarm().getEvents().then(function (events) {
      const lastEvent = events && events.length > 1 ? events[0] : undefined
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
      }

      // publish only if changed or empty
      publisher.publishEvent(lastEvent)
    }, handleError).catch(handleError)
  }

  /**
     * publish received state and fetch new events
     * @param {*} param0
     */
  function publishFullState (data) {
    if (data.status.event === 'response') {
      console.log(data)
    }

    // we want to publish emtpy statues
    const { status, zones } = data || {}

    // console.log(`New alarm status: ${status}`);
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

  /**
     * publish received state and fetch new events
     * @param {*} param0
     */
  function publishStateAndFetchEvents (data) {
    publishFullState(data)

    // notify last event
    setTimeout(function () {
      readEvents()
    }, 500)
  }

  function armDisarm (commandType) {
    const alarm = newAlarm()
    if (!commandType || !alarm[commandType]) {
      console.log(`Received invalid alarm command: ${commandType}`)
    } else {
      console.log(`Received alarm command: ${commandType}`)
      // force publish on next round
      publisher.resetCache()
      // command
      alarm[commandType]().then(publishStateAndFetchEvents, handleError).catch(handleError)

      if (config.debug) {
        console.log('DEBUG MODE: IGNORING SET COMMAND RECEIVED for alarm.' + commandType + '()')
        console.log('DEBUG MODE: FAKING SET COMMAND RECEIVED for alarm.' + commandType + '()')
        publisher.publishStateIAlarm(commandType)
      }
    }
  }

  function bypassZone (zoneNumber, bypass) {
    if (!zoneNumber || zoneNumber > 40) {
      console.error('bypassZone: received invalid zone number: ' + zoneNumber)
      return
    }

    if (!bypass) {
      bypass = false
    }

    console.log('Received bypass ' + bypass + ' for zone number ' + zoneNumber)

    // force publish on next round
    publisher.resetCache()
    newAlarm().bypassZone(zoneNumber, bypass).then(publishStateAndFetchEvents, handleError).catch(handleError)
  }

  function discovery (enabled) {
    // home assistant mqtt discovery (if not enabled it will reset all /config topics)
    publisher.publishHomeAssistantMqttDiscovery(Object.values(zonesCache.zones), enabled, config.deviceInfo)
    if (!enabled) {
      console.log('Home assistant discovery disabled (empty config.hadiscovery)')
    }
  }

  function resetCache () {
    console.log('iAlarm cache cleared')
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
   * set up intervals
   * @returns
   */
  function startPolling () {
    console.log('Status polling every ', config.server.polling_status, ' ms')
    console.log('Events polling every ', config.server.polling_events, ' ms')

    // alarm and sensor status
    const intervals = []
    intervals.push(setInterval(function () {
      publisher.publishAvailable()

      readStatus()
    }, config.server.polling_status))

    // event messages
    intervals.push(setInterval(function () {
      readEvents()
    }, config.server.polling_events))

    return intervals
  }

  // start loop
  function start () {
    console.log('Starting up...')

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

    let pollings = []
    // mqtt connection first
    startMqtt(
      // on connection start tcp polling
      () => {
        console.log('Setting up first TCP connection to retrieve mac address...')
        // fetching alarm info
        newAlarm().getNet().then(function (network) {
          config.deviceInfo = network
          console.log(`First connection OK: connected to alarm panel ${JSON.stringify(config.deviceInfo)}`)

          console.log('Retrieving zone info ...')
          // initial zone info fetch
          return newAlarm().getZoneInfo()
        }).then(function (response) {
          const info = 'got ' + Object.keys(response).length + ' zones info'
          console.log(info)
          // remove empty or disabled zones
          zonesCache.zones = removeEmptyZones(response)
          zonesCache.caching = false

          // home assistant discovery (if enabled)
          discovery(config.hadiscovery.enabled)

          // we are ready to start tcp polling
          pollings = startPolling()
        }).catch((error) => {
          console.log(`Error starting up: ${error && error.message}`)
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

  function stop (intervals) {
    console.log('Stopping...')
    intervals.forEach(item => {
      clearInterval(item)
    })
    // exit ialarm-mqtt
    process.exit(1)
  }

  start()
}
