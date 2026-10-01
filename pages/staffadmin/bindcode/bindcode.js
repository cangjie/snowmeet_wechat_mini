// 绑定码：在管理员手机上展示，让被绑定的那部手机用微信扫。三种用途：账号绑定私人手机、工作手机绑定微信、员工自助登记
// 被扫后回到本页（onShow）会刷新状态；原型里用「模拟扫码」直接打开扫码后的页面
const api = require('../common/api.js')
const base = require('../common/page-base.js')

const COPY = {
  private: code => ({
    title: '请「' + code.staff.name + '」用私人手机的微信扫码',
    lines: ['用要绑定的私人手机上的微信扫一扫下面的码', '按提示授权手机号，绑定后这套手机号和微信就关联到这个账号，原来那套随之结束', '只能用一次，' + code.expire_at + ' 前有效']
  }),
  job_phone: code => ({
    title: '请用工作手机 ' + code.phone.tail + ' 上的微信扫码',
    lines: ['在这部工作手机上打开微信扫一扫', '授权的手机号必须是 ' + code.phone.tail, '只能用一次，' + code.expire_at + ' 前有效']
  }),
  selfreg: () => ({
    title: '新员工自助登记码',
    lines: ['新员工用本人微信扫码，填写姓名并授权手机号', '提交后出现在「待开通」里，由系统管理员设定职级和门店后开通', '这个码长期有效，可以打印贴在店里']
  })
}

Page({
  data: { blocked: '', prototype: false, loading: true, code: null, title: '', lines: [] },

  onLoad(options) {
    this.token = options.token
    base.boot(this, true).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },

  load() {
    return api.getCode(this.token).then(code => {
      this.loadedOnce = true
      const copy = COPY[code.purpose](code)
      this.setData({ loading: false, code, title: copy.title, lines: copy.lines })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  // 原型：代替另一部手机扫码
  onSimulate() {
    const url = this.data.code.purpose === 'selfreg' ? '../selfreg/selfreg' : '../bind/bind?token=' + this.token
    wx.navigateTo({ url })
  },

  onRegenerate() {
    const c = this.data.code
    const next = c.purpose === 'job_phone' ? api.bindJobPhone(c.phone.id) : api.rebind(c.staff.id)
    next.then(r => wx.redirectTo({ url: '../bindcode/bindcode?token=' + r.token })).catch(base.fail)
  },
  onOpenStaff() { wx.redirectTo({ url: '../detail/detail?id=' + this.data.code.staff.id }) },
  onBack() { wx.navigateBack() }
})
