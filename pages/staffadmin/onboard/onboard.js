// 新员工入职（系统管理员代办）：账号关联一套手机号 + 微信。分配工作手机的立即生效；
// 用私人手机的，提交后出绑定码，员工用那部手机的微信扫码完成
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/staff-view.js')

Page({
  data: {
    blocked: '', titleOptions: view.TITLE_OPTIONS, shops: [], shopIdx: 0, today: '',
    form: { name: '', gender: '', title_level: 100, base_shop_id: null, start_date: '', type: 'job', account_id: null },
    phones: [], orphanCount: 0, loading: true, submitting: false
  },

  // 从工作手机页「分给新员工」进来时带 type=job&account=手机 id，预选这部手机
  onLoad(options) {
    const o = options || {}
    const form = Object.assign({}, this.data.form, { start_date: view.today() })
    if (o.type === 'job' || o.type === 'private') form.type = o.type
    if (o.account) form.account_id = Number(o.account)
    this.setData({ form, today: view.today() })
    base.boot(this, true).then(() => this.load()).catch(() => {})
  },

  load() {
    return Promise.all([api.listShops(), api.listPhones()]).then(([shopList, phoneList]) => {
      const shops = [{ id: null, name: '不限门店' }].concat(shopList)
      // 从工作手机页返回时重新拉手机，已选的门店保留
      const shopIdx = this.data.shops.length ? this.data.shopIdx : 0
      const views = phoneList.map(view.viewPhone)
      const phones = views.filter(p => p.status === 'idle' || p.status === 'no_wechat')
        .sort((a, b) => (b.assignable ? 1 : 0) - (a.assignable ? 1 : 0))
      const keep = phones.some(p => p.assignable && p.id === this.data.form.account_id)
      this.setData({
        loading: false, shops, shopIdx, phones, orphanCount: views.filter(p => p.status === 'orphan').length,
        'form.base_shop_id': shops[shopIdx].id, 'form.account_id': keep ? this.data.form.account_id : null
      })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onName(e) { this.setData({ 'form.name': e.detail.value }) },
  onGender(e) { this.setData({ 'form.gender': e.currentTarget.dataset.v }) },
  onTitle(e) { this.setData({ 'form.title_level': Number(e.currentTarget.dataset.level) }) },
  onShop(e) {
    const idx = Number(e.detail.value)
    this.setData({ shopIdx: idx, 'form.base_shop_id': this.data.shops[idx].id })
  },
  onDate(e) { this.setData({ 'form.start_date': e.detail.value }) },
  onType(e) { this.setData({ 'form.type': e.currentTarget.dataset.type }) },
  onPickPhone(e) {
    const p = this.data.phones.find(x => x.id === Number(e.currentTarget.dataset.id))
    if (!p) return
    if (!p.assignable) { wx.showToast({ title: '这部手机还没绑定微信，先到「工作手机」绑定', icon: 'none', duration: 2800 }); return }
    this.setData({ 'form.account_id': p.id })
  },
  onGoPhones() { wx.navigateTo({ url: '../phones/phones' }) },
  onShow() { if (this.data.shops.length) this.load() },

  onSubmit() {
    const f = this.data.form
    if (this.data.submitting) return
    if (!String(f.name).trim()) { wx.showToast({ title: '请填写姓名', icon: 'none' }); return }
    if (!f.gender) { wx.showToast({ title: '请选择性别', icon: 'none' }); return }
    if (f.type === 'job' && !f.account_id) { wx.showToast({ title: '请选择一部工作手机', icon: 'none' }); return }
    this.setData({ submitting: true })
    api.onboard(f).then(r => {
      this.setData({ submitting: false })
      if (r.token) {
        wx.redirectTo({ url: '../bindcode/bindcode?token=' + r.token })
        return
      }
      base.done('已入职')
      wx.redirectTo({ url: '../detail/detail?id=' + r.staff_id })
    }).catch(err => { this.setData({ submitting: false }); base.fail(err) })
  }
})
