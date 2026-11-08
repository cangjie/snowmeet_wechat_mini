// 「大好河山雪票」页每张票下面的「雪票分账记录」（2026-11-08 暂时替换了这一页原来的「分销商分账」卡片）：
// 只读，显示系统给推荐员工的分账（每张票 1 元）分给谁、成没成、计划什么时候分、什么时候成功。
// 店长以上（title_level ≥ 200）才显示，数据来自 SkipassShareRecord/GetByOrder（整张订单的记录，同一订单的几张票显示同样的内容）。
const api = require('../../../utils/introducer_api.js')

const MANAGER_LEVEL = 200
const STATE_CLASS = { '已分账': 'ok', '处理中': 'blue', '待分账': 'warn', '不能自动分': 'warn', '部分分账': 'warn', '被拒绝': 'danger' }

function decorate(r) {
  return Object.assign({}, r, { stateClass: STATE_CLASS[r.state] || 'muted' })
}

function summarize(records, emptyReason) {
  if (!records.length) return emptyReason || '没有分账记录'
  const total = Math.round(records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100) / 100
  const done = records.filter(r => r.state === '已分账').length
  return '共 ' + records.length + ' 条 ¥' + total + '，已分账 ' + done + ' 条'
}

Component({
  properties: {
    orderId: { type: Number, value: 0, observer(value, previous) { if (this._attached && value !== previous) this.load() } }
  },
  data: {
    hidden: true, loading: false, expanded: true, records: [], summary: '', ticketText: ''
  },
  lifetimes: {
    attached() { this._attached = true; return this.load() }
  },
  methods: {
    load() {
      const staff = getApp().globalData.staff
      if (!(staff && staff.valid === 1 && staff.title_level >= MANAGER_LEVEL)) {
        this.setData({ hidden: true, loading: false })
        return Promise.resolve()
      }
      const orderId = this.properties.orderId
      if (!orderId) return Promise.resolve()
      this.setData({ hidden: false, loading: true })
      return api.getSkipassShareRecords(orderId).then(d => {
        const records = ((d && d.records) || []).map(decorate)
        this.setData({
          loading: false,
          records,
          summary: summarize(records, d && d.emptyReason),
          ticketText: d && d.ticketCount ? '已取票 ' + (d.pickedUpCount || 0) + '/' + d.ticketCount + ' 张' : ''
        })
      }).catch(err => {
        this.setData({ loading: false })
        // 网络不通或接口不存在（新版小程序先于后端上线）：这张卡片只是附加信息，静默隐藏，别在每张票下面都弹提示
        if (err && err.code === -1) { this.setData({ hidden: true }); return }
        api.fail(err)
      })
    },

    onToggle() { this.setData({ expanded: !this.data.expanded }) }
  }
})
