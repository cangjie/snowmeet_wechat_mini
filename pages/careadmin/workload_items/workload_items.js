// pages/careadmin/workload_items/workload_items.js
// 日养护工作列表里某个数的明细：这个数对应哪些雪板（订单号、装备、顾客、进店 / 完成时间、任务进度）；
// 工序类的数还列出是谁在几点完成的。点一行进养护订单详情。
// 参数：metric（哪个数）、date、shop（不带 = 全部门店）、staffId + staffName（只看某个人完成的工序）。
// 明细永远按当前数据现算；过去的日子统计读的是每晚存的快照，订单后来被改过时条数可能和统计页差一点。
const app = getApp()
const data = require('../../../utils/data.js')
const workloadView = require('../../../utils/care_workload_view.js')
const careOrderRows = require('../../../utils/care_order_rows.js')

// 小程序的页面参数不会自动解码
function param(options, key) {
  var v = options && options[key]
  if (v === undefined || v === null || v === '') return ''
  try { return decodeURIComponent(v) } catch (e) { return String(v) }
}

Page({
  data: {
    staff: null,
    metric: '',
    date: '',
    shop: null,
    staffId: null,
    staffName: '',
    title: '',
    querying: false,
    errorText: '',
    view: null
  },

  onLoad(options) {
    var metric = param(options, 'metric')
    var staffId = param(options, 'staffId')
    var staffName = param(options, 'staffName')
    var title = workloadView.metricTitle(metric, staffId === '' ? '' : (staffName || '未记录'))
    this.setData({
      metric: metric,
      date: param(options, 'date'),
      shop: param(options, 'shop') || null,
      staffId: staffId === '' ? null : Number(staffId),
      staffName: staffName,
      title: title
    })
    if (title) wx.setNavigationBarTitle({ title: title })
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

  // 总是 resolve（失败只在页面上给提示）
  query() {
    var that = this
    this.setData({ querying: true, errorText: '' })
    return data.getCareDailyWorkloadItemsPromise(this.data.date, this.data.shop, this.data.metric, this.data.staffId, app.globalData.sessionKey)
      .then(function (result) {
        that.setData({ view: workloadView.buildItemsView(result, careOrderRows), querying: false })
      })
      .catch(function (exp) {
        console.log('error', exp)
        that.setData({ querying: false, errorText: '查询失败，下拉可以重试' })
      })
  },

  gotoDetail(e) {
    var d = e.currentTarget.dataset
    if (!d.orderid) return
    wx.navigateTo({
      url: '/pages/admin/care/care_order_detail/care_order_detail?orderId=' + d.orderid + '&careId=' + d.careid
    })
  }
})
