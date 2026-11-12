// 用正式环境链接生成员工二维码，扫码时由公众平台跳转到小程序。
const app = getApp()
Page({
  data: { qrUrl: '', bookingUrl: '', error: '', loading: false },
  onLoad() {
    return Promise.resolve(app.loginPromiseNew).then(() => this.getQrCode())
      .catch(() => this.setData({ error: '登录失败，请重试', loading: false }))
  },
  getQrCode() {
    if (!app.globalData.staff || !app.globalData.sessionKey) {
      this.setData({ error: '请使用员工账号登录', qrUrl: '', loading: false })
      return
    }
    const staffId = Number(app.globalData.staff.id)
    if (!Number.isSafeInteger(staffId) || staffId <= 0 || staffId > 2147483647) {
      this.setData({ error: '员工编号无效', qrUrl: '', bookingUrl: '', loading: false })
      return
    }
    // 固定正式环境域名；公众平台扫码规则将该链接映射到雪票选购页。
    const bookingUrl = 'https://mini.snowmeet.top/mapp/skipass_book?staffId=' + staffId
    const url = 'https://' + app.globalData.domainName + '/api/MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(bookingUrl)
    this.setData({ qrUrl: url, bookingUrl, error: '', loading: true })
  },
  copyLink() { if (this.data.bookingUrl) wx.setClipboardData({ data: this.data.bookingUrl }) },
  onQrLoad() { this.setData({ loading: false }) },
  onQrError() { this.setData({ loading: false, error: '小程序码生成失败，请重试' }) }
})
