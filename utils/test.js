import { MessageCompare } from './message-compare.js'

const cache = {
  /* configStatus: {
    cacheClear: 'OFF',
    discoveryClear: 'OFF',
    cancel: 'OFF',
    connectionStatus: {
      connected: true,
      message: 'OK',
      stack: '',
      date: {
      }
    }
  }, */
  zone_16: { id: 16, name: 'L15', status: 9, inUse: true, ok: false, alarm: false, bypass: false, lowbat: false, fault: false, wirelessLoss: false, message: 'Fault', problem: true }
}

const propertiesToChange = {
  configStatus: ['cancel'],
  zone_16: ['fault']
}

const value = {}

let counter = 1
setInterval(function () {
  for (const key in cache) {
    let valueChanged = value[key]
    if (!valueChanged) {
      value[key] = { ...cache[key] }
      valueChanged = value[key]
    }

    if (key) {
      if (counter % 5 === 0) {
        const props = propertiesToChange[key]
        props.forEach(name => {
          valueChanged[name] = !valueChanged[name]
        })
      }
    }

    const compare = MessageCompare(cache[key], valueChanged)
    if (compare.length > 0) {
      console.log(`Changed ${JSON.stringify(compare)}`)
      cache[key] = { ...valueChanged }
    }
  }

  counter++
}, 1000)
