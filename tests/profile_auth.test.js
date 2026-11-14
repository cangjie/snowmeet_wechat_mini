// 顾客验证手机号之后授权头像和昵称（2026-11-14 用户要求）的共用逻辑 utils/profile_auth.js、
// 两个数据接口（getMyProfilePromise / saveMyProfilePromise）和 profile-auth 弹层组件。
//   · 头像存 S3、member 表记昵称 / 头像 / 更新时间：后端 MemberProfileController
//   · 可以跳过；已经有资料的会员不再弹；接口失败（比如后端还没部署）静默不弹，不拦任何现有流程
//   · 页面在手机号验证成功后 await ensure()，再继续自己的后续步骤（自动支付、跳转、轮询……）
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { loadComponent, settle } = require('./reception_harness.js')

const ROOT = path.join(__dirname, '..')
const profileAuth = require('../utils/profile_auth.js')

// ---------- 纯函数 ----------

test('昵称清洗：去控制字符和首尾空白，最多 32 个字，和后端口径一致', () => {
  assert.equal(profileAuth.cleanNickName('  雪友小明 '), '雪友小明')
  assert.equal(profileAuth.cleanNickName('a\u0000b\u0007c'), 'abc')
  assert.equal(profileAuth.cleanNickName('小 明'), '小 明', '中间的空格保留')
  assert.equal(profileAuth.cleanNickName(''), '')
  assert.equal(profileAuth.cleanNickName(null), '')
  assert.equal(profileAuth.cleanNickName(undefined), '')
  assert.equal(profileAuth.cleanNickName('\t\n '), '')
  assert.equal(profileAuth.cleanNickName('甲'.repeat(40)), '甲'.repeat(32))
  // 表情是两个 UTF-16 单元，按一个字算，不能切成半个
  const cut = profileAuth.cleanNickName('甲'.repeat(31) + '🙂🙂')
  assert.equal(cut, '甲'.repeat(31) + '🙂')
})

test('能不能保存：头像和昵称至少有一样', () => {
  assert.equal(profileAuth.canSave('雪友', ''), true)
  assert.equal(profileAuth.canSave('', 'http://tmp/a.jpg'), true)
  assert.equal(profileAuth.canSave('雪友', 'http://tmp/a.jpg'), true)
  assert.equal(profileAuth.canSave('', ''), false)
  assert.equal(profileAuth.canSave('   ', null), false, '纯空白昵称当没填')
})

test('要不要弹只看后端说的：code 0 且 needProfile 才弹，其它（失败、没返回、旧后端 404）都不弹', () => {
  assert.equal(profileAuth.needPrompt({ code: 0, data: { needProfile: true } }), true)
  assert.equal(profileAuth.needPrompt({ code: 0, data: { needProfile: false } }), false)
  assert.equal(profileAuth.needPrompt({ code: 1, message: 'x', data: { needProfile: true } }), false)
  assert.equal(profileAuth.needPrompt({ code: 0 }), false)
  assert.equal(profileAuth.needPrompt(null), false)
  assert.equal(profileAuth.needPrompt(undefined), false)
  assert.equal(profileAuth.needPrompt('Not Found'), false)
})

test('同一次运行里保存或跳过过就不再弹：按登录会话记，换了会话（重新登录）才会再问', () => {
  const g = {}
  assert.equal(profileAuth.isDone(g, 'k1'), false)
  profileAuth.markDone(g, 'k1')
  assert.equal(profileAuth.isDone(g, 'k1'), true)
  assert.equal(profileAuth.isDone(g, 'k2'), false)
  assert.equal(profileAuth.isDone(undefined, 'k1'), false)
  assert.doesNotThrow(() => profileAuth.markDone(undefined, 'k1'))
})

