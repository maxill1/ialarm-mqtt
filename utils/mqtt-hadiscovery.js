/* eslint-disable no-template-curly-in-string */

const pjson = require('../package.json')
const configHandler = require('./config-handler')

module.exports = function (config, zonesToConfig, reset, deviceInfo) {
  const alarmId = `alarm_mqtt_${(deviceInfo && deviceInfo.mac && deviceInfo.mac.split(':').join('')) || 'meian'}`

  const deviceConfig = {
    identifiers: `${alarmId}`,
    manufacturer: 'Meian',
    model: deviceInfo.name,
    name: `${config.name || deviceInfo.name || 'Meian alarm'}`,
    sw_version: `ialarm-mqtt ${pjson.version}`
  }

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
        availability_topic: config.topics.availability,
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
        availability_topic: config.topics.availability,
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
        availability_topic: config.topics.availability,
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
        availability_topic: config.topics.availability,
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
        availability_topic: config.topics.availability,
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
  const configSwitchCancelTriggered = function () {
    let payload = ''
    if (!reset) {
      payload = {
        name: `${deviceConfig.name} clean triggered`,
        availability_topic: config.topics.availability,
        state_topic: config.topics.alarm.configStatus,
        value_template: '{{ value_json.cancel }}',
        command_topic: config.topics.alarm.command,
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

  const configIAlarm = function () {
    let payload = ''
    if (!reset) {
      payload = {
        name: deviceConfig.name,
        unique_id: `${alarmId}_unit`,
        device: deviceConfig,
        availability_topic: config.topics.availability,
        state_topic: config.topics.alarm.state,
        command_topic: config.topics.alarm.command,
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
      topic: _getTopic(config.hadiscovery.topics.alarmConfig),
      payload
    }
  }

  function configCleanup (zone, topic) {
    return {
      topic: _getTopic(topic, {
        zoneId: zone.id
      }),
      payload: ''
    }
  }

  this.createMessages = function () {
    const messages = []
    const zoneSize = reset ? 40 : zonesToConfig.length || 40
    for (let i = 0; i < zoneSize; i++) {
      let zone
      if (reset) {
        zone = { id: i + 1 }
      } else {
        zone = zonesToConfig[i]
        // disabled/not in use zone
        if (zone.typeId === 0) {
          console.log(`Ignoring unused zone ${zone.id}`)
          continue
        }
      }

      // cleanup old topics structures
      if (reset) {
        messages.push(configCleanup(zone, '${discoveryPrefix}/binary_sensor/ialarm/${zoneId}/config'))
        messages.push(configCleanup(zone, '${discoveryPrefix}/sensor/ialarm${zoneId}/battery/config'))
        // messages.push(configCleanup(zone, "${discoveryPrefix}/sensor/${zoneId}/battery/config"));
      }

      // binary sensors
      messages.push(configSensorFault(zone, i))
      messages.push(configSensorBattery(zone, i))
      messages.push(configSensorAlarm(zone, i))
      messages.push(configSensorConnectivity(zone, i))

      // bypass switches
      messages.push(configSwitchBypass(zone, i))
    }

    // switch to clear cache and discovery configs
    messages.push(configSwitchClearCache())
    messages.push(configSwitchClearDiscovery())
    // cancel alarm triggered
    messages.push(configSwitchCancelTriggered())

    // alarm state
    messages.push(configIAlarm())
    // last event
    messages.push(configSensorEvents())
    return messages
  }
}
