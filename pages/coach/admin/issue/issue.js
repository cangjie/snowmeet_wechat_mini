// 批量发券：选教练（上一页已勾选）、选券模板、定每人张数。requestId 随页面生成，重复提交不会重复发放
const api = require('../../common/api.js')
const base = require('../../common/page-base.js')

function newRequestId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

Page({
  data: { blocked: '', coaches: [], templates: [], tplIdx: -1, count: 5, sending: false, doneText: '' },

  onLoad(options) {
    this.ids = String((options && options.ids) || '').split(',').filter(Boolean).map(Number)
    this.requestId = newRequestId()
    base.boot(this, 'admin').then(() => this.load()).catch(() => {})
  },

  load() {
    return Promise.all([api.listCoaches(), api.listCouponTemplates()]).then(([list, tpl]) => {
      const coaches = (list.coaches || []).map(r => r.coach).filter(c => this.ids.indexOf(c.id) >= 0 && c.valid)
      this.setData({ coaches, templates: tpl.templates || [] })
    }).catch(base.fail)
  },

  onTemplate(e) { this.setData({ tplIdx: Number(e.detail.value) }) },
  onMinus() { if (this.data.count > 1) this.setData({ count: this.data.count - 1 }) },
  onPlus() { if (this.data.count < 50) this.setData({ count: this.data.count + 1 }) },
  onRemove(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ coaches: this.data.coaches.filter(c => c.id !== id) })
  },

  onSend() {
    const d = this.data
    if (d.sending) return
    if (!d.coaches.length) { wx.showToast({ title: '请选择要发券的教练', icon: 'none' }); return }
    if (d.tplIdx < 0) { wx.showToast({ title: '请选择券模板', icon: 'none' }); return }
    const tpl = d.templates[d.tplIdx]
    base.confirm('确认发放', '给 ' + d.coaches.length + ' 位教练各发 ' + d.count + ' 张「' + tpl.name + '」，共 ' + d.coaches.length * d.count + ' 张。', '确认发放').then(ok => {
      if (!ok) return
      this.setData({ sending: true })
      return api.grantCoupons(d.coaches.map(c => c.id), tpl.id, d.count, this.requestId).then(r => {
        this.setData({ sending: false, doneText: '已发放 ' + r.granted + ' 张' + (r.skipped ? '（' + r.skipped + ' 张之前已发过，已跳过）' : '') })
        base.done('已发放')
      }).catch(err => { this.setData({ sending: false }); base.fail(err) })
    })
  }
})
