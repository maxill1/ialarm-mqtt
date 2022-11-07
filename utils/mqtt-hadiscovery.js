/* eslint-disable no-template-curly-in-string */

import { MeianConstants, MeianLogger } from 'ialarm'
import { configHandler }  from './config-handler.js'
import pjson from '../package.json' assert { type: 'json' }

export default function (config, zonesToConfig, reset, deviceInfo) {
  const logger = MeianLogger(config.verbose ? 'debug' : 'info')

  const alarmId = `alarm_mqtt_${(deviceInfo && deviceInfo.mac && deviceInfo.mac.split(':').join('')) || 'meian'}`

  const deviceConfig = {
    identifiers: `${alarmId}`,
    manufacturer: 'Meian',
    model: deviceInfo.name,
    name: `${config.name || deviceInfo.name || 'Meian alarm'}`,
    sw_version: `ialarm-mqtt ${pjson.version}`
  }
  /*
  causes in validate_mapping raise er.MultipleInvalid(errors) voluptuous.error.MultipleInvalid: expected a list @ data['device']['connections'][0]
  if(deviceInfo.mac){
    deviceConfig.connections = ['mac', deviceInfo.mac.toLowerCase()]
  }*/

  function getZoneDevice (zone) {
    return {
      ...deviceConfig,
      identifiers: [
                `${alarmId}_zone_${zone.id}`
      ],
      name: `${deviceConfig.name} ${config.hadiscovery.zoneName} ${zone.id} ${zone.name}`,
      model: zone.type
    }
  }

  function getAvailability () {
    return [
      {
        topic: config.topics.availability,
        payload_available: config.payloads.alarmAvailable,
        payload_not_available: config.payloads.alarmNotvailable
      }
    ]
  }

  const _getTopic = function (topicTemplate, data) {
    if (!data) {
      data = {}
    }
    data.discoveryPrefix = config.hadiscovery.discoveryPrefix || 'homeassistant'
    let topic = topicTemplate
    for (const key in data) {
      const value = data[key]
      // ${key}
      topic = topic.replace('${' + key + '}', value)
    }
    return topic
  }

  /**
     * binary sensor for "fault" property
     * @param {*} zone
     * @param {*} i
     * @param {*} battery
     * @returns
     */
  const configSensorFault = function (zone, i) {
    const message = configBinarySensors(zone, i, 'Motion', 'safety', 'fault', config.hadiscovery.topics.sensorConfig, false)

    if (!reset) {
      const zoneName = config.hadiscovery.zoneName

      // optional
      let icon
      let deviceClass
      // priority to zone config
      const zoneConfig = configHandler.getZoneOverride(config, zone.id, zone.typeId)
      if (zoneConfig) {
        icon = zoneConfig.icon
        deviceClass = zoneConfig.device_class
      }

      const payload = {
        ...message.payload,
        name: zoneName + ' ' + zone.id + ' ' + zone.name,
        unique_id: `${alarmId}_zone_${zone.id}`
      }

      // icon is not supported on binary sensor, only switches, light, sensor, etc
      if (payload.state_topic.indexOf('/binary_sensor/') === -1) {
        payload.icon = icon
      }
      payload.device_class = deviceClass || 'safety' // default

      message.payload = payload
    }
    return message
  }

  /**
     * binary sensor for "lowbat" property
     * @param {*} zone
     * @param {*} i
     * @returns
     */
  const configSensorBattery = function (zone, i) {
    return configBinarySensors(zone, i, 'Battery', 'battery', 'lowbat', config.hadiscovery.topics.sensorBatteryConfig, false)
  }

  /**
     * binary sensor for "wirelessLoss" property
     * @param {*} zone
     * @param {*} i
     * @returns
     */
  const configSensorConnectivity = function (zone, i) {
    return configBinarySensors(zone, i, 'Connectivity', 'connectivity', 'wirelessLoss', config.hadiscovery.topics.sensorConnectivityConfig, true)
  }

  /**
     * binary sensor for "alarm" property
     * @param {*} zone
     * @param {*} i
     * @returns
     */
  const configSensorAlarm = function (zone, i) {
    return configBinarySensors(zone, i, 'Alarm', 'safety', 'alarm', config.hadiscovery.topics.sensorAlarmConfig, false)
  }

  /**
     * Binary sensors based on alarm booleans
     * @param {*} zone
     * @param {*} i
     * @param {*} type
     * @param {*} device_class
     * @param {*} statusProperty
     * @param {*} topic
     * @param {*} defaultOn
     * @returns
     */
  const configBinarySensors = function (zone, index, type, deviceClass, statusProperty, topic, defaultOn) {
    let payload = ''
    const zoneId = zone.id
    if (!reset) {
      let zoneName = config.hadiscovery.zoneName
      if (!zoneName) {
        zoneName = 'Zone'
      }
      let valueTemplate = `{{ '${config.payloads.sensorOn}' if value_json.${statusProperty} else '${config.payloads.sensorOff}' }}`
      if (defaultOn) {
        valueTemplate = `{{  '${config.payloads.sensorOff}' if value_json.${statusProperty} else '${config.payloads.sensorOn}' }}`
      }

      const stateTopic = _getTopic(config.topics.sensors.zone.state, {
        zoneId: zoneId
      })

      payload = {
        name: type + ' ' + zoneName + ' ' + zone.id + ' ' + zone.name,
        availability: getAvailability(),
        device_class: deviceClass,
        value_template: valueTemplate,
        payload_on: config.payloads.sensorOn,
        payload_off: config.payloads.sensorOff,
        json_attributes_topic: stateTopic,
        json_attributes_template: '{{ value_json | tojson }}',
        state_topic: stateTopic,
        unique_id: `${alarmId}_zone_${zone.id}_${type.toLowerCase()}`,
        device: getZoneDevice(zone),
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(topic, {
        zoneId: zoneId
      }),
      payload
    }
  }

  /**
     * Log event (last)
     * @returns
     */
  const configSensorEvents = function () {
    let payload = ''
    if (!reset) {
      payload = {
        name: config.hadiscovery.events.name
          ? config.hadiscovery.events.name
          : `${deviceConfig.name} last event`,
        availability: getAvailability(),
        state_topic: config.topics.alarm.event,
        value_template: '{{value_json.description}}',
        json_attributes_topic: config.topics.alarm.event,
        json_attributes_template: '{{ value_json | tojson }}',
        unique_id: `${alarmId}_events`,
        icon: config.hadiscovery.events.icon,
        device: deviceConfig,
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.eventsConfig),
      payload
    }
  }

  /**
     * Error log
     * @returns
     */
  const configConnectionStatus = function () {
    let payload = ''
    if (!reset) {
      payload = {
        name: `${deviceConfig.name} comunication status`,
        availability: getAvailability(),
        state_topic: config.topics.alarm.configStatus,
        value_template: '{{value_json.connectionStatus.connected}}',
        payload_on: true,
        payload_off: false,
        json_attributes_topic: config.topics.alarm.configStatus,
        json_attributes_template: '{{ value_json.connectionStatus | tojson }}',
        unique_id: `${alarmId}_connection_status`,
        icon: 'mdi:alert-circle',
        device: deviceConfig,
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.connectionConfig),
      payload
    }
  }

  /**
     * Bypass switch
     * @param {*} zone
     * @param {*} i
     * @returns
     */
  const configSwitchBypass = function (zone, index) {
    const zoneName = config.hadiscovery.zoneName || 'Zone'
    const bypassName = config.hadiscovery.bypass.name || 'Bypass'
    let payload = ''
    const zoneId = zone.id
    if (!reset) {
      const stateTopic = _getTopic(config.topics.sensors.zone.state, {
        zoneId: zoneId
      })

      payload = {
        name: bypassName + ' ' + zoneName + ' ' + zone.id + ' ' + zone.name,
        availability: getAvailability(),
        state_topic: stateTopic,
        value_template: `{{ '${config.payloads.sensorOn}' if value_json.bypass else '${config.payloads.sensorOff}' }}`,
        payload_on: config.payloads.sensorOn,
        payload_off: config.payloads.sensorOff,
        command_topic: _getTopic(config.topics.alarm.bypass, {
          zoneId: zoneId
        }),
        unique_id: `${alarmId}_zone_${zone.id}_bypass`,
        icon: config.hadiscovery.bypass.icon,
        device: getZoneDevice(zone),
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.bypassConfig, {
        zoneId: zoneId
      }),
      payload
    }
  }

  /**
    * switch to clear cached values
    * @param {*} zone
    * @param {*} i
    * @returns
    */
  const configSwitchClearCache = function () {
    let payload = ''
    if (!reset) {
      payload = {
        name: `${deviceConfig.name} clean cache`,
        availability: getAvailability(),
        state_topic: config.topics.alarm.configStatus,
        value_template: '{{ value_json.cacheClear }}',
        command_topic: config.topics.alarm.resetCache,
        payload_on: 'ON',
        payload_off: 'OFF',
        unique_id: `${alarmId}_clear_cache`,
        icon: 'mdi:reload-alert',
        device: deviceConfig,
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.clearCacheConfig),
      payload
    }
  }

  /**
    * switch to clear discovery
    * @param {*} zone
    * @param {*} i
    * @returns
    */
  const configSwitchClearDiscovery = function () {
    let payload = ''
    if (!reset) {
      payload = {
        name: `${deviceConfig.name} clean discovery`,
        availability: getAvailability(),
        state_topic: config.topics.alarm.configStatus,
        value_template: '{{ value_json.discoveryClear }}',
        command_topic: config.topics.alarm.discovery,
        payload_on: 'ON',
        payload_off: 'OFF',
        unique_id: `${alarmId}_clear_discovery`,
        icon: 'mdi:refresh',
        device: deviceConfig,
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.clearDiscoveryConfig),
      payload
    }
  }

  /**
     * switch to cancel triggered sensors alarms
     * @param {*} zone
     * @param {*} i
     * @returns
     */
  const configSwitchCancelTriggered = function (areaId) {
    let payload = ''
    if (!reset) {
      // only 1 switch for all areas?
      const commandTopic = _getTopic(config.topics.alarm.command, {
        areaId: areaId
      })
      payload = {
        name: `${deviceConfig.name} clean triggered`,
        availability: getAvailability(),
        state_topic: config.topics.alarm.configStatus,
        value_template: '{{ value_json.cancel }}',
        command_topic: commandTopic,
        payload_on: 'cancel',
        payload_off: 'OFF',
        unique_id: `${alarmId}_cancel_trigger`,
        icon: 'mdi:alarm-light',
        device: deviceConfig,
        qos: config.hadiscovery.sensors_qos
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.clearTriggeredConfig),
      payload
    }
  }

  const configIAlarm = function (areaId) {
    let payload = ''
    if (!reset) {
      const commandTopic = _getTopic(config.topics.alarm.command, {
        areaId: areaId
      })
      payload = {
        name: `${deviceConfig.name}${config.server.areas > 1 ? ' Area ' + areaId : ''}`,
        unique_id: `${alarmId}_unit${config.server.areas > 1 ? '_area' + areaId : ''}`,
        device: deviceConfig,
        availability: getAvailability(),
        state_topic: config.topics.alarm.state,
        value_template: `{{ value_json.status_${areaId} }}`,
        command_topic: commandTopic,
        payload_disarm: config.payloads.alarm.disarm,
        payload_arm_home: config.payloads.alarm.armHome,
        payload_arm_away: config.payloads.alarm.armAway,
        payload_available: config.payloads.alarmAvailable,
        payload_not_available: config.payloads.alarmNotvailable,
        qos: config.hadiscovery.alarm_qos
      }
      // optional
      if (config.hadiscovery.code) {
        payload.code = config.hadiscovery.code
      }
    }
    return {
      topic: _getTopic(config.hadiscovery.topics.alarmConfig, {
        areaId: areaId
      }),
      payload
    }
  }

  function configCleanup (topic, zone) {
    return {
      topic: _getTopic(topic, {
        zoneId: zone && zone.id,
        discoveryPrefix: config.hadiscovery.discoveryPrefix
      }),
      payload: ''
    }
  }

  this.createMessages = function () {
    const messages = []

    // cleanup old topics structures
    if (reset) {
      messages.push(configCleanup('${discoveryPrefix}/alarm_control_panel/ialarm/config'))
      messages.push(configCleanup('${discoveryPrefix}/sensor/ialarm/error/config'))
      messages.push(configCleanup('ialarm/alarm/error')) 
    }

    for (let i = 0; i < MeianConstants.maxZones; i++) {
      let zone
      if (reset) {
        zone = { id: i + 1 }
      } else {
        zone = zonesToConfig[i]
        // zone not found
        if (!zone) {
          logger.log('error', `HA discovery config: ignoring zone ${i} (GetZone did not return any info on this zone or it is filtered out via server.zones in config)`)
          continue
        }
        // disabled/not in use zone
        if (zone.typeId === 0) {
          logger.log('debug', `HA discovery config: ignoring unused zone ${zone.id} (it's configured as disabled on the alarm - typeId = 0)`)
          continue
        }
      }

      // cleanup old topics structures
      if (reset) {
        messages.push(configCleanup('${discoveryPrefix}/binary_sensor/ialarm/${zoneId}/config', zone))
        messages.push(configCleanup('${discoveryPrefix}/sensor/ialarm${zoneId}/battery/config', zone))
        // messages.push(configCleanup("${discoveryPrefix}/sensor/${zoneId}/battery/config", zone));
      }

      // binary sensors
      if (reset || configHandler.isFeatureEnabled(config, 'sensors')) {
        messages.push(configSensorFault(zone, i))
        messages.push(configSensorBattery(zone, i))
        messages.push(configSensorAlarm(zone, i))
        messages.push(configSensorConnectivity(zone, i))
      }

      // bypass switches
      if (reset || configHandler.isFeatureEnabled(config, 'bypass')) {
        messages.push(configSwitchBypass(zone, i))
      }
    }

    // switch to clear cache and discovery configs
    messages.push(configSwitchClearCache())
    messages.push(configSwitchClearDiscovery())

    // ok/errors
    messages.push(configConnectionStatus())

    if (reset || configHandler.isFeatureEnabled(config, 'armDisarm')) {
    // cancel alarm triggered ( TODO multiple switch for all areas?)
      messages.push(configSwitchCancelTriggered(1))

      // multiple alarm state for multiple area
      for (let areaId = 1; areaId <= config.server.areas; areaId++) {
        messages.push(configIAlarm(areaId))
      }
    }

    // last event
    if (reset || configHandler.isFeatureEnabled(config, 'events')) {
      messages.push(configSensorEvents())
    }

    return messages
  }
}
