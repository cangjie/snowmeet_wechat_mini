// 「大好河山雪票」页每张票下面的「雪票分账记录」（2026-11-08 暂时替换了这一页原来的「分销商分账」卡片）：
// 只读，显示这张票那 1 元的系统分账：分给谁、成没成、计划什么时候分、什么时候成功。
// 分账对应的是雪票不是订单，一张票最多一笔，所以按票的 id 取（SkipassShareRecord/GetBySkipass），同一订单的几张票各看各的。
// 店长以上（title_level ≥ 200）才显示。
const api = require('../../../utils/introducer_api.js')

const MANAGER_LEVEL = 200
// 「已取消」：票取消了（取消已确认或出票失败），这 1 元分账也是取消状态（2026-11-18 用户要求），灰色
const STATE_CLASS = { '已分账': 'ok', '处理中': 'blue', '待分账': 'warn', '不能自动分': 'warn', '部分分账': 'warn', '被拒绝': 'danger', '已取消': 'muted' }

function decorate(r) {
  return Object.assign({}, r, { stateClass: STATE_CLASS[r.state] || 'muted' })
}

function summarize(record) {
  if (!record) return '没有分账'
  return '¥' + (Number(record.amount) || 0) + ' ' + record.state
}

Component({
  properties: {
    skipassId: { type: Number, value: 0, observer(value, previous) { if (this._attached && value !== previous) this.load() } }
  },
  data: {
    hidden: true, loading: false, expanded: true, record: null, emptyReason: '', summary: '', ticketText: '', voided: false
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
      const skipassId = this.properties.skipassId
      if (!skipassId) return Promise.resolve()
      this.setData({ hidden: false, loading: true })
      return api.getSkipassShareRecord(skipassId).then(d => {
        const record = d && d.record ? decorate(d.record) : null
        this.setData({
          loading: false,
          record,
          emptyReason: record ? '' : ((d && d.emptyReason) || '没有分账'),
          summary: summarize(record),
          // 数据里不叫 cancelled：phone_copy 的扫描测试把变量名里的「cell」当成手机号（cancelled 里有 cell）
          voided: !!(d && d.cancelled),
          ticketText: d && d.cancelled ? '这张票已取消' : (d && d.pickedUp ? '这张票已取票' : '这张票还没取票')
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
