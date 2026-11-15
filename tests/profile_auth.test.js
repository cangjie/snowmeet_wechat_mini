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

function setupComponent(t, { profile, saveResult, sessionKey = 'sess-1', modalConfirm = true, privacy = 'unsupported' } = {}) {
  const calls = { get: 0, save: [], toasts: [], modals: [], privacyAsked: 0, privacyChecked: 0 }
  // getApp() 在真机上每次返回同一个对象，globalData 里记的「本次运行已处理」才会一直在
  const app = { globalData: { sessionKey, requestPrefix: 'https://t.test/api/' } }
  global.getApp = () => app
  global.wx = { showToast(o) { calls.toasts.push(o) }, showModal(o) { calls.modals.push(o); if (o.success) o.success({ confirm: modalConfirm }) } }
  // 隐私协议授权的模拟：unsupported 没有这两个接口（旧基础库）；agreed 已同意；accept / refuse 还没同意，弹出系统弹窗后同意 / 拒绝
  if (privacy !== 'unsupported') {
    global.wx.getPrivacySetting = o => { calls.privacyChecked++; if (privacy === 'check-fails') o.fail({ errMsg: 'x' }); else o.success({ needAuthorization: privacy === 'accept' || privacy === 'refuse' }) }
    global.wx.requirePrivacyAuthorize = o => { calls.privacyAsked++; setTimeout(() => { if (privacy === 'refuse') o.fail({ errno: 104 }); else o.success({}) }, 20) }
  }
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
  assert.match(wxml, /<form[^>]*bindsubmit="onSubmit"/, '保存走表单提交，保存那一刻才读昵称框的内容，不会漏掉')
  assert.match(wxml, /<input[^>]*name="nickName"/)
  assert.match(wxml, /<button[^>]*form-type="submit"/)
  assert.match(wxml, /wx:if="\{\{visible\}\}"/)
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'components/profile_auth/profile_auth.json'), 'utf8'))
  assert.equal(json.component, true)
})

test('组件在 app.json 里全局注册为 profile-auth', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  assert.equal(app.usingComponents['profile-auth'], '/components/profile_auth/profile_auth')
})

// ---------- 已经绑过手机号的老会员：在「我的」页、顾客付款页补问（2026-11-15 用户要求） ----------

test('已有资料的判断：code 0、不用弹、并且有更新时间（有会员且存过资料）才算「已有资料」；没会员的会话不算', () => {
  assert.equal(profileAuth.hasProfile({ code: 0, data: { needProfile: false, updateDate: '2026-11-15T08:00:00' } }), true)
  assert.equal(profileAuth.hasProfile({ code: 0, data: { needProfile: false, updateDate: null } }), false, '没验证手机号的会话也是不用弹，但不是已有资料')
  assert.equal(profileAuth.hasProfile({ code: 0, data: { needProfile: true, updateDate: null } }), false)
  assert.equal(profileAuth.hasProfile({ code: 1, data: { updateDate: 'x' } }), false)
  assert.equal(profileAuth.hasProfile(null), false)
  assert.equal(profileAuth.hasProfile(undefined), false)
})

test('组件：后端说这个会员已经有资料，记下来，本次运行里 ensure 不再每次都去问后端（「我的」页每次显示都会调）', async t => {
  const { c, calls } = setupComponent(t, { profile: { code: 0, data: { needProfile: false, updateDate: '2026-11-15T08:00:00', nickName: '雪友' } } })
  await c.ensure()
  await c.ensure()
  await c.ensure()
  assert.equal(calls.get, 1)
  assert.equal(c.data.visible, false)
})

test('组件：会话还没有会员（没验证手机号）时的「不用弹」不能记成已有资料，之后验证了手机号还要问', async t => {
  const { c, calls } = setupComponent(t, { profile: { code: 0, data: { needProfile: false, updateDate: null } } })
  await c.ensure()
  await c.ensure()
  assert.equal(calls.get, 2, '没记「已处理」，下次还要问后端')
})

test('组件：先查到没有会员，同一会话里验证手机号之后再 ensure，会正常弹出', async t => {
  const { c, calls } = setupComponent(t, { profile: { code: 0, data: { needProfile: false, updateDate: null } } })
  await c.ensure()
  assert.equal(c.data.visible, false)
  const verified = setupComponent(t, { profile: { code: 0, data: { needProfile: true } } })
  const done = verified.c.ensure()
  await settle()
  assert.equal(verified.c.data.visible, true)
  await verified.c.onSkip()
  await done
  assert.equal(calls.get, 1)
})

