// 各页公共启动：取员工会话与门店，未绑定门店时整页给出原因
const session = require('./session.js')
const expiry = require('./expiry.js')
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function todayLabel(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 ' + WEEK[d.getUTCDay()]
}

function boot(page) {
  const today = expiry.today()
  page.setData({ todayLabel: todayLabel(today), today })
  return session.loadContext(getApp()).then(ctx => {
    page.ctx = ctx
    page.setData({ isManager: ctx.isManager, blocked: '' })
    return ctx
  }).catch(err => {
    page.setData({ blocked: (err && err.message) || '无法加载员工信息' })
    throw err
  })
}

// 失败时提示；会话失效（code 2）引导重新进入
function fail(err) {
  const message = (err && err.message) || '操作失败'
  if (err && err.code === 2) {
    wx.showModal({ title: '登录已失效', content: '请退出后重新进入小程序', showCancel: false })
    return
  }
  wx.showToast({ title: message, icon: 'none', duration: 2800 })
}

module.exports = { boot, fail, todayLabel }
