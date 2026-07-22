// pages/admin/care/care_unpicked_list.js
// 养护已生效订单中所有"未发板"的装备（顾客已送来养护、还没取走），一件装备一条，供店员催取。
// 分页架构照抄 care_order_list.js（服务端内存分页 + list-pager 组件）；筛选/展示逻辑参照
// pages/admin/rent/unreturned.js（已寄存天数）与 pages/order/payment_entry.js（项目/金额文案）。
// 点击整行跳转 care_order_detail 时同时带 orderId + careId，与扫描装备标签二维码
// （components/care/print_care_label.js 生成的 URL）落地效果完全等效。
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')

const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com'

function daysSince(d) {
  var days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days < 0 ? 0 : days
}

Page({

  data: {
    shop: null,
    equipment: null,
    brand: null,
    cell: null,
    isTest: false,        // 测试订单筛选，默认只看正常订单（营业）
    isSummerCare: null,   // 非雪季养护筛选，默认全部
    sortOrder: 'asc',     // 送到时间排序，默认正序（最早送到的排最前，即寄存最久优先）
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
    querying: false
  },

  // 返回列表时（从订单详情返回触发 onShow）：保留当前页码/每页条数/筛选，用这些参数重查，不重置回第 1 页。
  // 页面实例 navigateTo 期间不销毁，page/pageSize/筛选字段都还在 this.data。首次进入等同初始查询。
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

  query() {
    this.setData({ querying: true })
    this.getData(1)
  },

  getData(page, pageSize) {
    var that = this
    page = page || that.data.page
    pageSize = pageSize || that.data.pageSize
    data.getUnpickedCareItemsByStaffPromise(
      that.data.shop, that.data.equipment, that.data.brand, that.data.cell,
      that.data.isTest, that.data.isSummerCare, that.data.sortOrder,
      app.globalData.sessionKey, page, pageSize
    ).then(function (result) {
      that.renderItems(result.items || [], result.total || 0, page, pageSize)
      that.setData({ querying: false })
    }).catch(function (exp) {
      console.log('error', exp)
      that.setData({ querying: false })
    })
  },

  renderItems(items, total, page, pageSize) {
    for (var i = 0; i < items.length; i++) {
      var care = items[i]
      // 左侧属性标签
      care.haveWarranty = !!care.warranty
      care.haveEntertain = !!care.entertain
      care.isSummerTask = care.biz_type === '非雪季养护'
      care.isTestOrder = !!(care.order && care.order.is_test === 1)
      // 养护项目 + 金额（口径抄自 pages/order/payment_entry.js 养护段）
      var svcs = []
      if (care.summer == 'now') svcs.push('非雪季·寄存')
      else if (care.summer == 'later') svcs.push('非雪季·先双项')
      else {
        if (care.need_edge == 1 && care.need_wax == 1) svcs.push('双项(修刃+热蜡)')
        else if (care.need_edge == 1) svcs.push('修刃')
        else if (care.need_wax == 1) svcs.push('热蜡')
        if (care.free_wax == 1) svcs.push('机打蜡')
        if (care.need_unwax == 1 && care.need_wax != 1) svcs.push('刮蜡')
        if (care.urgent == 1) svcs.push('立等')
      }
      if (care.repair_memo) svcs.push('维修(' + care.repair_memo + ')')
      care.svcStr = svcs.join('、') || '-'
      var amt = (care.common_charge || 0) + (care.repair_charge || 0) - (care.discount || 0) - (care.ticket_discount || 0)
      care.amountStr = util.showAmount(amt)
      // 已寄存天数
      care.storedDays = care.create_date ? daysSince(new Date(care.create_date)) : 0
      // 顾客信息（Order.customerCalledName / customerCell 已在后端算好随 order 一起下发）
      care._customerName = (care.order && care.order.customerCalledName) || '-'
      care._customerCell = (care.order && care.order.customerCell) || ''
      // 装备照片
      var thumbs = []
      if (care.careImages) {
        for (var k = 0; k < care.careImages.length; k++) {
          if (care.careImages[k].image && care.careImages[k].image.thumbUrl) {
            thumbs.push(IMG_HOST + care.careImages[k].image.thumbUrl)
          }
        }
      }
      care.thumbs = thumbs
    }
    var totalPages = Math.max(1, Math.ceil(total / pageSize))
    this.setData({ items: items, total: total, page: page, pageSize: pageSize, totalPages: totalPages })
  },

  onPagerChange(e) {
    if (this.data.querying) return
    var d = e.detail
    this.setData({ querying: true })
    this.getData(d.page, d.pageSize)
  },

  // 点击整行：与扫描装备标签二维码等效（print_care_label.js 生成的 URL 落地后走同一套
  // orderId+careId 深链定位逻辑，见 care_order_detail.js onLoad）
  gotoDetail(e) {
    var index = parseInt(e.currentTarget.id, 10)
    var item = this.data.items[index]
    if (!item) return
    wx.navigateTo({
      url: '/pages/admin/care/care_order_detail/care_order_detail?orderId=' + item.order_id + '&careId=' + item.id
    })
  },

  call(e) {
    var cell = e.currentTarget.dataset.cell
    if (cell) {
      wx.makePhoneCall({ phoneNumber: '' + cell })
    }
  },

  onPhotoTap(e) {
    var idx = parseInt(e.currentTarget.dataset.idx, 10)
    var ti = parseInt(e.currentTarget.dataset.ti, 10)
    var item = this.data.items[idx]
    if (!item || !item.thumbs || !item.thumbs.length) return
    wx.previewImage({ urls: item.thumbs, current: item.thumbs[ti] })
  }
})
