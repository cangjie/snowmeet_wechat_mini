// 各页公共启动：管理页只对系统管理员（title_level ≥ 300）开放；扫码页（bind、selfreg）不限身份
const api = require('./api.js')

const ADMIN_LEVEL = 300

function boot(page, adminOnly) {
  page.setData({ prototype: api.PROTOTYPE })
  const app = getApp()
  return Promise.resolve(app.loginPromiseNew).then(() => {
    const staff = app.globalData.staff
    if (adminOnly && !(staff && staff.title_level >= ADMIN_LEVEL)) {
      page.setData({ blocked: '只有系统管理员可以管理员工账号' })
      throw new Error('blocked')
    }
    page.setData({ blocked: '' })
  })
}

// 写操作成功：原型阶段提醒没有真正提交
function done(title) {
  wx.showToast({ title: api.PROTOTYPE ? title + '（原型，未提交服务器）' : title, icon: 'none', duration: 2200 })
}

function fail(err) {
  wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none', duration: 2800 })
}

function confirm(title, content, confirmText) {
  return new Promise(resolve => {
    wx.showModal({ title, content, confirmText: confirmText || '确定', success: res => resolve(!!res.confirm) })
  })
}

module.exports = { boot, done, fail, confirm, ADMIN_LEVEL }