// ---------- 先填昵称、再选头像（2026-11-15 用户：头像和昵称没法一次授权，那就先获取昵称，再获取头像） ----------

test('弹层模板：昵称在头像前面，昵称框自动获得焦点（键盘上方直接出现「用微信昵称」，省一次点击）', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'components/profile_auth/profile_auth.wxml'), 'utf8')
  const nickAt = wxml.search(/<input[^>]*type="nickname"/)
  const avatarAt = wxml.indexOf('open-type="chooseAvatar"')
  assert.ok(nickAt > 0 && avatarAt > 0)
  assert.ok(nickAt < avatarAt, '昵称要排在头像前面')
  assert.match(wxml, /<input[^>]*type="nickname"[^>]*focus="\{\{focusNick\}\}"/)
})

test('组件：弹出来时昵称框要焦点；关掉后焦点收回，下次再弹还是从昵称开始', async t => {
  const { c } = setupComponent(t)
  assert.equal(c.data.focusNick, false)
  const done = c.ensure()
  await settle()
  assert.equal(c.data.visible, true)
  assert.equal(c.data.focusNick, true)
  await c.onSkip()
  await done
  assert.equal(c.data.focusNick, false)
})

test('组件：先填昵称、再选头像，一次保存两样都带上', async t => {
  const { c, calls } = setupComponent(t)
  const done = c.ensure()
  await settle()
  c.onNickInput({ detail: { value: '雪友小明' } })
  assert.equal(c.data.canSave, true, '只填了昵称就能保存')
  c.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/a.jpg' } })
  await c.onSave()
  await done
  assert.deepEqual(calls.save[0], { sessionKey: 'sess-1', nickName: '雪友小明', avatarPath: 'http://tmp/a.jpg' })
})

// ---------- 「我的」页顶部显示头像和昵称（2026-11-15 用户：已授权的用户，这里应该显示头像和昵称） ----------

test('profileView：从 GetMyProfile 的返回取要显示的头像（完整网址）和昵称；没有、失败、旧后端都是空串', () => {
  assert.deepEqual(profileAuth.profileView({ code: 0, data: { nickName: ' 雪友小明 ', avatarUrl: 'https://img.snowmeet.top/upload/20261115/avatar_x.jpg', needProfile: false } }),
    { nickName: '雪友小明', avatarUrl: 'https://img.snowmeet.top/upload/20261115/avatar_x.jpg' })
  assert.deepEqual(profileAuth.profileView({ code: 0, data: { nickName: null, avatarUrl: null } }), { nickName: '', avatarUrl: '' })
  assert.deepEqual(profileAuth.profileView({ code: 0, data: { nickName: '只有昵称' } }), { nickName: '只有昵称', avatarUrl: '' })
  assert.deepEqual(profileAuth.profileView({ code: 1, data: { nickName: '不该显示' } }), { nickName: '', avatarUrl: '' })
  assert.deepEqual(profileAuth.profileView(null), { nickName: '', avatarUrl: '' })
  assert.deepEqual(profileAuth.profileView('Not Found'), { nickName: '', avatarUrl: '' })
})

// ---------- 昵称一定要带上、存过头像没存昵称的补填、点「我的」页顶部修改（2026-11-15 用户：两个都做） ----------

test('保存走表单提交：以表单里昵称框此刻的内容为准（不依赖输入事件有没有触发过），表单里没有才用已记下的', async t => {
  const { c, calls } = setupComponent(t)
  const done = c.ensure()
  await settle()
  c.onNickInput({ detail: { value: '旧的' } })
  await c.onSubmit({ detail: { value: { nickName: '表单里的昵称' } } })
  await done
  assert.equal(calls.save[0].nickName, '表单里的昵称')

  const second = setupComponent(t)
  const done2 = second.c.ensure()
  await settle()
  second.c.onNickInput({ detail: { value: '事件里记下的' } })
  await second.c.onSubmit({ detail: { value: {} } })
  await done2
  assert.equal(second.calls.save[0].nickName, '事件里记下的')
})

test('只选了头像、昵称是空的：先提示「还没填昵称」，选「去填昵称」不保存、回到昵称框；选「只保存头像」才保存', async t => {
  const cancel = setupComponent(t, { modalConfirm: false })
  const done = cancel.c.ensure()
  await settle()
  cancel.c.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/a.jpg' } })
  await cancel.c.onSave()
  assert.equal(cancel.calls.modals.length, 1)
  assert.match(cancel.calls.modals[0].title + cancel.calls.modals[0].content, /昵称/)
  assert.equal(cancel.calls.save.length, 0, '选了去填昵称就不保存')
  assert.equal(cancel.c.data.visible, true)
  await cancel.c.onSkip()
  await done

  const ok = setupComponent(t, { modalConfirm: true })
  const done2 = ok.c.ensure()
  await settle()
  ok.c.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/a.jpg' } })
  await ok.c.onSave()
  await done2
  assert.deepEqual(ok.calls.save[0], { sessionKey: 'sess-1', nickName: '', avatarPath: 'http://tmp/a.jpg' })
})

