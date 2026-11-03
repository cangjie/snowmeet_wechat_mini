// 介绍人分账接口（SnowmeetApi /api/Introducer、/api/OrderIntroducerShare）。
// 放在主包：订单详情页里的分账组件和 pages/introducer 分包都要用，分包之间不能互相引用。
// 保留服务端 code：1 业务规则不允许 / 2 登录失效 / 3 无权限，便于页面区分处理
let transport = function (options) { wx.request(options) }

function setTransport(fn) { transport = fn }

function request(method, controller, action, params, body) {
  return new Promise(function (resolve, reject) {
    const g = getApp().globalData
    // globalData.sessionKey 已经 encodeURIComponent 过，原样拼接
    const query = ['sessionKey=' + g.sessionKey].concat(Object.keys(params || {})
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map(k => k + '=' + encodeURIComponent(params[k]))).join('&')
    transport({
      url: g.requestPrefix + controller + '/' + action + '?' + query,
      method,
      data: body,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode !== 200) {
          reject({ code: -1, message: '服务暂时繁忙（' + res.statusCode + '），请重试' })
          return
        }
        const d = res.data || {}
        if (d.code === 0) resolve(d.data)
        else reject({ code: d.code, message: d.message || '操作失败', data: d.data })
      },
      fail() { reject({ code: -1, message: '网络不通，请重试' }) }
    })
  })
}

const get = (controller, action, params) => request('GET', controller, action, params)
const post = (controller, action, body) => request('POST', controller, action, {}, body || {})

// 登录失效（code 2）引导重新进入小程序；其余显示服务端给的原因
function fail(err) {
  if (err && err.code === 2) {
    wx.showModal({ title: '登录已失效', content: '请退出后重新进入小程序', showCancel: false })
    return
  }
  wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none', duration: 2800 })
}

module.exports = {
  setTransport,
  fail,
  // ---- 介绍人管理（系统管理员 ≥300）----
  listIntroducers: () => get('Introducer', 'ListIntroducers'),
  lookupMember: cell => get('Introducer', 'LookupMember', { cell }),
  addIntroducer: body => post('Introducer', 'AddIntroducer', body),
  updateIntroducer: body => post('Introducer', 'UpdateIntroducer', body),
  bindAlipay: introducerId => post('Introducer', 'BindAlipay', { introducerId }),
  // ---- 订单上设置分账（店长以上 ≥200）----
  // type：教练 / KOL / 机构，不传 = 全部；keyword：名称、真实姓名或手机号里包含的文字
  listChoices: (type, keyword) => get('Introducer', 'ListChoices', { type, keyword }),
  getOrderShares: orderId => get('OrderIntroducerShare', 'GetOrderShares', { orderId }),
  setShare: body => post('OrderIntroducerShare', 'SetShare', body),
  removeShare: orderShareId => post('OrderIntroducerShare', 'RemoveShare', { orderShareId })
}
