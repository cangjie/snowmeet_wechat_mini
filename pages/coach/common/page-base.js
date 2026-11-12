// 教练平台各页公共启动。管理页只对系统管理员（title_level ≥ 300）开放；教练页只对教练开放（服务端另有校验）；
// 领取页不限身份，登录后即可打开
const ADMIN_LEVEL = 300

function boot(page, mode) {
  const app = getApp()
  return Promise.resolve(app.loginPromiseNew).then(() => {
    if (mode === 'admin') {
      const staff = app.globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= ADMIN_LEVEL)) {
        page.setData({ blocked: '只有系统管理员可以管理教练' })
        throw new Error('blocked')
      }
    }
    page.setData({ blocked: '' })
  })
}

function done(title) {
  wx.showToast({ title, icon: 'none', duration: 2200 })
}

// 登录失效（code 2）引导重新进入小程序；code 3 无权限、code 5 还不是会员由页面自己区分
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

// 金额 / 折扣显示：0.8 → 8 折；整数不带小数点
function rateText(rate) {
  if (rate === null || rate === undefined) return ''
  return String(Math.round(rate * 100) / 10) + ' 折'
}
function moneyText(v) { return '¥' + (Math.round(Number(v || 0) * 100) / 100).toString() }

module.exports = { boot, done, fail, confirm, rateText, moneyText, ADMIN_LEVEL }
