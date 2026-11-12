// 添加教练：用手机号找已有会员；没有会员时同时创建会员。价格可之后在详情里设置
const api = require('../../common/api.js')
const base = require('../../common/page-base.js')

Page({
  data: { blocked: '', cell: '', name: '', found: null, looking: false, saving: false },

  onLoad() { base.boot(this, 'admin').catch(() => {}) },

  onCell(e) { this.setData({ cell: e.detail.value, found: null }) },
  onName(e) { this.setData({ name: e.detail.value }) },

  onLookup() {
    const cell = (this.data.cell || '').trim()
    if (cell.length < 6) { wx.showToast({ title: '请输入完整的手机号', icon: 'none' }); return }
    this.setData({ looking: true })
    api.lookupMember(cell).then(found => {
      const patch = { found, looking: false }
      if (found.exists && !this.data.name) patch.name = found.name === '学员' ? '' : found.name
      this.setData(patch)
    }).catch(err => { this.setData({ looking: false }); base.fail(err) })
  },

  onSave() {
    const d = this.data
    if (d.saving) return
    if (!d.found) { wx.showToast({ title: '请先点「查找会员」', icon: 'none' }); return }
    if (d.found.isCoach) { wx.showToast({ title: '这个会员已经是教练了', icon: 'none' }); return }
    const form = d.found.exists ? { memberId: d.found.memberId, name: d.name.trim() } : { cell: d.cell.trim(), name: d.name.trim() }
    if (!d.found.exists && !form.name) { wx.showToast({ title: '请填写教练显示名', icon: 'none' }); return }
    this.setData({ saving: true })
    api.addCoach(form).then(coach => {
      base.done('已添加')
      wx.redirectTo({ url: '../detail/detail?id=' + coach.id })
    }).catch(err => { this.setData({ saving: false }); base.fail(err) })
  }
})
