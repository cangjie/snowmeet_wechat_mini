// pages/admin/care/care_unfinished_list.js
// 按装备维度展示“已完成养护但仍未发板”的装备，以及哪些任务已完成 / 未完成。
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')

const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com'

Page({
  data: {
    shop: null,
    equipment: null,
    brand: null,
    cell: null,
    isTest: false,
    isSummerCare: null,
    sortOrder: 'desc',
    items: [],
    taskStats: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
    querying: false
  },

  onLoad() {
    var nowDate = new Date()
    this.setData({ startDate: util.formatDate(nowDate), endDate: util.formatDate(nowDate) })
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      that.setData({ staff: app.globalData.staff, querying: true })
      that.getData(that.data.page, that.data.pageSize)
    })
  },

  shopSelected(e) {
    this.setData({ shop: e.detail.shop })
  },

  onEquipmentChange(e) {
    var v = e.detail.value
    this.setData({ equipment: v === 'null' ? null : v })
  },

  setQueryOptions(e) {
    var key = e.currentTarget.id
    var v = e.detail.value
    var parsed = v === 'null' ? null : (v === 'true' ? true : (v === 'false' ? false : v))
    var patch = {}
    patch[key] = parsed
    this.setData(patch)
  },

  setBrand(e) {
    this.setData({ brand: e.detail.value })
  },

  setCell(e) {
    this.setData({ cell: e.detail.value })
  },

  onDateRangeChange(e) {
    this.setData({ startDate: e.detail.startDate, endDate: e.detail.endDate })
  },

  query() {
    this.setData({ querying: true })
    this.getData(1)
  },

  getData(page, pageSize) {
    var that = this
    page = page || that.data.page
    pageSize = pageSize || that.data.pageSize
    data.getIncompleteCareItemsByStaffPromise(
      that.data.shop, that.data.equipment, that.data.brand, that.data.cell,
      that.data.isTest, that.data.isSummerCare, that.data.sortOrder,
      that.data.startDate, that.data.endDate,
      app.globalData.sessionKey, page, pageSize
    ).then(function (result) {
      var items = result.items || []
      for (var i = 0; i < items.length; i++) {
        var it = items[i]
        var done = Array.isArray(it.completedTasks) ? it.completedTasks : []
        var todo = Array.isArray(it.pendingTasks) ? it.pendingTasks : []
        it.completedTaskStr = done.length > 0 ? done.join(' / ') : '-'
        it.pendingTaskStr = todo.length > 0 ? todo.join(' / ') : '-'
        var thumbs = []
        var src = Array.isArray(it.thumbUrls) ? it.thumbUrls : []
        for (var k = 0; k < src.length; k++) {
          if (src[k]) thumbs.push(IMG_HOST + src[k])
        }
        it.thumbs = thumbs
      }
      that.setData({
        items: items,
        taskStats: result.taskStats || [],
        total: result.total || 0,
        page: page,
        pageSize: pageSize,
        totalPages: Math.max(1, Math.ceil((result.total || 0) / pageSize)),
        querying: false
      })
    }).catch(function (exp) {
      console.log('error', exp)
      that.setData({ querying: false })
    })
  },

  onPagerChange(e) {
    if (this.data.querying) return
    var d = e.detail
    this.setData({ querying: true })
    this.getData(d.page, d.pageSize)
  },

  gotoDetail(e) {
    var index = parseInt(e.currentTarget.id, 10)
    var item = this.data.items[index]
    if (!item) return
    wx.navigateTo({
      url: '/pages/admin/care/care_order_detail/care_order_detail?orderId=' + item.order_id + '&careId=' + item.id
    })
  },

  onPhotoTap(e) {
    var idx = parseInt(e.currentTarget.dataset.idx, 10)
    var ti = parseInt(e.currentTarget.dataset.ti, 10)
    var item = this.data.items[idx]
    if (!item || !item.thumbs || !item.thumbs.length) return
    wx.previewImage({ urls: item.thumbs, current: item.thumbs[ti] })
  }
})
