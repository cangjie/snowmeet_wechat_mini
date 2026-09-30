// 账号详情：一个账号只对应一套手机号 + 微信。改基本信息、换手机/重新绑定、开通、离职都在这里办
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/staff-view.js')

function shopIndex(shops, id) {
  const i = shops.findIndex(s => s.id === id)
  return i < 0 ? 0 : i
}

Page({
  data: {
    blocked: '', prototype: false, loading: true, staff: null, history: [], related: [],
    shops: [], titleOptions: view.TITLE_OPTIONS, form: null, shopIdx: 0, dirty: false,
    canAddPersonal: false, today: '',
    phoneShow: false, phones: [], pickPhoneId: null,
    offShow: false, offDate: '', offEffects: [], offRelated: [],
    approveShow: false, approveLevel: 100, approveShopIdx: 0
  },

  onLoad(options) {
    this.id = Number(options.id)
    this.setData({ today: view.today() })
    base.boot(this, true).then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce) this.load() },

  load() {
    return Promise.all([api.getStaff(this.id), api.listShops()]).then(([d, shopList]) => {
      this.loadedOnce = true
      const shops = [{ id: null, name: '不限门店' }].concat(shopList)
      const staff = view.viewStaff(d.staff)
      const related = d.related.map(view.viewStaff)
      const b = staff.binding
      this.setData({
        loading: false, staff, shops, related,
        history: view.historyRows(d.history),
        form: { name: staff.name, gender: staff.gender, title_level: staff.title_level, base_shop_id: staff.base_shop_id },
        shopIdx: shopIndex(shops, staff.base_shop_id), dirty: false,
        canAddPersonal: staff.valid && !!b && !b.is_private && !related.some(r => r.valid && r.binding && r.binding.is_private)
      })
      wx.setNavigationBarTitle({ title: staff.name })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  // 基本信息
  onName(e) { this.setData({ 'form.name': e.detail.value, dirty: true }) },
  onGender(e) { this.setData({ 'form.gender': e.currentTarget.dataset.v, dirty: true }) },
  onTitle(e) { this.setData({ 'form.title_level': Number(e.currentTarget.dataset.level), dirty: true }) },
  onShop(e) {
    const idx = Number(e.detail.value)
    this.setData({ shopIdx: idx, 'form.base_shop_id': this.data.shops[idx].id, dirty: true })
  },
  onSave() {
    if (!this.data.dirty) return
    api.updateStaff(Object.assign({ id: this.id }, this.data.form)).then(() => { base.done('已保存'); this.load() }).catch(base.fail)
  },

  // 工作号：换一部空闲的工作手机；没有手机的在职账号也从这里分配
  onChangePhone() {
    api.listPhones().then(list => {
      const phones = view.assignablePhones(list)
      if (!phones.length) { wx.showToast({ title: '没有空闲的工作手机，先到「工作手机」登记', icon: 'none', duration: 2800 }); return }
      this.setData({ phoneShow: true, phones, pickPhoneId: null })
    }).catch(base.fail)
  },
  onPickPhone(e) { this.setData({ pickPhoneId: Number(e.currentTarget.dataset.id) }) },
  closePhone() { this.setData({ phoneShow: false }) },
  onConfirmPhone() {
    if (!this.data.pickPhoneId) { wx.showToast({ title: '请选择一部手机', icon: 'none' }); return }
    api.changePhone(this.id, this.data.pickPhoneId).then(() => {
      this.setData({ phoneShow: false })
      base.done('已更换')
      this.load()
    }).catch(base.fail)
  },

  // 个人号：生成新的绑定码，员工用新微信扫码后旧的那套才失效
  onRebind() {
    const b = this.data.staff.binding
    const content = b ? '员工用新微信扫码绑定后，旧手机 ' + view.tail(b.cell) + ' 立即不能再进后台。' : '生成绑定码，员工用本人微信扫码后即可登录。'
    base.confirm('生成绑定码', content, '生成').then(ok => {
      if (!ok) return
      api.rebind(this.id).then(r => wx.navigateTo({ url: '../bindcode/bindcode?token=' + r.token })).catch(base.fail)
    })
  },
  onShowCode() { wx.navigateTo({ url: '../bindcode/bindcode?token=' + this.data.staff.pending_bind.token }) },
  onBindWechat() {
    api.bindJobPhone(this.data.staff.binding.account_id).then(r => wx.navigateTo({ url: '../bindcode/bindcode?token=' + r.token })).catch(base.fail)
  },

  // 已离职但还占着手机：结束绑定
  onRelease() {
    base.confirm('结束绑定', '结束后这套手机和微信不再属于这个账号。', '结束').then(ok => {
      if (!ok) return
      api.offboard([this.id], view.today()).then(() => { base.done('已结束绑定'); this.load() }).catch(base.fail)
    })
  },

  onAddPersonal() {
    const s = this.data.staff
    const q = ['type=private', 'name=' + encodeURIComponent(view.baseName(s.name) + '（个人）'), 'gender=' + encodeURIComponent(s.gender),
      'level=' + s.title_level, 'shop=' + (s.base_shop_id || '')]
    wx.navigateTo({ url: '../onboard/onboard?' + q.join('&') })
  },
  onOpenRelated(e) { wx.navigateTo({ url: '../detail/detail?id=' + e.currentTarget.dataset.id }) },

  // 离职：同一人其他在职账号默认一起勾上
  onOffboard() {
    const offRelated = this.data.related.filter(r => r.valid).map(r => ({
      id: r.id, name: r.name, typeTag: r.typeTag, checked: true, effects: view.offboardEffects(r)
    }))
    this.setData({ offShow: true, offDate: view.today(), offEffects: view.offboardEffects(this.data.staff), offRelated })
  },
  closeOff() { this.setData({ offShow: false }) },
  onOffDate(e) { this.setData({ offDate: e.detail.value }) },
  onToggleRelated(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ ['offRelated[' + i + '].checked']: !this.data.offRelated[i].checked })
  },
  onConfirmOff() {
    const ids = [this.id].concat(this.data.offRelated.filter(r => r.checked).map(r => r.id))
    api.offboard(ids, this.data.offDate).then(() => {
      this.setData({ offShow: false })
      base.done(ids.length > 1 ? '已办理 ' + ids.length + ' 个账号离职' : '已办理离职')
      this.load()
    }).catch(base.fail)
  },

  // 待开通：设定职级和门店后开通，或拒绝
  onApprove() { this.setData({ approveShow: true, approveLevel: 100, approveShopIdx: 0 }) },
  closeApprove() { this.setData({ approveShow: false }) },
  onApproveLevel(e) { this.setData({ approveLevel: Number(e.currentTarget.dataset.level) }) },
  onApproveShop(e) { this.setData({ approveShopIdx: Number(e.detail.value) }) },
  onConfirmApprove() {
    const shop = this.data.shops[this.data.approveShopIdx]
    api.approve(this.id, this.data.approveLevel, shop.id).then(() => {
      this.setData({ approveShow: false })
      base.done('已开通')
      this.load()
    }).catch(base.fail)
  },
  onReject() {
    base.confirm('拒绝开通', '拒绝后这个登记作废，对方需要重新登记。', '拒绝').then(ok => {
      if (!ok) return
      api.reject(this.id).then(() => { base.done('已拒绝'); this.load() }).catch(base.fail)
    })
  }
})