test('ensureOn：页面里没有 profile-auth 组件、组件没有 ensure、组件抛错，都当作没事，不拦后续流程', async () => {
  assert.equal(await profileAuth.ensureOn(null), undefined)
  assert.equal(await profileAuth.ensureOn({}), undefined)
  assert.equal(await profileAuth.ensureOn({ selectComponent: () => null }), undefined)
  assert.equal(await profileAuth.ensureOn({ selectComponent: () => ({}) }), undefined)
  assert.equal(await profileAuth.ensureOn({ selectComponent() { throw new Error('boom') } }), undefined)
  assert.equal(await profileAuth.ensureOn({ selectComponent: () => ({ ensure: () => Promise.reject(new Error('x')) }) }), undefined)
  let asked = null
  const owner = { selectComponent(sel) { asked = sel; return { ensure: () => Promise.resolve('done') } } }
  await profileAuth.ensureOn(owner)
  assert.equal(asked, '#profileAuth')
})

// ---------- 数据接口 ----------

function loadData(wxApi, globalData) {
  const dataPath = require.resolve('../utils/data.js')
  const saved = { app: global.getApp, wx: global.wx, cache: require.cache[dataPath] }
  global.getApp = () => ({ globalData: Object.assign({ requestPrefix: 'https://t.test/api/', domainName: 't.test' }, globalData || {}) })
  global.wx = wxApi
  delete require.cache[dataPath]
  const data = require(dataPath)
  return {
    data,
    restore() {
      delete require.cache[dataPath]
      if (saved.cache) require.cache[dataPath] = saved.cache
      if (saved.app) global.getApp = saved.app; else delete global.getApp
      if (saved.wx) global.wx = saved.wx; else delete global.wx
    }
  }
}

test('getMyProfilePromise：GET，会话密钥编码进 query；网络错 / 非 200 都 resolve(null)，不抛、不弹提示', async () => {
  const calls = []
  let respond = { statusCode: 200, data: { code: 0, data: { needProfile: true } } }
  const { data, restore } = loadData({
    request(o) { calls.push(o); if (respond === 'fail') o.fail({ errMsg: 'request:fail' }); else o.success(respond) },
    showToast() { throw new Error('静默接口不能弹提示') },
  })
  try {
    const ok = await data.getMyProfilePromise('a b+c')
    assert.equal(ok.data.needProfile, true)
    assert.equal(calls[0].method, 'GET')
    assert.equal(calls[0].url, 'https://t.test/api/MemberProfile/GetMyProfile?sessionKey=a%20b%2Bc&sessionType=wechat_mini_openid')
    respond = { statusCode: 404, data: 'Not Found' }
    assert.equal(await data.getMyProfilePromise('k'), null)
    respond = 'fail'
    assert.equal(await data.getMyProfilePromise('k'), null)
  } finally { restore() }
})

test('saveMyProfilePromise：选了头像用 wx.uploadFile（文件字段 avatar，昵称放表单）；只改昵称用表单编码的 wx.request', async () => {
  const uploads = [], requests = []
  const { data, restore } = loadData({
    uploadFile(o) { uploads.push(o); o.success({ statusCode: 200, data: JSON.stringify({ code: 0, data: { nickName: '雪友' } }) }) },
    request(o) { requests.push(o); o.success({ statusCode: 200, data: { code: 0, data: { nickName: '雪友' } } }) },
  })
  try {
    const withAvatar = await data.saveMyProfilePromise({ sessionKey: 'k1', nickName: '雪友', avatarPath: 'http://tmp/a.jpg' })
    assert.equal(withAvatar.code, 0)
    assert.equal(uploads.length, 1)
    assert.equal(uploads[0].filePath, 'http://tmp/a.jpg')
    assert.equal(uploads[0].name, 'avatar')
    assert.deepEqual(uploads[0].formData, { nickName: '雪友' })
    assert.equal(uploads[0].url, 'https://t.test/api/MemberProfile/SaveMyProfile?sessionKey=k1&sessionType=wechat_mini_openid')
    assert.equal(requests.length, 0)

    const nickOnly = await data.saveMyProfilePromise({ sessionKey: 'k1', nickName: '雪友', avatarPath: '' })
    assert.equal(nickOnly.code, 0)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'POST')
    assert.equal(requests[0].header['content-type'], 'application/x-www-form-urlencoded')
    assert.deepEqual(requests[0].data, { nickName: '雪友' })
    assert.equal(uploads.length, 1, '没选头像不上传文件')
  } finally { restore() }
})

