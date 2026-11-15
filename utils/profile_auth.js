// 顾客验证手机号之后授权头像和昵称（2026-11-14 用户要求）的共用逻辑。
//   · 弹层组件 components/profile_auth（app.json 全局注册为 profile-auth），后端 api/MemberProfile/*（头像存 S3，
//     member 表记昵称、头像、更新时间）。
//   · 用法：页面 wxml 里放 <profile-auth id="profileAuth" />，手机号验证成功、隐藏 loading 之后
//       await profileAuth.ensureOn(this)    // 或 profileAuth.ensureOn(this).then(...)
//     再继续自己的后续步骤（自动支付、跳转、轮询……）。弹层没弹出来（已有资料、后端没部署、没有会员、没有登录）时立即返回；
//     弹出来时等用户「保存」或「跳过」才返回，所以不会和微信支付弹窗叠在一起。永远不会 reject。
//   · 可以跳过（微信运营规范不允许为了基本功能强制要头像昵称）；同一次运行里保存或跳过过就不再弹，重新登录后才会再问。
//   · 已经绑过手机号的老会员不会再走验证手机号入口，所以另外在「我的」页和顾客付款页补问（2026-11-15 用户要求），
//     同样是 profileAuth.ensureOn(this)；组件记着「已有资料 / 已处理」，这两个页面每次显示都调也不会重复弹、重复请求。
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

module.exports = { NICK_MAX, cleanNickName, canSave, needPrompt, hasProfile, isDone, markDone, ensureOn }
