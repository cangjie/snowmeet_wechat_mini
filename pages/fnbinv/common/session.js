// 食材管理只服务一家餐饮门店：门店取自员工的 base_shop_id，界面不显示门店名
function loadContext(app) {
  return Promise.resolve(app.loginPromiseNew).then(function () {
    const g = app.globalData
    const staff = g.staff
    if (!staff || !g.sessionKey) throw { reason: 'login', message: '请先用员工账号登录' }
    if (!staff.base_shop_id) throw { reason: 'noShop', message: '你的账号还没有绑定餐饮门店，请联系管理员' }
    return {
      sessionKey: g.sessionKey, prefix: g.requestPrefix, shopId: staff.base_shop_id,
      staff, isManager: staff.title_level >= 200
    }
  })
}

module.exports = { loadContext }
