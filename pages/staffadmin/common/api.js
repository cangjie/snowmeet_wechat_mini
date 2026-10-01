// 员工账号管理接口（SnowmeetApi /api/StaffAdmin/*），页面只调这里。
// 保留服务端 code：2 登录失效 / 3 无权限 / 5 这个微信还不是会员，便于页面区分处理
let transport = function (options) { wx.request(options) }

function setTransport(fn) { transport = fn }

function request(method, action, params, body) {
  return new Promise(function (resolve, reject) {
    const g = getApp().globalData
    // globalData.sessionKey 已经 encodeURIComponent 过，原样拼接
    const query = ['sessionKey=' + g.sessionKey].concat(Object.keys(params || {})
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map(k => k + '=' + encodeURIComponent(params[k]))).join('&')
    transport({
      url: g.requestPrefix + 'StaffAdmin/' + action + '?' + query,
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
        else reject({ code: d.code, message: d.message || '操作失败' })
      },
      fail() { reject({ code: -1, message: '网络不通，请重试' }) }
    })
  })
}

const get = (action, params) => request('GET', action, params)
const post = (action, body) => request('POST', action, {}, body || {})

module.exports = {
  setTransport,
  listShops: () => get('ListShops'),
  listStaff: () => get('ListStaff'),
  getStaff: id => get('GetStaff', { id }),
  listPhones: () => get('ListPhones'),
  onboard: form => post('Onboard', form),
  updateStaff: form => post('UpdateStaff', form),
  changePhone: (staffId, accountId) => post('ChangePhone', { staff_id: staffId, account_id: accountId }),
  rebind: staffId => post('Rebind', { staff_id: staffId }),
  offboard: (staffId, date) => post('Offboard', { staff_id: staffId, date }),
  approve: (staffId, titleLevel, shopId) => post('Approve', { staff_id: staffId, title_level: titleLevel, base_shop_id: shopId }),
  reject: staffId => post('Reject', { staff_id: staffId }),
  reclaimPhone: accountId => post('ReclaimPhone', { account_id: accountId }),
  addJobPhone: cell => post('AddJobPhone', { cell }),
  bindJobPhone: accountId => post('BindJobPhone', { account_id: accountId }),
  getCode: token => get('GetBindCode', { token }),
  // getPhoneNumber 的 encryptedData + iv 交给后端用会话的 session_key 解密
  confirmBind: (token, encData, iv) => post('ConfirmBind', { token, encData, iv }),
  selfRegister: (name, gender, encData, iv) => post('SelfRegister', { name, gender, encData, iv })
}
