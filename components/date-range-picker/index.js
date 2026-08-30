// components/date-range-picker/index.js
// 全站统一的日期选择控件（2026-08-19 起，所有日期选择一律用它，不要再用原生 <picker mode="date">）。
//
// 两种模式：
//   mode="range"（默认）—— 起止日期 + 今天/昨天/本周/上周 快捷键，查询类页面用。
//                          事件 change → { startDate, endDate }
//   mode="single"        —— 单个日期，配置类页面用（如优惠券模板的总过期日）。
//                          事件 change → { date }
//
// 快捷键只在 range 模式出现：给一个「截止日」提供「昨天/上周」没有意义。
// 可选日期范围默认是「往回 3 年 ~ 今天」（查历史订单不需要未来）；
// 配置类场景传 allow-future 放开到往后 15 年（存量模板里最远的截止日是 2035-12-31）。
const util = require('../../utils/util.js')

function _fmt(d) {
  return util.formatDate(d)
}

function _getMonday(d) {
  var day = d.getDay() || 7
  var m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(d.getDate() - day + 1)
  return m
}

Component({
  properties: {
    mode: { type: String, value: 'range' },      // 'range' | 'single'
    startDate: { type: String, value: '' },      // range 模式
    endDate: { type: String, value: '' },        // range 模式
    date: { type: String, value: '' },           // single 模式
    allowFuture: { type: Boolean, value: false },
    placeholder: { type: String, value: '请选择' }
  },

  data: {
    showCalendar: false,
    activeShortcut: 'today',
    minDate: 0,
    maxDate: 0
  },

  attached() {
    var today = new Date()
    today.setHours(23, 59, 59, 0)
    // 允许往回选 3 年
    var min = new Date(today)
    min.setFullYear(today.getFullYear() - 3)
    min.setHours(0, 0, 0, 0)
    // 往后默认到今天为止（历史订单查询无需选未来日期）；配置类场景放开到 15 年
    var max = new Date(today)
    if (this.data.allowFuture) {
      max.setFullYear(today.getFullYear() + 15)
    }
    var patch = { minDate: min.getTime(), maxDate: max.getTime() }
    // activeShortcut 初值是 'today'，但调用方传进来的初始区间往往不是今天
    // （如"最近一周"、雪季至今）。不比对就会高亮一个与实际区间不符的快捷键。
    if (this.data.mode !== 'single') {
      var t = _fmt(new Date())
      if (this.data.startDate !== t || this.data.endDate !== t) {
        patch.activeShortcut = ''
      }
    }
    this.setData(patch)
  },

  methods: {
    openCalendar() {
      this.setData({ showCalendar: true })
    },

    closeCalendar() {
      this.setData({ showCalendar: false })
    },

    onCalendarConfirm(e) {
      this.setData({ showCalendar: false })
      // single 模式 van-calendar 回一个 Date，range 模式回 [start, end]
      if (this.data.mode === 'single') {
        this.triggerEvent('change', { date: _fmt(new Date(e.detail)) })
        return
      }
      var dates = e.detail
      this.setData({ activeShortcut: '' })
      this.triggerEvent('change', {
        startDate: _fmt(new Date(dates[0])),
        endDate: _fmt(new Date(dates[1]))
      })
    },

    onShortcut(e) {
      var key = e.currentTarget.dataset.key
      var today = new Date()
      var start, end
      switch (key) {
        case 'today':
          start = end = _fmt(today)
          break
        case 'yesterday': {
          var yest = new Date(today)
          yest.setDate(today.getDate() - 1)
          start = end = _fmt(yest)
          break
        }
        case 'thisweek':
          start = _fmt(_getMonday(today))
          end = _fmt(today)
          break
        case 'lastweek': {
          var thisMonday = _getMonday(today)
          var lastMonday = new Date(thisMonday)
          lastMonday.setDate(thisMonday.getDate() - 7)
          var lastSunday = new Date(thisMonday)
          lastSunday.setDate(thisMonday.getDate() - 1)
          start = _fmt(lastMonday)
          end = _fmt(lastSunday)
          break
        }
      }
      this.setData({ activeShortcut: key })
      this.triggerEvent('change', { startDate: start, endDate: end })
    }
  }
})