test('昵称已经填了、或者本来就存过昵称：只换头像不再提示', async t => {
  const filled = setupComponent(t)
  const d1 = filled.c.ensure()
  await settle()
  filled.c.onNickInput({ detail: { value: '雪友' } })
  filled.c.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/a.jpg' } })
  await filled.c.onSave()
  await d1
  assert.equal(filled.calls.modals.length, 0)

  const existing = setupComponent(t, { profile: { code: 0, data: { needProfile: true, nickName: '已有昵称', avatarUrl: null, updateDate: '2026-11-15T08:00:00' } } })
  const d2 = existing.c.ensure()
  await settle()
  assert.equal(existing.c.data.nickName, '已有昵称', '存过的昵称带进输入框')
  existing.c.onChooseAvatar({ detail: { avatarUrl: 'http://tmp/a.jpg' } })
  await existing.c.onSave()
  await d2
  assert.equal(existing.calls.modals.length, 0)
  assert.equal(existing.calls.save[0].nickName, '已有昵称')
})

test('资料不全（存过头像没存昵称）时 ensure 会再弹，已存的头像显示在弹层里，昵称框等着补', async t => {
  const { c } = setupComponent(t, { profile: { code: 0, data: { needProfile: true, nickName: null, avatarUrl: 'https://img.snowmeet.top/upload/x/avatar_a.jpg', updateDate: '2026-11-15T07:14:48' } } })
  const done = c.ensure()
  await settle()
  assert.equal(c.data.visible, true)
  assert.equal(c.data.currentAvatarUrl, 'https://img.snowmeet.top/upload/x/avatar_a.jpg')
  assert.equal(c.data.nickName, '')
  assert.equal(c.data.editing, false)
  await c.onSkip()
  await done
})

test('edit（点「我的」页顶部修改）：不管是不是「已处理」都能打开，带出已存的昵称和头像，可以只改昵称', async t => {
  const stored = { code: 0, data: { needProfile: false, nickName: '旧昵称', avatarUrl: 'https://img.snowmeet.top/upload/x/avatar_a.jpg', updateDate: '2026-11-15T08:00:00' } }
  const { c, calls, app } = setupComponent(t, { profile: stored })
  app.globalData.profilePromptedKey = 'sess-1'       // 本次运行已经处理过，ensure 不会再弹，但点头部修改还是要能打开
  const done = c.edit()
  await settle()
  assert.equal(c.data.visible, true)
  assert.equal(c.data.editing, true)
  assert.equal(c.data.nickName, '旧昵称')
  assert.equal(c.data.currentAvatarUrl, 'https://img.snowmeet.top/upload/x/avatar_a.jpg')
  c.onNickInput({ detail: { value: '新昵称' } })
  await c.onSave()
  await done
  assert.deepEqual(calls.save[0], { sessionKey: 'sess-1', nickName: '新昵称', avatarPath: '' })
  assert.equal(calls.modals.length, 0)
  assert.equal(c.data.visible, false)
})

test('edit：点「取消」直接关掉，什么都不保存；没有会员 / 没有登录会话时打不开', async t => {
  const { c, calls } = setupComponent(t, { profile: { code: 0, data: { needProfile: false, nickName: '旧昵称', avatarUrl: 'https://x/a.jpg', updateDate: '2026-11-15T08:00:00' } } })
  const done = c.edit()
  await settle()
  await c.onSkip()
  await done
  assert.equal(calls.save.length, 0)

  const noMember = setupComponent(t, { profile: { code: 0, data: { needProfile: false, nickName: null, avatarUrl: null, updateDate: null } } })
  await noMember.c.edit()
  assert.equal(noMember.c.data.visible, false)

  const noSession = setupComponent(t, { sessionKey: '' })
  await noSession.c.edit()
  assert.equal(noSession.calls.get, 0)
  assert.equal(noSession.c.data.visible, false)
})

