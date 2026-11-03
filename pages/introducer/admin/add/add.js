// 添加介绍人（系统管理员）：先用手机号找到会员，再选类型。
// 教练、KOL 的微信账号自动取会员在我们小程序里的 openid；机构填商户号和商户全称；支付宝只填登录号（手机号或邮箱，选填），填了保存时自动去绑定分账关系。
const api = require('../../../../utils/introducer_api.js')

const ADMIN_LEVEL = 300
// 支付宝登录号：手机号（11 位，1 开头）或邮箱，和后端 IntroducerRules.IsValidAlipayLoginName 同一口径
const ALI_PHONE = /^1\d{10}$/
const ALI_EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/

Page({
  data: {
    blocked: '', cell: '', found: null, looking: false, saving: false,
    types: ['教练', 'KOL', '机构'], type: 'KOL', name: '', realName: '',
    wepayAccountNum: '', wepayAccountName: '', aliAccountNum: '', result: null
  },

  onLoad() {
    Promise.resolve(getApp().loginPromiseNew).then(() => {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= ADMIN_LEVEL)) {
        this.setData({ blocked: '只有系统管理员可以管理介绍人' })
        return
      }
      this.setData({ blocked: '' })
    }).catch(() => {})
  },

  onCell(e) { this.setData({ cell: e.detail.value, found: null }) },
  onName(e) { this.setData({ name: e.detail.value }) },
  onRealName(e) { this.setData({ realName: e.detail.value }) },
  onWepayNum(e) { this.setData({ wepayAccountNum: e.detail.value }) },
  onWepayName(e) { this.setData({ wepayAccountName: e.detail.value }) },
  onAliNum(e) { this.setData({ aliAccountNum: e.detail.value }) },
  onType(e) { this.setData({ type: e.currentTarget.dataset.type }) },

  onLookup() {
    const cell = (this.data.cell || '').trim()
    if (cell.length < 6) { wx.showToast({ title: '请输入完整的手机号', icon: 'none' }); return }
    this.setData({ looking: true })
    return api.lookupMember(cell).then(found => {
      const patch = { found, looking: false }
      if (found.exists && !this.data.name) patch.name = found.name === '学员' ? '' : found.name
      this.setData(patch)
    }).catch(err => { this.setData({ looking: false }); api.fail(err) })
  },

  onSave() {
    const d = this.data
    if (d.saving) return
    const toast = title => wx.showToast({ title, icon: 'none', duration: 2400 })
    if (!d.found) { toast('请先点「查找」找到会员'); return }
    if (!d.found.exists) { toast('这个手机号还没有会员，介绍人必须先是会员'); return }
    if (!d.name.trim()) { toast('请填写显示名称'); return }
    const isOrg = d.type === '机构'
    if (isOrg && (!d.wepayAccountNum.trim() || !d.wepayAccountName.trim())) { toast('机构要填商户号和商户全称'); return }
    const aliNum = d.aliAccountNum.trim()
    if (aliNum && !(ALI_PHONE.test(aliNum) || ALI_EMAIL.test(aliNum))) { toast('支付宝登录号要填手机号或邮箱'); return }
    if (aliNum && !d.realName.trim()) { toast('登录号要同时填真实姓名'); return }
    this.setData({ saving: true })
    return api.addIntroducer({
      memberId: d.found.memberId, type: d.type, name: d.name.trim(), realName: d.realName.trim(),
      wepayAccountNum: isOrg ? d.wepayAccountNum.trim() : '', wepayAccountName: isOrg ? d.wepayAccountName.trim() : '',
      aliAccountNum: aliNum
    }).then(v => {
      const failed = v.alipay === '未绑定'
      this.setData({
        saving: false,
        result: failed
          ? { ok: false, title: '已保存，但支付宝绑定失败', body: (v.alipayMessage || '请核对账号和姓名') + '。介绍人已经建好，可以在列表里点「重新绑定支付宝」；绑定成功前，支付宝付款订单上的分账会走手动转账。' }
          : { ok: true, title: v.alipay === '已绑定' ? '已保存，支付宝已绑定' : '已保存', body: v.alipay === '已绑定' ? '之后支付宝付款的订单可以自动分给这位介绍人。' : '没有填支付宝账号时，支付宝付款订单上的分账会走手动转账。' }
      })
    }).catch(err => { this.setData({ saving: false }); api.fail(err) })
  },

  onDone() { wx.navigateBack({ delta: 1 }) }
})
