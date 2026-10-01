// 各页公共启动：管理页只对系统管理员（title_level ≥ 300）开放；扫码页（bind、selfreg）不限身份，服务端另有校验
const ADMIN_LEVEL = 300

function boot(page, adminOnly) {
  const app = getApp()
  return Promise.resolve(app.loginPromiseNew).then(() => {
    const staff = app.globalData.staff
    if (adminOnly && !(staff && staff.valid === 1 && staff.title_level >= ADMIN_LEVEL)) {
      page.setData({ blocked: '只有系统管理员可以管理员工账号' })
      throw new Error('blocked')
    }
    page.setData({ blocked: '' })
  })
}

function done(title) {
  wx.showToast({ title, icon: 'none', duration: 2200 })
}

// 登录失效（code 2）引导重新进入小程序
function fail(err) {
  if (err && err.code === 2) {
    wx.showModal({ title: '登录已失效', content: '请退出后重新进入小程序', showCancel: false })
    return
  }
  wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none', duration: 2800 })
}

function confirm(title, content, confirmText) {
  return new Promise(resolve => {
    wx.showModal({ title, content, confirmText: confirmText || '确定', success: res => resolve(!!res.confirm) })
  })
}

module.exports = { boot, done, fail, confirm, ADMIN_LEVEL }