test('edit 时弹层的标题和按钮是「修改」「取消」，不是「完善」「跳过」', () => {
  const wxml = fs.readFileSync(path.join(ROOT, 'components/profile_auth/profile_auth.wxml'), 'utf8')
  assert.match(wxml, /\{\{editing \? '修改个人资料' : '完善个人资料'\}\}/)
  assert.match(wxml, /\{\{editing \? '取消' : '跳过'\}\}/)
  assert.match(wxml, /\{\{avatarPath \|\| currentAvatarUrl\}\}/, '已存的头像也要能显示出来')
})

test('editOn：和 ensureOn 一样，取不到组件、组件出错都当作没事，永远不 reject', async () => {
  assert.equal(await profileAuth.editOn(null), undefined)
  assert.equal(await profileAuth.editOn({ selectComponent: () => null }), undefined)
  assert.equal(await profileAuth.editOn({ selectComponent: () => ({ edit: () => Promise.reject(new Error('x')) }) }), undefined)
  let called = false
  await profileAuth.editOn({ selectComponent(sel) { assert.equal(sel, '#profileAuth'); return { edit() { called = true; return Promise.resolve() } } } })
  assert.equal(called, true)
})

// ---------- 隐私协议：顾客还没同意时，先请他同意再弹头像昵称（2026-11-15 开发者工具报 showNicknameAccessory:fail ... errno:104） ----------
// 昵称输入框（type="nickname"）和头像按钮要用到「用户隐私」，顾客没在微信里同意过小程序的隐私协议时，昵称框降级成普通输入框、
// 头像选择也会失败。type="nickname" 自己不会触发隐私弹窗，所以要先主动要一次：wx.requirePrivacyAuthorize。

test('requirePrivacy：已经同意 / 接口不存在 / 查不到状态，都直接往下走；没同意就弹系统弹窗，同意才算数', async () => {
  const run = (wxApi) => profileAuth.requirePrivacy(wxApi)
  assert.equal(await run(null), true)
  assert.equal(await run({}), true, '旧基础库没有这两个接口')
  assert.equal(await run({ getPrivacySetting: o => o.success({ needAuthorization: false }), requirePrivacyAuthorize: () => { throw new Error('不该再要一次') } }), true)
  assert.equal(await run({ getPrivacySetting: o => o.fail({}), requirePrivacyAuthorize: () => { throw new Error('查不到状态就不要了') } }), true)
  assert.equal(await run({ getPrivacySetting: o => o.success({ needAuthorization: true }), requirePrivacyAuthorize: o => o.success({}) }), true)
  assert.equal(await run({ getPrivacySetting: o => o.success({ needAuthorization: true }), requirePrivacyAuthorize: o => o.fail({ errno: 104 }) }), false)
})

test('组件：隐私协议已经同意 → 直接弹，不再要授权', async t => {
  const { c, calls } = setupComponent(t, { privacy: 'agreed' })
  const done = c.ensure()
  await settle()
  assert.equal(c.data.visible, true)
  assert.equal(calls.privacyChecked, 1)
  assert.equal(calls.privacyAsked, 0)
  await c.onSkip()
  await done
})

test('组件：隐私协议还没同意 → 先弹系统的隐私弹窗，顾客同意之后才弹头像昵称弹层，并且昵称框才获得焦点', async t => {
  const { c, calls } = setupComponent(t, { privacy: 'accept' })
  const done = c.ensure()
  await settle()
  assert.equal(calls.privacyAsked, 1)
  assert.equal(c.data.visible, false, '顾客还没点同意，我们的弹层不能先出来')
  assert.equal(c.data.focusNick, false)
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(c.data.visible, true)
  assert.equal(c.data.focusNick, true)
  await c.onSkip()
  await done
})

test('组件：顾客不同意隐私协议 → 不弹头像昵称，本次运行里不再问（下次重新打开小程序再问）', async t => {
  const { c, calls } = setupComponent(t, { privacy: 'refuse' })
  await c.ensure()
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(calls.privacyAsked, 1)
  assert.equal(c.data.visible, false)
  assert.equal(calls.save.length, 0)
  await c.ensure()
  assert.equal(calls.privacyAsked, 1, '不再重复要授权')
  assert.equal(calls.get, 1, '也不再请求后端')
})

test('组件：点「我的」页顶部修改（edit）同样先要隐私授权', async t => {
  const stored = { code: 0, data: { needProfile: false, nickName: '旧昵称', avatarUrl: 'https://x/a.jpg', updateDate: '2026-11-15T08:00:00' } }
  const { c, calls } = setupComponent(t, { privacy: 'accept', profile: stored })
  const done = c.edit()
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(calls.privacyAsked, 1)
  assert.equal(c.data.visible, true)
  await c.onSkip()
  await done
})
