// 接待相关页面 / 组件测试的公共装载器：把 utils/data.js 换成假实现，按小程序 setData 语义（支持 'a.b' 路径）运行页面。
const path = require('node:path')

const dataPath = require.resolve('../utils/data.js')

function setPath(target, patch) {
  Object.keys(patch).forEach(key => {
    const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
    let o = target
    parts.slice(0, -1).forEach(k => {
      if (o[k] === undefined || o[k] === null) o[k] = {}
      o = o[k]
    })
    o[parts[parts.length - 1]] = patch[key]
  })
}

function withFakeData(fakeData, file, register) {
  const fullPath = require.resolve(path.join(__dirname, '..', file))
  const originalData = require.cache[dataPath]
  delete require.cache[fullPath]
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  let definition = null
  global[register] = value => { definition = value }
  try {
    require(fullPath)
  } finally {
    delete global[register]
    delete require.cache[fullPath]
    if (originalData) require.cache[dataPath] = originalData
    else delete require.cache[dataPath]
  }
  return definition
}

function loadPage(file, fakeData) {
  const def = withFakeData(fakeData, file, 'Page')
  const page = Object.assign({}, def, { data: JSON.parse(JSON.stringify(def.data)) })
  page.setData = function (patch) { setPath(this.data, patch) }
  Object.keys(def).filter(k => typeof def[k] === 'function').forEach(k => { page[k] = def[k].bind(page) })
  return page
}

function loadComponent(file, fakeData, properties) {
  const def = withFakeData(fakeData, file, 'Component')
  const events = []
  const instance = {
    data: JSON.parse(JSON.stringify(def.data)),
    properties: Object.assign({}, properties || {}),
    events,
    setData(patch) { setPath(this.data, patch) },
    triggerEvent(name, detail) { events.push({ name, detail }) }
  }
  Object.keys(def.methods).forEach(name => { instance[name] = def.methods[name].bind(instance) })
  return instance
}

const settle = () => new Promise(r => setTimeout(r, 10))
const tap = dataset => ({ currentTarget: { dataset } })

module.exports = { loadPage, loadComponent, settle, tap }
