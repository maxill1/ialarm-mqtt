const value1 = [{ id: 1, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Ingresso', type: 'Ritardata', problem: false }, { id: 2, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Soggiorno 3F', type: '', problem: false }, { id: 3, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Soggiorno 2F', type: '', problem: false }, { id: 4, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'PIR Soggiorno', type: 'Interna', problem: false }, { id: 5, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'BagnoSu', type: '', problem: false }, { id: 6, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Cucina', type: '', problem: false }, { id: 7, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Alice 1', type: '', problem: false }, { id: 8, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Alice 2', type: '', problem: false }, { id: 9, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'BagnoGiu', type: '', problem: false }, { id: 10, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Camera', type: '', problem: false }, { id: 11, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Mansarda', type: '', problem: false }, { id: 12, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Giardino', type: '', problem: false }, { id: 13, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Viale', type: '', problem: false }, { id: 14, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'PIR Zona notte', type: 'Interna', problem: false }, { id: 15, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'PIR Mans', type: 'Interna', problem: false }, { id: 16, status: '16', lastChecked: '2020-01-21T20:39:28.384Z', message: 'zone fault', ok: false, alarm: false, bypass: false, lowbat: false, fault: false, open: true, name: 'Allagame', type: '24 ore', problem: true }, { id: 17, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Gas', type: '24 ore', problem: false }]
const value2 = [{ id: 1, status: '0', lastChecked: '2020-01-21T20:55:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Ingresso', type: 'Ritardata', problem: false }, { id: 2, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Soggiorno 3F', type: '', problem: false }, { id: 3, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Soggiorno 2F', type: '', problem: false }, { id: 4, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'PIR Soggiorno', type: 'Interna', problem: false }, { id: 5, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'BagnoSu', type: '', problem: false }, { id: 6, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Cucina', type: '', problem: false }, { id: 7, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Alice 1', type: '', problem: false }, { id: 8, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Alice 2', type: '', problem: false }, { id: 9, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'BagnoGiu', type: '', problem: false }, { id: 10, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Camera', type: '', problem: false }, { id: 11, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Mansarda', type: '', problem: false }, { id: 12, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Giardino', type: '', problem: false }, { id: 13, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Viale', type: '', problem: false }, { id: 14, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'PIR Zona notte', type: 'Interna', problem: false }, { id: 15, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'PIR Mans', type: 'Interna', problem: false }, { id: 16, status: '16', lastChecked: '2020-01-21T20:39:28.384Z', message: 'zone fault', ok: false, alarm: false, bypass: false, lowbat: false, fault: false, open: true, name: 'Allagame', type: '24 ore', problem: true }, { id: 17, status: '0', lastChecked: '2020-01-21T20:39:28.384Z', message: 'OK', ok: true, alarm: false, bypass: false, lowbat: false, fault: false, open: false, name: 'Gas', type: '24 ore', problem: false }]

const _cache = {
  data: {},
  enabled: true,
  time: (function () {
    const expr = '5m'
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
        console.log('Using default cache: 5m')
        // default 5 min
        return 5 * 60000
      }
      return expr.substring(0, expr.length - 1) * molt
    }
    return 0
  }())
}
const topic = 'test'
_cache.data[topic] = { payload: value1, lastChecked: value1.lastChecked || new Date() }

const _cacheExpireDate = function (date) {
  return new Date(date.getTime() + _cache.time)
}

const _sameData = function (topic, obj2) {
  if (!_cache.enabled || !_cache.data[topic] || !_cache.data[topic].lastChecked || new Date() > _cacheExpireDate(_cache.data[topic].lastChecked) || topic.endsWith('/config')) {
    return false
  }

  const obj1 = _cache.data[topic].payload
  return _sameObject(obj1, obj2)
}

const _sameObject = function (obj1, obj2) {
  if (Object.keys(obj1).length != Object.keys(obj2).length) {
    return false
  }
  for (const key in obj1) {
    if (key === 'lastChecked') {
      continue
    }
    if (obj1[key]) {
      const value1 = obj1[key]
      const value2 = obj2[key]
      if (typeof value1 !== typeof value2) {
        return false
      }
      if (typeof value1 === 'object') {
        return _sameObject(value1, value2)
      }
      if (value1 !== value2) {
        return false
      }
    }
  }
  return true
}

let counter = 1
setInterval(function () {
  if (counter % 5 == 0) {
    value2[0].fault = !value2[0].fault
    value2[0].problem = !value2[0].problem
    value2[0].ok = !value2[0].ok
  }
  console.log(_sameData(topic, value2))
  counter++
}, 1000)
