
export const MessageCompare = function (obj1, obj2) {
  function diffString (key, value1, value2) {
    return `${key}(oldvalue=${value1},newvalue=${value2})`
  }

  const differences = []

  const keys = [...new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})])]

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]

    const value1 = obj1 ? obj1[key] : undefined
    const value2 = obj2 ? obj2[key] : undefined

    // ignoring lastChecked only if has a valid value on both
    if (key === 'lastChecked') {
      if (!value1 || !value2) {
        differences.push(diffString(key, value1, value2))
      } else {
        continue
      }
    }

    if (typeof value1 !== typeof value2) {
      differences.push(diffString(key, value1, value2))
    }
    if (typeof value1 === 'object') {
      // checking childs
      const childs = !MessageCompare(value1, value2)
      if (childs.length > 0) {
        differences.push(...childs)
      }
      // next
    } else if (value1 !== value2) {
      differences.push(diffString(key, value1, value2))
    }
  }

  return differences
}
