function isLocalUrl(url) {
  return /^https:\/\/(?:localhost|127\.0\.0\.1):\d+\//.test(url)
}

function load(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url, responseType: 'arraybuffer',
      success(res) {
        if (res.statusCode !== 200) {
          reject(new Error('二维码获取失败（HTTP ' + res.statusCode + '）'))
          return
        }
        const bytes = res.data instanceof ArrayBuffer ? new Uint8Array(res.data) : null
        if (!bytes || bytes.length < 8 ||
            ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) {
          reject(new Error('二维码图片格式无效'))
          return
        }
        resolve('data:image/png;base64,' + wx.arrayBufferToBase64(res.data))
      },
      fail(err) {
        console.warn('本地二维码请求失败', err)
        reject(new Error('二维码网络请求失败，请重试'))
      }
    })
  })
}

module.exports = { isLocalUrl, load }
