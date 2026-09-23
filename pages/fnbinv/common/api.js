// 食材管理接口封装：保留服务端 code（2 会话失效 / 3 无权限 / 4 冲突需刷新），便于页面区分处理
let transport = function (options) { wx.request(options) }

function setTransport(fn) { transport = fn }

function buildQuery(params, raw) {
  return Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => k + '=' + (raw.indexOf(k) >= 0 ? params[k] : encodeURIComponent(params[k]))).join('&')
}

function request(ctx, method, path, params, body) {
  return new Promise(function (resolve, reject) {
    const query = buildQuery(Object.assign({ sessionKey: ctx.sessionKey }, params || {}), ['sessionKey'])
    transport({
      url: ctx.prefix + path + '?' + query,
      method,
      data: body,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode !== 200) {
          reject({ status: res.statusCode, code: -1, retryable: true, message: '服务暂时繁忙（' + res.statusCode + '），请重试' })
          return
        }
        const d = res.data || {}
        if (d.code === 0) resolve(d.data)
        else reject({ status: 200, code: d.code, retryable: d.code === 4, message: d.message || '操作失败' })
      },
      fail() { reject({ status: 0, code: -1, retryable: true, message: '网络不通，请重试' }) }
    })
  })
}

function get(ctx, path, params) {
  return request(ctx, 'GET', path, Object.assign({ shopId: ctx.shopId }, params || {}))
}

function post(ctx, path, body) {
  return request(ctx, 'POST', path, {}, Object.assign({ shopId: ctx.shopId }, body || {}))
}

async function getAll(ctx, path, params) {
  const rows = []
  for (let page = 1; page <= 50; page++) {
    const result = await get(ctx, path, Object.assign({}, params || {}, { page, pageSize: 100 }))
    const batch = (result && result.rows) || []
    rows.push.apply(rows, batch)
    if (batch.length === 0 || rows.length >= result.total) break
  }
  return rows
}

function toast(err) {
  const message = (err && err.message) || '操作失败'
  wx.showToast({ title: message, icon: 'none', duration: 2500 })
}

module.exports = { setTransport, get, post, getAll, toast }
