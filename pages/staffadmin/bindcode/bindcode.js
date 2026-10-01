// 绑定码：在管理员手机上展示，让被绑定的那部手机用微信扫。两种一次性码：账号绑定私人手机、工作手机绑定微信；
// 扫码走「扫普通链接二维码打开小程序」规则（https://mini.snowmeet.top/mapp/staff_bind → pages/staffadmin/bind/bind）。
// token=selfreg 时显示公众号员工入职码（snowmeet_staff_reg 场景，7 天临时码，每次打开现生成），员工关注后点公众号回复里的链接进自助登记页
const api = require('../common/api.js')
const base = require('../common/page-base.js')

const BIND_URL = 'https://mini.snowmeet.top/mapp/staff_bind?token='
const SELFREG_SCENE = 'snowmeet_staff_reg'

const COPY = {
  private: code => ({
    title: '请「' + code.staff.name + '」用私人手机的微信扫码',
    lines: ['用要绑定的私人手机上的微信扫一扫下面的码（这个微信需要已是会员）', '按提示授权手机号，绑定后这套手机号和微信就关联到这个账号，原来那套随之结束', '只能用一次，' + code.expire_at + ' 前有效']
  }),
  job_phone: code => ({
    title: '请用工作手机 ' + code.phone.tail + ' 上的微信扫码',
    lines: ['在这部工作手机上打开微信扫一扫（这个微信需要已是会员）', '授权的手机号必须是 ' + code.phone.tail, '只能用一次，' + code.expire_at + ' 前有效']
  }),
  selfreg: () => ({
    title: '新员工自助登记码',
    lines: ['这是公众号的员工入职码。新员工用私人手机的微信扫码关注，点公众号回复里的链接，填写姓名并授权手机号（这个微信需要已是会员）', '提交后出现在「待开通」里，由系统管理员设定职级和门店后开通', '码 7 天内有效，每次打开本页都会重新生成']
  })
}

Page({
  data: { blocked: '', loading: true, code: null, title: '', lines: [], qrSrc: '' },

  onLoad(options) {
    this.token = options.token
    base.boot(this, true).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },

  load() {
    if (this.token === 'selfreg') {
      const copy = COPY.selfreg()
      const qrSrc = getApp().globalData.requestPrefix + 'MediaHelper/ShowImageFromOfficialAccount?img='
        + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=' + SELFREG_SCENE)
      this.setData({ loading: false, code: { purpose: 'selfreg', status: 'ok' }, title: copy.title, lines: copy.lines, qrSrc })
      return Promise.resolve()
    }
    return api.getCode(this.token).then(code => {
      this.loadedOnce = true
      const copy = COPY[code.purpose](code)
      const qrSrc = getApp().globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText=' + encodeURIComponent(BIND_URL + code.token)
      this.setData({ loading: false, code, title: copy.title, lines: copy.lines, qrSrc })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onPreview() { if (this.data.qrSrc) wx.previewImage({ urls: [this.data.qrSrc] }) },
  onRefresh() { this.load() },

  onRegenerate() {
    const c = this.data.code
    const next = c.purpose === 'job_phone' ? api.bindJobPhone(c.phone.id) : api.rebind(c.staff.id)
    next.then(r => wx.redirectTo({ url: '../bindcode/bindcode?token=' + r.token })).catch(base.fail)
  },
  onOpenStaff() { wx.redirectTo({ url: '../detail/detail?id=' + this.data.code.staff.id }) },
  onBack() { wx.navigateBack() }
})
