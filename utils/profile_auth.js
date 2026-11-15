// 顾客验证手机号之后授权头像和昵称（2026-11-14 用户要求）的共用逻辑。
//   · 弹层组件 components/profile_auth（app.json 全局注册为 profile-auth），后端 api/MemberProfile/*（头像存 S3，
//     member 表记昵称、头像、更新时间）。
//   · 用法：页面 wxml 里放 <profile-auth id="profileAuth" />，手机号验证成功、隐藏 loading 之后
//       await profileAuth.ensureOn(this)    // 或 profileAuth.ensureOn(this).then(...)
//     再继续自己的后续步骤（自动支付、跳转、轮询……）。弹层没弹出来（已有资料、后端没部署、没有会员、没有登录）时立即返回；
//     弹出来时等用户「保存」或「跳过」才返回，所以不会和微信支付弹窗叠在一起。永远不会 reject。
//   · 付款 / 收款环节一律不问（2026-11-15 用户：不论什么情况，付款的环节都不要询问，让顾客授权昵称和头像）：
//     付款页、支付身份确认（pay-identity-confirm）、收银身份核验（identity_verify）、次卡购买（punchcard_detail）都不接这个弹层，
//     tests/profile_auth_pages.test.js 会保证它们永远不弹。
//   · 可以跳过（微信运营规范不允许为了基本功能强制要头像昵称）；同一次运行里保存或跳过过就不再弹，重新登录后才会再问。
//   · 接待扫码报到（顾客侧流程，2026-11-15 用户定）：没授权手机号的先提示授权手机号；无论授权还是跳过，等约 5 秒，
//     再提示授权昵称、最后授权头像。手机号早就绑过的会员没有第一步，报到成功后同样等 5 秒再问。
//   · 已经绑过手机号的老会员不会再走验证手机号入口，所以另外在「我的」页补问（2026-11-15 用户要求），
//     同样是 profileAuth.ensureOn(this)；组件记着「已有资料 / 已处理」，「我的」页每次显示都调也不会重复弹、重复请求。
//   · 「超过一定时间重新获取」本次不做，规则入口在后端 MemberProfileRules.NeedPrompt。

const NICK_MAX = 32   // 和后端 MemberProfileRules.NickNameMaxLength 一致

// 昵称清洗：去控制字符和首尾空白，最多 32 个字（一个表情算一个字，不切成半个）。后端会再清洗一遍。
function cleanNickName(raw) {
  if (raw === null || raw === undefined) return ''
  const text = String(raw).replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()
  if (!text) return ''
  return Array.from(text).slice(0, NICK_MAX).join('').trim()
}

// 头像和昵称至少要有一样才能保存
function canSave(nickName, avatarPath) {
  return !!(cleanNickName(nickName) || (avatarPath && String(avatarPath).trim()))
}

// 后端 GetMyProfile 的返回：只有 code 0 且 needProfile 才弹。失败 / 没返回 / 旧后端 404 都当作不用弹。
function needPrompt(res) {
  return !!(res && typeof res === 'object' && res.code === 0 && res.data && res.data.needProfile === true)
}

// 后端说这个会员已经存过资料：不用弹，并且有更新时间。没有会员的会话也返回「不用弹」，但没有更新时间，不能算「已有资料」。
function hasProfile(res) {
  return !!(res && typeof res === 'object' && res.code === 0 && res.data && res.data.needProfile === false && res.data.updateDate)
}

// 「我的」页顶部要显示的头像（完整网址）和昵称；没有、请求失败、旧后端没有这个接口时都是空串（页面保持默认显示）
function profileView(res) {
  if (!res || typeof res !== 'object' || res.code !== 0 || !res.data) return { nickName: '', avatarUrl: '' }
  const nickName = typeof res.data.nickName === 'string' ? res.data.nickName.trim() : ''
  const avatarUrl = typeof res.data.avatarUrl === 'string' ? res.data.avatarUrl.trim() : ''
  return { nickName: nickName, avatarUrl: avatarUrl }
}

// 同一次运行里保存或跳过过就不再弹：按登录会话记，换了会话（重新登录）才会再问
function isDone(globalData, sessionKey) {
  return !!(globalData && sessionKey && globalData.profilePromptedKey === sessionKey)
}
function markDone(globalData, sessionKey) {
  if (globalData && sessionKey) globalData.profilePromptedKey = sessionKey
}

// 页面（或组件）里放了 <profile-auth id="profileAuth" />：让它在需要时弹出来，并等到用户处理完。永远不 reject。
function ensureOn(owner) {
  try {
    const c = owner && typeof owner.selectComponent === 'function' ? owner.selectComponent('#profileAuth') : null
    if (c && typeof c.ensure === 'function') {
      return Promise.resolve(c.ensure()).then(() => undefined, () => undefined)
    }
  } catch (e) {
    // 组件取不到不能拦后续流程
  }
  return Promise.resolve()
}

// 弹层出来时用 modal 提示怎么操作（2026-11-15 用户：提示不明显，用个 modal）。先昵称后头像；只缺一样就只写那一样。
// 昵称框不能自动聚焦：程序聚焦不是顾客点的，开发者工具报 invalid init scl: init before tap，「用微信昵称」要顾客自己点输入框。
function hintText(options) {
  const o = options || {}
  const lines = []
  if (o.needNick) lines.push('点上方的「点击获取昵称」，再点键盘上方的「用微信昵称」')
  if (o.needAvatar) lines.push('点击下方圆形的「头像」，选择「用微信头像」')
  if (lines.length === 0) return ''
  const numbered = lines.length === 1 ? lines : lines.map((line, i) => (i === 0 ? '①' : '②') + ' ' + line)
  return numbered.join('\n') + '\n\n也可以点「跳过」。'
}

// 弹头像昵称之前，先确认顾客已经同意小程序的隐私协议。昵称输入框（type="nickname"）和头像按钮要用到「用户隐私」，
// 没同意过时昵称框会降级成普通输入框、头像选择也会失败（开发者工具报 showNicknameAccessory:fail ... errno:104），
// 而 type="nickname" 自己不会触发隐私弹窗，所以要先主动要一次：wx.requirePrivacyAuthorize（已同意会直接成功）。
// 返回 true = 可以往下弹（已同意 / 刚同意 / 旧基础库没有这个接口 / 查不到状态，都交给微信自己处理）；false = 顾客拒绝了。
function requirePrivacy(wxApi) {
  const w = wxApi !== undefined ? wxApi : (typeof wx !== 'undefined' ? wx : null)
  return new Promise(resolve => {
    if (!w || typeof w.getPrivacySetting !== 'function' || typeof w.requirePrivacyAuthorize !== 'function') { resolve(true); return }
    w.getPrivacySetting({
      success: res => {
        if (!res || !res.needAuthorization) { resolve(true); return }
        w.requirePrivacyAuthorize({ success: () => resolve(true), fail: () => resolve(false) })
      },
      fail: () => resolve(true)
    })
  })
}

// 「我的」页点顶部头像昵称：打开修改弹层（带出已存的昵称和头像），等用户保存或取消。永远不 reject。
function editOn(owner) {
  try {
    const c = owner && typeof owner.selectComponent === 'function' ? owner.selectComponent('#profileAuth') : null
    if (c && typeof c.edit === 'function') {
      return Promise.resolve(c.edit()).then(() => undefined, () => undefined)
    }
  } catch (e) {
    // 组件取不到不能拦页面
  }
  return Promise.resolve()
}

module.exports = { NICK_MAX, cleanNickName, canSave, needPrompt, hasProfile, profileView, isDone, markDone, ensureOn, editOn, requirePrivacy, hintText }
