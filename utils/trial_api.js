function request(action, params, body) {
  const app = getApp()
  return Promise.resolve(app.loginPromiseNew).then(() => new Promise((resolve, reject) => {
    const g = app.globalData
    const query = Object.keys(params || {}).map(k => k + '=' + encodeURIComponent(params[k]))
    query.push('sessionKey=' + encodeURIComponent(g.sessionKey || ''))
    wx.request({
      url: g.requestPrefix + 'TrialReservation/' + action + '?' + query.join('&'),
      method: body === undefined ? 'GET' : 'POST',
      data: body,
      success(res) {
        const result = res.data || {}
        if (res.statusCode === 200 && result.code === 0) resolve(result.data)
        else reject(new Error(result.message || '操作失败，请重试'))
      },
      fail() { reject(new Error('网络不通，请重试')) }
    })
  }))
}

function qrUrl(id) {
  const g = getApp().globalData
  const info = wx.getAccountInfoSync()
  const env = (info.miniProgram && info.miniProgram.envVersion) || 'release'
  return g.requestPrefix + 'TrialReservation/QrImage?id=' + id + '&sessionKey='
    + encodeURIComponent(g.sessionKey || '') + '&envVersion=' + encodeURIComponent(env) + '&_=' + Date.now()
}

module.exports = { request, qrUrl }
