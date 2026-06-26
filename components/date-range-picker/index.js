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
    startDate: { type: String, value: '' },
    endDate: { type: String, value: '' }
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
    // 允许往回选 3 年，往后到今天为止（历史订单查询无需选未来日期）
    var min = new Date(today)
    min.setFullYear(today.getFullYear() - 3)
    min.setHours(0, 0, 0, 0)
    this.setData({ minDate: min.getTime(), maxDate: today.getTime() })
  },

  methods: {
    openCalendar() {
      this.setData({ showCalendar: true })
    },

    closeCalendar() {
      this.setData({ showCalendar: false })
    },

    onCalendarConfirm(e) {
      var dates = e.detail  // [startDate, endDate] as Date objects in range mode
      var start = _fmt(new Date(dates[0]))
      var end = _fmt(new Date(dates[1]))
      this.setData({ showCalendar: false, activeShortcut: '' })
      this.triggerEvent('change', { startDate: start, endDate: end })
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
