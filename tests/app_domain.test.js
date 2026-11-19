// 小程序「选择环境」（我的 → 选择环境）：选的域名存在 USER_DATA_PATH/domain.txt，启动时读回来，API 前缀跟着变。
// 2026-11-19：之前 getDomain 没人调用、setDomain 也不更新 globalData.requestPrefix，选了环境 API 前缀还是线上，选择环境形同虚设。
// 安全规则：正式版永远用线上域名；只认线上域名和本机（localhost / 127.0.0.1 带端口），其它（比如已注销的旧测试域名）一律当没选。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const authSession = require('../utils/authSession.js')
const tabbar = require('../utils/tabbar.js')

// 运行真实 App 定义，只替换微信和网络边界；files 是模拟的 USER_DATA_PATH 目录（文件名 → 内容）
function loadApp({ envVersion = 'trial', files = {}, noFileSystem = false } = {}) {
  const app = {}
  const calls = { requests: [], writes: [] }
  const wx = {
    login(options) { queueMicrotask(() => options.success({ code: 'code-1' })) },
    getAccountInfoSync() { return { miniProgram: { envVersion } } },
    getDeviceInfo() { return {} },
    getWindowInfo() { return { windowWidth: 375 } },
    getAppBaseInfo() { return {} },
    getSystemInfoAsync(options) { options.success({ windowWidth: 375 }); options.complete({}) },
    getNetworkType(o) { queueMicrotask(() => o.success({ networkType: 'wifi' })) },
    redirectTo() {},
    env: { USER_DATA_PATH: '/user' }
  }
  if (!noFileSystem) {
    wx.getFileSystemManager = () => ({
      readFileSync(file) {
        const name = file.replace('/user/', '')
        if (!(name in files)) throw new Error('no such file ' + name)
        return files[name]
      },
      writeFileSync(file, content) { calls.writes.push([file, content]); files[file.replace('/user/', '')] = content }
    })
  }
  const util = {
    performWebRequest(url) { calls.requests.push(url); return Promise.resolve({ session_key: 'k', member: { id: 7 }, staff: { id: 8 } }) }
  }
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8').replace(/^import fuiConfig[^\n]*\n/, 'const fuiConfig = {}\n')
  vm.runInNewContext(source, {
    App(definition) {
      Object.assign(app, definition)
      app.globalData = Object.assign({}, definition.globalData)
    },
    getApp: () => app,
    wx,
    require(name) {
      if (name === './utils/authSession.js') return authSession
      if (name === './utils/tabbar.js') return tabbar
      return util
    },
    console: { log() {}, warn() {} }
  }, { filename: 'app.js' })
  return { app, calls, files }
}

const PROD = 'mini.snowmeet.top'

test('没有选过环境：用线上域名，也不会去写 domain.txt', () => {
  const { app, calls } = loadApp()
  assert.equal(app.getDomain(), PROD)
  assert.equal(app.globalData.domainName, PROD)
  assert.equal(app.globalData.requestPrefix, 'https://mini.snowmeet.top/api/')
  assert.deepEqual(calls.writes, [])
})

test('开发版 / 体验版：domain.txt 里是 localhost:端口，启动时 API 前缀就是本机', () => {
  for (const envVersion of ['develop', 'trial']) {
    const { app } = loadApp({ envVersion, files: { 'domain.txt': 'localhost:5001' } })
    assert.equal(app.getDomain(), 'localhost:5001')
    assert.equal(app.globalData.domainName, 'localhost:5001')
    assert.equal(app.globalData.requestPrefix, 'https://localhost:5001/api/')
  }
})

test('127.0.0.1 带端口也认；文件内容两端的空白和换行不影响', () => {
  assert.equal(loadApp({ files: { 'domain.txt': '127.0.0.1:5001' } }).app.getDomain(), '127.0.0.1:5001')
  assert.equal(loadApp({ files: { 'domain.txt': 'localhost:5001\n' } }).app.getDomain(), 'localhost:5001')
  assert.equal(loadApp({ files: { 'domain.txt': '  mini.snowmeet.top ' } }).app.getDomain(), PROD)
})

test('正式版永远用线上域名：就算 domain.txt 里写着 localhost 也不看', () => {
  const { app } = loadApp({ envVersion: 'release', files: { 'domain.txt': 'localhost:5001' } })
  assert.equal(app.getDomain(), PROD)
  assert.equal(app.globalData.requestPrefix, 'https://mini.snowmeet.top/api/')
})

test('不认识的域名一律当没选：已注销的旧测试域名、别的域名、不带端口的 localhost、乱码', () => {
  for (const text of ['snowmeet.wanlonghuaxue.com', 'evil.example.com', 'localhost', 'localhost:', 'localhost:abc', 'https://localhost:5001', 'localhost:5001/api', '', 'localhost:5001 evil.com']) {
    const { app } = loadApp({ files: { 'domain.txt': text } })
    assert.equal(app.getDomain(), PROD, JSON.stringify(text))
    assert.equal(app.globalData.requestPrefix, 'https://mini.snowmeet.top/api/', JSON.stringify(text))
  }
})

test('读文件出错（没有这个文件系统、没有 domain.txt）不抛异常，回到线上域名', () => {
  assert.equal(loadApp({ noFileSystem: true }).app.getDomain(), PROD)
  assert.equal(loadApp({ files: {} }).app.getDomain(), PROD)
})

test('setDomain：写文件，并且 API 前缀、域名一起更新（以前只更新 App 上的属性，globalData 没变）', () => {
  const { app, calls } = loadApp()
  app.setDomain('localhost:5001')
  assert.deepEqual(calls.writes, [['/user/domain.txt', 'localhost:5001']])
  assert.equal(app.globalData.domainName, 'localhost:5001')
  assert.equal(app.globalData.requestPrefix, 'https://localhost:5001/api/')
  app.setDomain(PROD)
  assert.equal(app.globalData.requestPrefix, 'https://mini.snowmeet.top/api/')
})

test('setDomain 写文件失败也要把前缀切过去（本次运行里生效）', () => {
  const { app } = loadApp({ noFileSystem: true })
  assert.doesNotThrow(() => app.setDomain('localhost:5001'))
  assert.equal(app.globalData.requestPrefix, 'https://localhost:5001/api/')
})

test('启动登录用的是选好的域名：登录请求发到 localhost:5001', async () => {
  const { app, calls } = loadApp({ files: { 'domain.txt': 'localhost:5001' } })
  await app.loginPromiseNew
  assert.match(calls.requests[0], /^https:\/\/localhost:5001\/api\/MiniAppHelper\/MemberLogin\?code=code-1/)
})

test('没选环境时登录请求照旧发到线上域名', async () => {
  const { app, calls } = loadApp()
  await app.loginPromiseNew
  assert.match(calls.requests[0], /^https:\/\/mini\.snowmeet\.top\/api\/MiniAppHelper\/MemberLogin/)
})

test('onLaunch 一开始就应用选好的环境（在别的请求之前）', () => {
  const src = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8')
  const launch = src.slice(src.indexOf('onLaunch: function (res) {'))
  assert.ok(launch.indexOf('this.getDomain()') > 0 && launch.indexOf('this.getDomain()') < launch.indexOf('wx.getUpdateManager()'))
})
