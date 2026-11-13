// pages/careadmin/workload/workload.js
// 日养护工作列表：某一天雪板的进出（初始待完成 + 新增 − 完成 = 待完成）、今日养护雪板数、各工序完成数。
// 统计规则（哪天、截止几点、怎么数）都在后端 Helpers/CareWorkloadRules.cs；页面只负责选日期 / 门店和展示。
// 过去的日子按当天 22:00 截止，今天 22:00 前实时、22:00 后冻结；每天会自动存一份快照（页面右上角标「快照」或「实时」）。
// 「完成」= 工序都做完、只差发板（或已发板、取消）；非雪季养护、2026-04-30 以前开的单、测试单不统计。
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
const workloadView = require('../../../utils/care_workload_view.js')

Page({
  data: {
    staff: null,
    shop: null,        // null = 全部门店
    date: '',          // yyyy-MM-dd
    today: '',
    isToday: true,
    querying: false,
    errorText: '',
    report: null
  },

  onLoad() {
    var today = util.formatDate(new Date())
    this.setData({ date: today, today: today, isToday: true })
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      that.setData({ staff: app.globalData.staff })
      that.query()
    })
  },

  onPullDownRefresh() {
    var done = function () { wx.stopPullDownRefresh() }
    return this.query().then(done, done)
  },

  shopSelected(e) {
    var shop = e.detail.shop || null
    if (shop === '全部店铺' || shop === '全部门店') shop = null
    if (shop === this.data.shop) return
    this.setData({ shop: shop })
    if (this.data.staff) this.query()
  },

  onDateChange(e) {
    this.setDate(e.detail.value)
  },

  onPrevDay() {
    this.setDate(workloadView.shiftDate(this.data.date, -1))
  },

  onNextDay() {
    if (this.data.isToday) return
    this.setDate(workloadView.shiftDate(this.data.date, 1))
  },

  onToday() {
    this.setDate(this.data.today)
  },

  setDate(date) {
    if (!date || date > this.data.today || date === this.data.date) return
    this.setData({ date: date, isToday: date === this.data.today })
    this.query()
  },

  // 点数字看明细：进出、有无操作、各工序（修刃下面每个人那一行只看这个人的）。数字是 0 就不跳
  onMetricTap(e) {
    var d = e.currentTarget.dataset
    if (!d.metric || !(Number(d.count) > 0)) return
    wx.navigateTo({
      url: workloadView.itemsUrl({
        metric: d.metric, date: this.data.date, shop: this.data.shop,
        staffId: d.staff === undefined ? null : d.staff, staffName: d.staffname
      })
    })
  },

  // 总是 resolve（失败只在页面上给提示）；快速连点日期 / 门店时，只认最后一次请求的结果
  query() {
    var that = this
    var seq = (this._seq || 0) + 1
    this._seq = seq
    this.setData({ querying: true, errorText: '' })
    return data.getCareDailyWorkloadPromise(this.data.date, this.data.shop, app.globalData.sessionKey)
      .then(function (stat) {
        if (seq !== that._seq) return
        that.setData({ report: workloadView.buildWorkloadView(stat), querying: false })
      })
      .catch(function (exp) {
        if (seq !== that._seq) return
        console.log('error', exp)
        that.setData({ querying: false, errorText: '查询失败，下拉可以重试' })
      })
  }
})
