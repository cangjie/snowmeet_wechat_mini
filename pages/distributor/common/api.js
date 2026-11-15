// 分销商（教练 / 机构）本人接口：SnowmeetApi /api/Distributor。页面只调这里。
// 保留服务端 code：2 登录失效 / 3 不是教练或机构 / 5 这个微信还不是会员
let transport = function (options) { wx.request(options) }

function setTransport(fn) { transport = fn }

function url(action, params) {
  const g = getApp().globalData
  // globalData.sessionKey 已经 encodeURIComponent 过，原样拼接
  const query = ['sessionKey=' + g.sessionKey].concat(Object.keys(params || {})
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => k + '=' + encodeURIComponent(params[k]))).join('&')
  return g.requestPrefix + 'Distributor/' + action + '?' + query
}

function get(action, params) {
  return new Promise(function (resolve, reject) {
    transport({
      url: url(action, params),
      method: 'GET',
      success(res) {
        if (res.statusCode !== 200) { reject({ code: -1, message: '服务暂时繁忙（' + res.statusCode + '），请重试' }); return }
        const d = res.data || {}
        if (d.code === 0) resolve(d.data)
        else reject({ code: d.code, message: d.message || '操作失败' })
      },
      fail() { reject({ code: -1, message: '网络不通，请重试' }) }
    })
  })
}

module.exports = {
  setTransport,
  getPayee: () => get('GetPayee'),
  // 我的顾客与消费：名下顾客 + 有订单记在我名下的顾客；消费 = 归属我的订单实付净额
  getMyCustomers: () => get('GetMyCustomers'),
  getCustomerOrders: memberId => get('GetCustomerOrders', { memberId }),
  // 订票二维码是 PNG 图片，直接给 <image src>；envVersion 让开发版/体验版预览出的码扫了进同一版本
  qrCodeUrl: envVersion => url('GetQrCode', { envVersion })
}
