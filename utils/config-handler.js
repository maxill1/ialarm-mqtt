/* eslint-disable no-template-curly-in-string */
import { MeianConstants, MeianLogger } from 'ialarm'
import YAML from 'yaml'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const loggerBasic = MeianLogger('info')

function getBaseDir () {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const baseDir = path.join(__dirname, '../')
  return baseDir
}

/**
* Add to config all default values if missing
*/
function initDefaults (config, configFile) {
  const logger = MeianLogger(config.verbose ? 'debug' : 'info')

  /**
       * Check or init a config value
      * @param {*} object
      * @param {*} paths
      * @param {*} index
      * @param {*} defaultValue
      * @returns
      */
  const _checkConfig = function (object, paths, index, defaultValue) {
    if (!index) {
      index = 0
    }
    if (paths === undefined || paths.length === 0 || index >= paths.length) {
      return
    }
    const key = Array.isArray(paths) ? paths[index] : paths
    const exists = object !== undefined && object[key] !== undefined
    if (!exists) {
      if (defaultValue !== undefined && index === paths.length - 1) {
        // create default
        logger.warn(`Config value "${JSON.stringify(paths)}" missing on ${configFile} using default: "${defaultValue}"`)
        object[key] = defaultValue
      } else {
        throw new Error(`subscribe error: ${configFile} is missing ${paths[index]} on ${JSON.stringify(paths)}. See: ${JSON.stringify(config.topics)}`)
      }
    }
    _checkConfig(object[key], paths, index + 1, defaultValue)
  }

  if (config) {
    // checks
    _checkConfig(config, ['verbose'], 0, false)
    _checkConfig(config, ['name'], 0, 'Alarm')
    _checkConfig(config, ['server', 'host'])
    _checkConfig(config, ['server', 'port'])
    _checkConfig(config, ['server', 'username'])
    _checkConfig(config, ['server', 'password'])
    _checkConfig(config, ['server', 'zones'], 0, 40) // we support max 128 zone but default will be 40 to avoid pushing unuseful sensors
    _checkConfig(config, ['server', 'showUnnamedZones'], 0, true) // default true
    _checkConfig(config, ['server', 'areas'], 0, 1)
    _checkConfig(config, ['server', 'delay'], 0, 200)
    _checkConfig(config, ['server', 'polling_status'], 0, (config.server && config.server.polling && config.server.polling.status) || 5000)
    _checkConfig(config, ['server', 'features'], 0, ['armDisarm', 'sensors', 'events', 'bypass', 'zoneNames'])
    _checkConfig(config, ['mqtt', 'port'])
    _checkConfig(config, ['mqtt', 'host'])
    _checkConfig(config, ['mqtt', 'username'])
    _checkConfig(config, ['mqtt', 'password'])
    _checkConfig(config, ['mqtt', 'clientId'], 0, 'ialarm-mqtt')
    _checkConfig(config, ['mqtt', 'cache'], 0, '5m')
    _checkConfig(config, ['mqtt', 'retain'], 0, true)
    _checkConfig(config, ['topics'], 0, {})
    _checkConfig(config, ['topics', 'availability'], 0, 'ialarm/alarm/availability')
    _checkConfig(config, ['topics', 'alarm'], 0, {})
    _checkConfig(config, ['topics', 'alarm', 'command'], 0, 'ialarm/alarm/area/${areaId}/set')
    _checkConfig(config, ['topics', 'alarm', 'state'], 0, 'ialarm/alarm/state')
    _checkConfig(config, ['topics', 'alarm', 'event'], 0, 'ialarm/alarm/event')
    _checkConfig(config, ['topics', 'alarm', 'bypass'], 0, 'ialarm/alarm/zone/${zoneId}/bypass')
    _checkConfig(config, ['topics', 'alarm', 'discovery'], 0, 'ialarm/alarm/discovery')
    _checkConfig(config, ['topics', 'alarm', 'resetCache'], 0, 'ialarm/alarm/resetCache')
    _checkConfig(config, ['topics', 'alarm', 'configStatus'], 0, 'ialarm/alarm/configStatus')
    _checkConfig(config, ['topics', 'sensors'], 0, {})
    _checkConfig(config, ['topics', 'sensors', 'topicType'], 0, 'state')
    _checkConfig(config, ['topics', 'sensors', 'state'], 0, 'ialarm/sensors/state')
    _checkConfig(config, ['topics', 'sensors', 'zone'], 0, {})
    _checkConfig(config, ['topics', 'sensors', 'zone', 'state'], 0, 'ialarm/sensors/zone_${zoneId}')
    _checkConfig(config, ['topics', 'sensors', 'zone', 'alarm'], 0, 'ialarm/sensors/zone_${zoneId}/alarm')
    _checkConfig(config, ['topics', 'sensors', 'zone', 'active'], 0, 'ialarm/sensors/zone_${zoneId}/wirelessLoss')
    _checkConfig(config, ['topics', 'sensors', 'zone', 'lowBattery'], 0, 'ialarm/sensors/zone_${zoneId}/lowbat')
    _checkConfig(config, ['topics', 'sensors', 'zone', 'fault'], 0, 'ialarm/sensors/zone_${zoneId}/fault')
    _checkConfig(config, ['payloads'], 0, {})
    _checkConfig(config, ['payloads', 'alarmAvailable'], 0, 'online')
    _checkConfig(config, ['payloads', 'alarmNotvailable'], 0, 'offline')
    _checkConfig(config, ['payloads', 'alarmDecoder'], 0, {
      armAway: [
        'armAway',
        'armedAway',
        'armed_away',
        'arm_away',
        'AA',
        'AwayArm'
      ],
      armHome: [
        'armHome',
        'armedHome',
        'armed_home',
        'arm_home',
        'SA',
        'HomeArm',
        'StayArm',
        'armStay',
        'armedStay',
        'arm_stay',
        'armed_stay'
      ],
      disarm: [
        'disarm',
        'disarmed',
        'D'
      ],
      cancel: [
        'cancel',
        'canceled',
        'C'
      ],
      triggered: [
        'trigger',
        'triggered',
        'T'
      ]
    })
    _checkConfig(config, ['payloads', 'alarm'], 0, {
      armAway: 'armed_away',
      armHome: 'armed_home',
      disarm: 'disarmed',
      cancel: 'cancel',
      triggered: 'triggered'
    })
    _checkConfig(config, ['payloads', 'sensorOn'], 0, '1')
    _checkConfig(config, ['payloads', 'sensorOff'], 0, '0')

    _checkConfig(config, ['hadiscovery'], 0, {})
    _checkConfig(config, ['hadiscovery', 'enabled'], 0, true)
    _checkConfig(config, ['hadiscovery', 'discoveryPrefix'], 0, 'homeassistant')
    _checkConfig(config, ['hadiscovery', 'topics'], 0, {})
    _checkConfig(config, ['hadiscovery', 'topics', 'alarmConfig'], 0, '${discoveryPrefix}/alarm_control_panel/ialarm_${areaId}/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'eventsConfig'], 0, '${discoveryPrefix}/sensor/ialarm/events/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'connectionConfig'], 0, '${discoveryPrefix}/binary_sensor/ialarm/connection/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'sensorConfig'], 0, '${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/fault/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'sensorBatteryConfig'], 0, '${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/battery/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'sensorAlarmConfig'], 0, '${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/alarm/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'sensorConnectivityConfig'], 0, '${discoveryPrefix}/binary_sensor/ialarm_zone_${zoneId}/connectivity/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'bypassConfig'], 0, '${discoveryPrefix}/switch/ialarm/${zoneId}/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'clearCacheConfig'], 0, '${discoveryPrefix}/switch/ialarm/clear_cache/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'clearDiscoveryConfig'], 0, '${discoveryPrefix}/switch/ialarm/clear_discovery/config')
    _checkConfig(config, ['hadiscovery', 'topics', 'clearTriggeredConfig'], 0, '${discoveryPrefix}/switch/ialarm/clear_triggered/config')
    _checkConfig(config, ['hadiscovery', 'zoneName'], 0, 'Zone')
    _checkConfig(config, ['hadiscovery', 'faultName'], 0, 'Motion')
    _checkConfig(config, ['hadiscovery', 'batteryName'], 0, 'Battery')
    _checkConfig(config, ['hadiscovery', 'alarmName'], 0, 'Alarm')
    _checkConfig(config, ['hadiscovery', 'connectivityName'], 0, 'Connectivity')
    _checkConfig(config, ['hadiscovery', 'cleanCacheName'], 0, 'Clean cache')
    _checkConfig(config, ['hadiscovery', 'cleanCacheDiscoveryName'], 0, 'Clean discovery')
    _checkConfig(config, ['hadiscovery', 'cleanCacheTriggeredName'], 0, 'Clean triggered')
    _checkConfig(config, ['hadiscovery', 'commStatusName'], 0, 'Communication status')
    _checkConfig(config, ['hadiscovery', 'bypassName'], 0, 'Bypass')
    _checkConfig(config, ['hadiscovery', 'bypassIcon'], 0, 'mdi:lock-open')
    _checkConfig(config, ['hadiscovery', 'eventName'], 0, 'Last event')
    _checkConfig(config, ['hadiscovery', 'eventIcon'], 0, 'mdi:message-alert')

    // fix backward compatibility for multiple alarm_qos and sensors_qos config positions...
    _checkConfig(config, ['hadiscovery', 'alarm_qos'], 0, config.topics.alarm_qos || (config.topics.alarm && config.topics.alarm.alarm_qos) || 2)
    _checkConfig(config, ['hadiscovery', 'sensors_qos'], 0, config.topics.sensors_qos || (config.topics.sensors && config.topics.sensors.sensors_qos) || 0)
    _checkConfig(config, ['hadiscovery', 'code'], 0, '')

    // default device_class mappings and old config cleanup
    if (config.hadiscovery &&
      config.hadiscovery &&
      config.hadiscovery.zones &&
      config.hadiscovery.zones.perimetrale) {
      config.hadiscovery.zones = undefined
    }
    _checkConfig(config, ['hadiscovery', 'zones'], 0, {
      problem: {
        'zone bypass': 'safety',
        'zone fault': 'problem',
        'wireless detector low battery': 'battery',
        'wireless detector loss': 'connectivity'
      },
      default: {
        device_class: 'safety'
      },
      // 0: 'Disabilitata',
      0: {
        device_class: 'safety'
      },
      // 1: 'Ritardata',
      1: {
        device_class: 'door'
      },
      // 2: 'Perimetrale',
      2: {
        device_class: 'window'
      },
      // 3: 'Interna',
      3: {
        device_class: 'motion'
      },
      // 4: 'Emergenza',
      4: {
        device_class: 'safety'
      },
      // 5: '24 ore',
      5: {
        device_class: 'gas'
      },
      // 6: 'Incendio',
      6: {
        device_class: 'smoke'
      },
      // 7: 'Chiavi'
      7: {
        device_class: 'lock'
      }
    })
    _checkConfig(config, ['zones'], 0, [
    //   {
    //     number: 999,
    //     contactType: 'NO',
    //     device_class: 'moisture',
    //     statusProperty: 'fault'
    //   }
    ])

    // backward compatiblity zone objects -> zone array
    if (!Array.isArray(config.zones)) {
      const zones = []
      for (const key in config.zones) {
        const z = config.zones[key]
        zones.push({
          ...z,
          number: key
        })
      }
      config.zones = zones
    }

    // config.server.zones to array
    if (!Array.isArray(config.server.zones)) {
      const zoneArray = []
      for (let index = 0; index < config.server.zones; index++) {
        const zoneNumber = index + 1
        zoneArray.push(zoneNumber)
      }
      config.server.zones = zoneArray
    }

    return config
  } else {
    console.error('No config file provided')
  }
}

