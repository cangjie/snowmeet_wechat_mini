// 自定义导航栏必须让出手机状态栏。
// 2026-10-21：页面 json 设了 "navigationStyle": "custom" 却自己画顶栏，iPhone 上返回键和状态栏时间重叠，点不动。
// 规则：app.json 注册的每个页面（含分包、旧版演示 legacy），只要关掉系统导航栏，就必须用 components/safe_nav_bar。
// 旧版演示页面由 build_legacy.py 生成、不能改 wxml，生成时直接去掉 custom，所以它们也走同一条规则。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SAFE_NAV_PATH = '/components/safe_nav_bar/safe_nav_bar'

function readJson(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  return JSON.parse(text.replace(/^﻿/, ''))
}

function registeredPages() {
  const app = readJson('app.json')
  const pages = [...(app.pages || [])]
  for (const sub of app.subPackages || app.subpackages || []) {
    const root = sub.root.replace(/\/+$/, '')
    for (const p of sub.pages || []) pages.push(root + '/' + p)
  }
  return pages
}

function pageJson(page) {
  const rel = page + '.json'
  return fs.existsSync(path.join(ROOT, rel)) ? readJson(rel) : {}
}

test('app.json 全局不关系统导航栏', () => {
  const app = readJson('app.json')
  assert.notEqual((app.window || {}).navigationStyle, 'custom',
    '全局关掉系统导航栏会让所有页面都要自己处理状态栏，不允许')
})

test('关了系统导航栏的页面都用 safe-nav-bar', () => {
  const pages = registeredPages()
  assert.ok(pages.length > 100, '没读到 app.json 里的页面列表')

  const custom = pages.filter(p => pageJson(p).navigationStyle === 'custom')
  // 防止解析出错时这个测试静默通过
  assert.ok(custom.includes('pages/admin/reception/recept_new'), '没识别出已知的自定义导航栏页面')

  const problems = []
  for (const page of custom) {
    const json = pageJson(page)
    const using = json.usingComponents || {}
    if (using['safe-nav-bar'] !== SAFE_NAV_PATH) {
      problems.push(`${page}.json 没有注册 safe-nav-bar（${SAFE_NAV_PATH}）`)
    }
    const wxmlFile = path.join(ROOT, page + '.wxml')
    const wxml = fs.existsSync(wxmlFile) ? fs.readFileSync(wxmlFile, 'utf8') : ''
    // 去掉注释再找，注释里提到组件名不算
    if (!/<safe-nav-bar[\s/>]/.test(wxml.replace(/<!--[\s\S]*?-->/g, ''))) {
      problems.push(`${page}.wxml 没有使用 <safe-nav-bar>`)
    }
  }
  assert.deepEqual(problems, [], '自定义导航栏必须用 safe-nav-bar，否则 iPhone 上返回键会被状态栏挡住：\n' + problems.join('\n'))
})

test('旧版演示页面不关系统导航栏', () => {
  const legacy = registeredPages().filter(p => p.startsWith('legacy/'))
  assert.ok(legacy.length > 0, '没读到 legacy 分包')
  const custom = legacy.filter(p => pageJson(p).navigationStyle === 'custom')
  assert.deepEqual(custom, [], '旧版页面自己画的顶栏没让出状态栏，build_legacy.py 生成时应去掉 navigationStyle: custom')
})

// ---- utils/navbar.js ----

function loadNavbar(wxMock) {
  const prev = global.wx
  global.wx = wxMock
  const file = require.resolve('../utils/navbar.js')
  delete require.cache[file]
  const mod = require(file)
  return { mod, restore() { if (prev === undefined) delete global.wx; else global.wx = prev } }
}

test('导航栏高度按胶囊按钮位置计算', () => {
  const { mod, restore } = loadNavbar({
    getWindowInfo: () => ({ statusBarHeight: 47, windowWidth: 390 }),
    getMenuButtonBoundingClientRect: () => ({ top: 51, height: 32, left: 301 })
  })
  try {
    assert.deepEqual(mod.getNavMetrics(), {
      statusBarHeight: 47,
      navBarHeight: 40,   // (51 - 47) * 2 + 32
      totalHeight: 87,
      sideWidth: 89       // 390 - 301
    })
  } finally { restore() }
})

test('拿不到胶囊位置时用保守默认值，且不缓存', () => {
  let menuOk = false
  const { mod, restore } = loadNavbar({
    getWindowInfo: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    getMenuButtonBoundingClientRect: () => {
      if (!menuOk) throw new Error('not ready')
      return { top: 48, height: 32, left: 281 }
    }
  })
  try {
    assert.deepEqual(mod.getNavMetrics(), { statusBarHeight: 44, navBarHeight: 44, totalHeight: 88, sideWidth: 95 })
    menuOk = true
    assert.deepEqual(mod.getNavMetrics(), { statusBarHeight: 44, navBarHeight: 40, totalHeight: 84, sideWidth: 94 })
  } finally { restore() }
})

// ---- components/safe_nav_bar ----

function loadSafeNavBar() {
  let definition
  const prevComponent = global.Component
  global.Component = value => { definition = value }
  const file = require.resolve('../components/safe_nav_bar/safe_nav_bar.js')
  delete require.cache[file]
  require(file)
  if (prevComponent === undefined) delete global.Component; else global.Component = prevComponent
  return definition
}

function runBack({ autoBack = true, stackSize, homeUrl = '/pages/admin/reception/recept_entry' }) {
  const def = loadSafeNavBar()
  const calls = { events: [], back: 0, relaunch: [] }
  const prevWx = global.wx
  const prevPages = global.getCurrentPages
  global.wx = {
    navigateBack() { calls.back += 1 },
    reLaunch(opt) { calls.relaunch.push(opt.url) }
  }
  global.getCurrentPages = () => new Array(stackSize).fill({})
  try {
    const ctx = {
      properties: { autoBack, homeUrl },
      triggerEvent(name) { calls.events.push(name) }
    }
    def.methods.onBackTap.call(ctx)
  } finally {
    if (prevWx === undefined) delete global.wx; else global.wx = prevWx
    if (prevPages === undefined) delete global.getCurrentPages; else global.getCurrentPages = prevPages
  }
  return calls
}

test('返回键：有上一页时 navigateBack', () => {
  const calls = runBack({ stackSize: 2 })
  assert.equal(calls.back, 1)
  assert.deepEqual(calls.relaunch, [])
  assert.deepEqual(calls.events, ['back'])
})

test('返回键：从分享或扫码直接打开（只有一页）时回 homeUrl', () => {
  const calls = runBack({ stackSize: 1 })
  assert.equal(calls.back, 0)
  assert.deepEqual(calls.relaunch, ['/pages/admin/reception/recept_entry'])
})

test('返回键：autoBack=false 只通知页面，不自己跳转', () => {
  const calls = runBack({ autoBack: false, stackSize: 2 })
  assert.equal(calls.back, 0)
  assert.deepEqual(calls.relaunch, [])
  assert.deepEqual(calls.events, ['back'])
})
