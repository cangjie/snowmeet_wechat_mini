// 介绍人管理（系统管理员）：列表、补绑支付宝分账关系、停用 / 启用；添加在 add 页
const api = require('../../../../utils/introducer_api.js')

const ADMIN_LEVEL = 300
const FILTERS = ['全部', '教练', 'KOL', '机构']
const TYPE_CLASS = { '教练': 'blue', 'KOL': 'kol', '机构': 'org' }

function decorate(r) {
  return {
    id: r.id, memberId: r.memberId, coachId: r.coachId, name: r.name, realName: r.realName || '', phone: r.phone || '', phoneTail: r.phoneTail || '', phoneDisplay: r.phone || (r.phoneUnavailable ? '手机号暂不可用' : '未填写'), type: r.type, valid: r.valid, wechat: r.wechat, alipay: r.alipay, alipayMessage: r.alipayMessage || '',
    typeClass: TYPE_CLASS[r.type] || 'muted',
    wechatClass: r.wechat === '已填写' ? 'ok' : 'warn',
    alipayClass: r.alipay === '已绑定' ? 'ok' : (r.alipay === '未绑定' ? 'danger' : 'muted')
  }
}

// 旧版列表只返回尾号，用已有会员详情接口补全；限并发，升级后端后无需额外请求。
async function fillLegacyPhones(rows) {
  const pending = rows.filter(r => !Object.prototype.hasOwnProperty.call(r, 'phone') && r.phoneTail && r.memberId)
  for (let i = 0; i < pending.length; i += 4) {
    await Promise.all(pending.slice(i, i + 4).map(async r => {
      try {
        const member = await api.getMemberDetail(r.memberId)
        if (!member || typeof member.phone !== 'string') throw new Error('手机号不可用')
        r.phone = member.phone
      } catch (_) { r.phoneUnavailable = true }
    }))
  }
}