export const configHandler = {

  getMaxZones: () => {
    return MeianConstants?.listLimit?.GetByWay || 128
  },

  /**
     * read hassos addon options file and merge with missing config
     * @param {*} optionsFile
     * @returns
     */
  readHassOsOptions: function (optionsFile) {
    // merge default config.json with options.json

    loggerBasic.info('Trying to merge HASSOS options file (' + optionsFile + ') with default config.json')
    const file = fs.readFileSync(optionsFile, 'utf8')
    const hassos = JSON.parse(file)

    // default file
    const baseDir = getBaseDir()
    const config = YAML.parse(fs.readFileSync(`${baseDir}/templates/full.config.yaml`, 'utf8'))

    // merge main nodes
    config.verbose = hassos.verbose
    config.name = hassos.name
    config.server = hassos.server
    config.mqtt = hassos.mqtt

    // merge hadiscovery values
    config.hadiscovery = {
      ...hassos.hadiscovery
    }
    config.hadiscovery.code = hassos.code || hassos.hadiscovery.code || ''
    config.hadiscovery.zoneName = hassos.zoneName || hassos.hadiscovery.zoneName || 'Zone'

    // merge zones
    config.zones = hassos.zones

    // init missing config
    return initDefaults(config, optionsFile)
  },

  /**
  * Read a config file from file system
  * @param {*} configFile
  */
  readConfigFile: function (configFile) {
    let config = {}

    let configPath = configFile
    // if is a json file
    if (configPath.endsWith('.json')) {
      configFile = configPath
      loggerBasic.info('Found external json configuration file ', configPath)
      const file = fs.readFileSync(configFile, 'utf8')
      config = JSON.parse(file)
    } else if (configPath.endsWith('.yaml')) {
      configFile = configPath
      loggerBasic.info('Found external yaml configuration file', configPath)
      const file = fs.readFileSync(configFile, 'utf8')
      config = YAML.parse(file)
    } else {
      // Folder
      if (!configPath.endsWith('/')) {
        configPath = configPath + '/'
      }
      try {
        loggerBasic.info('Searching external config.yaml in path', configPath)
        // loading external file
        configFile = configPath + 'config.yaml'
        const file = fs.readFileSync(configFile, 'utf8')
        config = YAML.parse(file)
      } catch (error) {
        loggerBasic.info('Searching external config.json in path', configPath)
        // loading external file
        configFile = configPath + 'config.json'
        const file = fs.readFileSync(configFile, 'utf8')
        config = JSON.parse(file)
      }
    }
    // init missing config
    return initDefaults(config, configFile)
  },

  generateDefaultYaml: function (templateFile) {
    const baseDir = getBaseDir()
    let file
    if (templateFile) {
      file = fs.readFileSync(templateFile, 'utf8')
    } else {
      file = fs.readFileSync(path.join(baseDir, 'templates/tmpl.config.json'), 'utf8')
    }

    const config = initDefaults(JSON.parse(file), templateFile || 'test.json')

    const doc = new YAML.Document()
    doc.contents = {
      ...config
    }

    // const json = JSON.stringify(config)
    const yamlContent = doc.toString()

    fs.writeFile(path.join(baseDir, 'templates/full.config.yaml'), yamlContent, 'utf8', function (err) {
      if (err) {
        loggerBasic.error('An error occured while writing Yaml to File.')
        return
      }

      loggerBasic.info('Yaml file generated')
    })

    return config
  },
  getZoneOverride: function (config, id, typeId) {
    const numericId = parseInt(id)
    const zoneConfig = config.zones && config.zones.find(item => parseInt(item.number) === numericId)

    if (zoneConfig) {
      return zoneConfig
    }
    // fallback to generic hadiscovery
    if (config.hadiscovery.zones) {
      const defaultConfig = {
        icon: config.hadiscovery.zones.default.icon,
        device_class: config.hadiscovery.zones.default.device_class
      }
      // type config
      if (typeId) {
        if (config.hadiscovery.zones[typeId]) {
          defaultConfig.icon = config.hadiscovery.zones[typeId].icon || defaultConfig.icon
          defaultConfig.device_class = config.hadiscovery.zones[typeId].device_class || defaultConfig.device_class
        }
      }

      return defaultConfig
    }
  },
  /**
   * Check if feature is enabled in config
   * @param {*} config
   * @param {*} featureNames
   * @returns
   */
  isFeatureEnabled: function (config, featureNames) {
    if (!Array.isArray(featureNames)) {
      if (config.server.features.includes(featureNames)) {
        return true
      }
      loggerBasic.warn(`Feature ${featureNames} is disabled`)
      return false
    }
    for (let index = 0; index < featureNames.length; index++) {
      const element = featureNames[index]
      if (config.server.features.includes(element)) {
        return true
      }
    }
    loggerBasic.warn(`Features ${JSON.stringify(featureNames)} are disabled`)
    return false
  }

}