test('saveMyProfilePromise：HTTP 非 2xx（wx.uploadFile 对任何状态码都走 success）、坏 JSON、网络失败都 reject', async () => {
  let mode = 'http500'
  const { data, restore } = loadData({
    uploadFile(o) {
      if (mode === 'http500') o.success({ statusCode: 500, data: 'oops' })
      else if (mode === 'badjson') o.success({ statusCode: 200, data: '<html>' })
      else o.fail({ errMsg: 'uploadFile:fail' })
    },
    request(o) { o.success({ statusCode: 502, data: '' }) },
  })
  try {
    for (const m of ['http500', 'badjson', 'netfail']) {
      mode = m
      await assert.rejects(data.saveMyProfilePromise({ sessionKey: 'k', nickName: 'x', avatarPath: 'http://tmp/a.jpg' }), undefined, m)
    }
    await assert.rejects(data.saveMyProfilePromise({ sessionKey: 'k', nickName: 'x', avatarPath: '' }))
  } finally { restore() }
})

// ---------- 弹层组件 ----------

function setupComponent(t, { profile, saveResult, sessionKey = 'sess-1' } = {}) {
  const calls = { get: 0, save: [], toasts: [] }
  // getApp() 在真机上每次返回同一个对象，globalData 里记的「本次运行已处理」才会一直在
  const app = { globalData: { sessionKey, requestPrefix: 'https://t.test/api/' } }
  global.getApp = () => app
  global.wx = { showToast(o) { calls.toasts.push(o) } }
  t.after(() => { delete global.getApp; delete global.wx })
  const fakeData = {
    getMyProfilePromise: async () => { calls.get++; return profile === undefined ? { code: 0, data: { needProfile: true } } : profile },
    saveMyProfilePromise: async body => {
      calls.save.push(body)
      if (saveResult instanceof Error) throw saveResult
      return saveResult || { code: 0, data: { nickName: body.nickName } }
    },
  }
  const c = loadComponent('components/profile_auth/profile_auth.js', fakeData)
  return { c, calls, app }
}

test('组件：后端说不用弹 / 接口失败 / 没有登录会话 → ensure 立即完成，不弹层', async t => {
  for (const profile of [{ code: 0, data: { needProfile: false } }, null, { code: 1, message: 'x' }]) {
    const { c } = setupComponent(t, { profile })
    await c.ensure()
    assert.equal(c.data.visible, false)
  }
  const noSession = setupComponent(t, { sessionKey: '' })
  await noSession.c.ensure()
  assert.equal(noSession.calls.get, 0, '没有会话密钥就不去问后端')
  assert.equal(noSession.c.data.visible, false)
})

test('组件：需要弹时 ensure 一直等到用户保存或跳过才完成（页面据此决定什么时候继续下一步）', async t => {
  const { c } = setupComponent(t)
  let finished = false
  const done = c.ensure().then(() => { finished = true })
  await settle()
  assert.equal(c.data.visible, true)
  assert.equal(finished, false, '弹层开着，流程要等')
  await c.onSkip()
  await done
  assert.equal(finished, true)
  assert.equal(c.data.visible, false)
})

test('组件：选头像 + 填昵称后保存 → 调保存接口（昵称是清洗后的）、关闭弹层、提示已保存', async t => {
  const { c, calls } = setupComponent(t)
  const done = c.ensure()
  await settle()
  assert.equal(c.data.canSave, false, '什么都没填时保存按钮不可用')
  c.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/avatar.jpg' } })
  assert.equal(c.data.avatarPath, 'http://tmp/avatar.jpg')
  assert.equal(c.data.canSave, true)
  c.onNickInput({ detail: { value: '  雪友小明 ' } })
  await c.onSave()
  await done
  assert.equal(calls.save.length, 1)
  assert.deepEqual(calls.save[0], { sessionKey: 'sess-1', nickName: '雪友小明', avatarPath: 'http://tmp/avatar.jpg' })
  assert.equal(c.data.visible, false)
  assert.ok(calls.toasts.some(x => /已保存/.test(x.title)))
})