Page({
  data: { blocked: '', loading: true, filters: FILTERS, types: FILTERS.slice(1), filter: '全部', statusFilter: '', rows: [], counts: {}, keyword: '', phoneSearching: false, exactMemberId: null, selected: {}, selectedCount: 0, syncConflicts: [] },

  onLoad() {
    return Promise.resolve(getApp().loginPromiseNew).then(() => {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= ADMIN_LEVEL)) {
        this.setData({ blocked: '只有系统管理员可以管理介绍人', loading: false })
        return null
      }
      return this.load()
    }).catch(() => {})
  },

  onShow() { if (this.loadedOnce) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.listIntroducers().then(d => api.listPlatformCoaches()
      .then(platform => ({ d, platform, statsUnavailable: false }))
      .catch(() => ({ d, platform: { coaches: [] }, statsUnavailable: true }))).then(async ({ d, platform, statsUnavailable }) => {
      await fillLegacyPhones(d.introducers || [])
      this.loadedOnce = true
      const byId = {}
      ;(platform.coaches || []).forEach(r => { byId[r.coach.id] = r })
      this.all = (d.introducers || []).map(decorate).map(r => {
        const p = byId[r.coachId]
        return Object.assign(r, { cards: p ? p.coach.cards : null, students: p ? p.students : 0, seasonAmount: p ? p.seasonAmount : 0 })
      })
      const countedCoaches = new Set()
      const stats = this.all.reduce((s, r) => {
        if (r.valid) s.distributors++
        if (r.coachId && !countedCoaches.has(r.coachId)) {
          countedCoaches.add(r.coachId)
          if (r.cards) { s.cardsIssued += r.cards.total || 0; s.cardsClaimed += r.cards.claimed || 0 }
          s.consumption += r.seasonAmount || 0
        }
        return s
      }, { distributors: 0, cardsIssued: 0, cardsClaimed: 0, consumption: 0 })
      stats.consumption = Math.round(stats.consumption * 100) / 100
      this.setData({ loading: false, syncConflicts: d.syncConflicts || [], stats: statsUnavailable ? null : stats, statsUnavailable })
      this.refresh()
    }).catch(err => { this.setData({ loading: false }); api.fail(err) })
  },

  refresh() {
    const all = this.all || []
    const counts = { '全部': all.length }
    FILTERS.slice(1).forEach(f => { counts[f] = all.filter(r => r.type === f).length })
    const f = this.data.filter
    const keyword = (this.data.keyword || '').trim().toLowerCase()
    const fullPhone = /^1\d{10}$/.test(keyword)
    const visible = all.filter(r => (f === '全部' || r.type === f)
      && (!this.data.statusFilter || (this.data.statusFilter === 'active' ? r.valid : !r.valid))
      && (fullPhone ? (!this.data.phoneSearching && Number(r.memberId) === this.data.exactMemberId)
        : (!keyword || r.name.toLowerCase().includes(keyword) || r.phoneTail.includes(keyword))))
    const selected = {}
    visible.forEach(r => { if (r.valid && r.coachId && this.data.selected[r.id] === r.coachId) selected[r.id] = r.coachId })
    this.setData({ counts, selected, selectedCount: Object.keys(selected).length,
      rows: visible.map(r => Object.assign({}, r, { checked: !!selected[r.id] })) })
  },

  onFilter(e) { this.setData({ filter: e.currentTarget.dataset.name }); this.refresh() },
  onStatusFilter(e) { this.setData({ statusFilter: e.currentTarget.dataset.value }); this.refresh() },
  onSearch(e) {
    const keyword = e.detail.value
    const seq = this._searchSeq = (this._searchSeq || 0) + 1
    const fullPhone = /^1\d{10}$/.test((keyword || '').trim())
    this.setData({ keyword, phoneSearching: fullPhone, exactMemberId: null })
    this.refresh()
    if (!fullPhone) return Promise.resolve()
    return api.lookupMember(keyword.trim()).then(member => {
      if (seq !== this._searchSeq) return
      this.setData({ phoneSearching: false, exactMemberId: member.exists ? Number(member.memberId) : -1 })
      this.refresh()
    }).catch(err => {
      if (seq !== this._searchSeq) return
      this.setData({ phoneSearching: false, exactMemberId: -1 }); this.refresh(); api.fail(err)
    })
  },
  onSelect(e) {
    const row = (this.all || []).find(r => r.id === e.currentTarget.dataset.id)
    if (!row || !row.valid || !row.coachId) return
    const selected = Object.assign({}, this.data.selected)
    if (selected[row.id]) delete selected[row.id]; else selected[row.id] = row.coachId
    this.setData({ selected }); this.refresh()
  },
  onIssue() {
    const ids = Object.keys(this.data.selected).map(key => this.data.selected[key])
    if (!ids.length) { wx.showToast({ title: '请先勾选分销商', icon: 'none' }); return }
    wx.navigateTo({ url: '/pages/coach/admin/issue/issue?ids=' + ids.join(',') })
  },
  onAdd() { wx.navigateTo({ url: '../add/add' }) },
  onOpenPlatform(e) { wx.navigateTo({ url: '/pages/coach/admin/detail/detail?id=' + e.currentTarget.dataset.id }) },
  onShareList() { wx.navigateTo({ url: '/pages/introducer/share/list/list?distributors=1' }) },
  onEdit(e) {
    const row = (this.all || []).find(r => r.id === e.currentTarget.dataset.id)
    if (row) this.setData({ edit: { id: row.id, originalType: row.type, type: row.type, name: row.name, realName: row.realName, ali: '' } })
  },
  onEditType(e) { this.setData({ 'edit.type': e.currentTarget.dataset.type }) },
  onEditName(e) { this.setData({ 'edit.name': e.detail.value }) },
  onEditRealName(e) { this.setData({ 'edit.realName': e.detail.value }) },
  onEditAli(e) { this.setData({ 'edit.ali': e.detail.value }) },
  onCancelEdit() { this.setData({ edit: null }) },
  onSaveEdit() {
    const e = this.data.edit
    if (!e || this.data.savingEdit) return Promise.resolve()
    if (!e.name.trim()) { wx.showToast({ title: '请填写显示名称', icon: 'none' }); return Promise.resolve() }
    if (e.ali.trim() && !e.realName.trim()) { wx.showToast({ title: '支付宝登录号需要真实姓名', icon: 'none' }); return Promise.resolve() }
    this.setData({ savingEdit: true })
    return api.updateIntroducer({ introducerId: e.id, type: e.type, name: e.name.trim(), realName: e.realName.trim() || null,
      aliAccountNum: e.ali.trim() || null })
      .then(v => {
        this.setData({ savingEdit: false, edit: null })
        wx.showToast({ title: v.alipay === '未绑定' ? '已保存，支付宝绑定失败：' + (v.alipayMessage || '请核对账号') : '已保存', icon: 'none', duration: 2800 })
        return this.load()
      }).catch(err => { this.setData({ savingEdit: false }); api.fail(err) })
  },

  onRebind(e) {
    return api.bindAlipay(e.currentTarget.dataset.id).then(v => {
      wx.showToast({ title: v.alipay === '已绑定' ? '已绑定支付宝' : '绑定失败：' + (v.alipayMessage || '请核对账号和姓名'), icon: 'none', duration: 2800 })
      return this.load()
    }).catch(err => api.fail(err))
  },

  onToggle(e) {
    const d = e.currentTarget.dataset
    return api.updateIntroducer({ introducerId: d.id, valid: !d.valid }).then(() => this.load()).catch(err => api.fail(err))
  }
})
