// 分销商（教练 / 机构）的订票二维码：顾客扫码直达雪票订购页，订单按每张票 ¥1 分账给我（与员工订票码一致）。
// 二维码由服务端按登录态生成，不接受客户端指定分销商。
const app = getApp()
const api = require('../common/api.js')

Page({
  data: { qrUrl: '', error: '', loading: false },
  onLoad() {
    return Promise.resolve(app.loginPromiseNew).then(() => this.getQrCode())
      .catch(() => this.setData({ error: '登录失败，请重试', loading: false }))
  },
  getQrCode() {
    if (!app.globalData.sessionKey) {
      this.setData({ error: '请先登录', qrUrl: '', loading: false })
      return
    }
    // 小程序版本跟当前运行版本一致（develop / trial / release）：预览版扫出来的码进预览版
    const envVersion = app.globalData.env || 'release'
    // 加时间戳避免重试时命中失败结果的缓存
    this.setData({ qrUrl: api.qrCodeUrl(envVersion) + '&_=' + Date.now(), error: '', loading: true })
  },
  onQrLoad() { this.setData({ loading: false }) },
  onQrError() { this.setData({ loading: false, error: '二维码生成失败，请确认你是启用中的教练或机构后重试' }) },
  saveQr() {
    if (!this.data.qrUrl) return
    wx.downloadFile({
      url: this.data.qrUrl,
      success: res => {
        if (res.statusCode !== 200) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }); return }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'none' }),
          fail: () => wx.showToast({ title: '没有保存成功，可长按二维码保存', icon: 'none' })
        })
      },
      fail: () => wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  }
})