test('组件：只填昵称也能保存（不带头像）', async t => {
  const { c, calls } = setupComponent(t)
  const done = c.ensure()
  await settle()
  c.onNickInput({ detail: { value: '雪友' } })
  await c.onSave()
  await done
  assert.deepEqual(calls.save[0], { sessionKey: 'sess-1', nickName: '雪友', avatarPath: '' })
})

test('组件：保存失败（后端说不行 / 网络错）弹层不关、流程不放行，给出原因，可以重试或跳过', async t => {
  for (const saveResult of [{ code: 1, message: '头像图片太大，请换一张小一点的' }, new Error('uploadFile:fail')]) {
    const { c, calls } = setupComponent(t, { saveResult })
    let finished = false
    const done = c.ensure().then(() => { finished = true })
    await settle()
    c.onNickInput({ detail: { value: '雪友' } })
    await c.onSave()
    await settle()
    assert.equal(finished, false)
    assert.equal(c.data.visible, true)
    assert.equal(c.data.saving, false, '按钮要能再点')
    assert.ok(c.data.error, '要告诉用户为什么没成功')
    assert.match(c.data.error, saveResult instanceof Error ? /网络/ : /太大/, '后端给的原因要原样给用户看；网络错给通用提示')
    await c.onSkip()
    await done
    assert.equal(finished, true)
    assert.equal(calls.save.length, 1)
  }
})

test('组件：什么都没填点保存不发请求；保存中再点不重复发', async t => {
  const { c, calls } = setupComponent(t)
  const done = c.ensure()
  await settle()
  await c.onSave()
  assert.equal(calls.save.length, 0)
  assert.ok(c.data.error)
  c.onNickInput({ detail: { value: '雪友' } })
  const first = c.onSave()
  const second = c.onSave()
  await Promise.all([first, second])
  await done
  assert.equal(calls.save.length, 1)
})

test('组件：跳过 / 保存之后，同一个登录会话里再 ensure 不会再弹，也不再问后端；换了会话才会再问', async t => {
  const { c, calls, app } = setupComponent(t)
  const first = c.ensure()
  await settle()
  await c.onSkip()
  await first
  assert.equal(calls.get, 1)

  await c.ensure()
  assert.equal(c.data.visible, false)
  assert.equal(calls.get, 1, '本次运行已经问过，不再问后端')

  app.globalData.sessionKey = 'sess-2'
  const again = c.ensure()
  await settle()
  assert.equal(c.data.visible, true, '重新登录（新会话）后再验证手机号，还会问')
  await c.onSkip()
  await again
})

test('组件：弹着的时候又来一次 ensure，共用同一次等待，不会弹第二层', async t => {
  const { c, calls } = setupComponent(t)
  const a = c.ensure()
  const b = c.ensure()
  await settle()
  assert.equal(calls.get, 1)
  await c.onSkip()
  await Promise.all([a, b])
})

test('组件：页面销毁时（detached）弹层还开着，等待要放开，不能让页面流程永远卡住', async t => {
  const { c } = setupComponent(t)
  let finished = false
  const done = c.ensure().then(() => { finished = true })
  await settle()
  c.invokeLifecycle('detached')
  await done
  assert.equal(finished, true)
})

test('组件模板：头像用 chooseAvatar 按钮，昵称用 type="nickname" 输入框，有「保存」「跳过」，不收集别的', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'components/profile_auth/profile_auth.wxml'), 'utf8')
  assert.match(wxml, /open-type="chooseAvatar"/)
  assert.match(wxml, /bind:?chooseavatar="onChooseAvatar"/)
  assert.match(wxml, /<input[^>]*type="nickname"/)
  assert.match(wxml, /bindtap="onSkip"/)
  assert.match(wxml, /bindtap="onSave"/)
  assert.match(wxml, /wx:if="\{\{visible\}\}"/)
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'components/profile_auth/profile_auth.json'), 'utf8'))
  assert.equal(json.component, true)
})

test('组件在 app.json 里全局注册为 profile-auth', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  assert.equal(app.usingComponents['profile-auth'], '/components/profile_auth/profile_auth')
})
