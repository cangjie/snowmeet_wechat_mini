// pages/admin/rent/unreturned.js
// 未归还租赁物列表（参考 snowmeet_ai_doc/templates/rent/unreturned_item.html 重做）
// 三种归类模式（顶部分段切换）：
//   按分类 → 品类 section → 顾客/订单分组 → 租赁物卡片
//   按订单 → 订单 section（顾客/订单号在 section 头）→ 租赁物卡片
//   按顾客 → 顾客 section（姓名/电话在 section 头）→ 订单分组 → 租赁物卡片
// 点击租赁物卡片携带 rentItemId 深链跳转订单明细页（明细页据此展开目标 rental + 折叠其余）
const app = getApp()
const util = require('../../../utils/util')
const data = require('../../../utils/data.js')

// 性别 → 称谓
function honorific(gender) {
  var g = ('' + (gender || '')).trim()
  if (g == '男' || g == '先生' || g.toLowerCase() == 'male' || g == 'M') return '先生'
  if (g == '女' || g == '女士' || g.toLowerCase() == 'female' || g == 'F') return '女士'
  return ''
}

function pad2(n) { return n < 10 ? '0' + n : '' + n }

// 发放至今的整天数（不为负）
function daysSince(d) {
  var days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days < 0 ? 0 : days
}

Page({

  data: {
    querying: false,
    shop: null,
    keyword: '',
    groupMode: 'category',   // 'category' | 'order' | 'customer'
    modes: [
      { key: 'category', label: '按分类' },
      { key: 'order', label: '按订单' },
      { key: 'customer', label: '按顾客' }
    ],
    allItems: [],            // 拍平后的全量租赁物（已派生品类/订单/顾客/发放等字段）
    displaySections: [],     // 当前模式 + 搜索过滤后的分组结果
    activeNames: {},         // section 展开 map，key = section._key
    groupLabel: '未归还分类',
    groupCount: 0,
    itemCount: 0
  },

  shopSelected(e) {
    this.setData({ shop: e.detail.shop })
  },

  getData() {
    var that = this
    that.setData({ querying: true })
    var shop = (!that.data.shop || that.data.shop == '') ? null : that.data.shop
    data.getUnreturnedRentItemPromise(shop, app.globalData.sessionKey).then(function (list) {
      var allItems = that.flatten(list || [])
      that.setData({ querying: false, allItems: allItems }, function () {
        that.render(true)
      })
    }).catch(function () {
      that.setData({ querying: false })
    })
  },

  // 把后端「按品类分组」的结构拍平成单层租赁物数组，每件挂上派生字段
  flatten(list) {
    var out = []
    for (var i = 0; i < list.length; i++) {
      var cat = list[i]
      var catId = (cat.category_id != null) ? cat.category_id
        : (cat.category && cat.category.id != null ? cat.category.id : null)
      var catName = (cat.category && cat.category.name) || '未分类'
      var items = cat.items || []
      for (var j = 0; j < items.length; j++) {
        var item = items[j]
        var rental = item.rental || {}
        var order = rental.order || {}
        if (item.pickDate) {
          var pd = new Date(item.pickDate)
          item.pickDateStr = util.formatDate(pd)
          item.pickTimeStr = pad2(pd.getHours()) + ':' + pad2(pd.getMinutes())
          item._rentedDays = daysSince(pd)
          item._pickTs = pd.getTime()
        } else {
          item.pickDateStr = '--'
          item.pickTimeStr = ''
          item._rentedDays = 0
          item._pickTs = Number.MAX_SAFE_INTEGER  // 无发放时间的不参与「最早订单」竞争
        }
        item._categoryId = catId
        item._categoryName = catName
        item._orderId = (order.id != null) ? order.id : null
        item._customerName = order.name || order.contact_name || '—'
        item._honorific = honorific(order.gender || order.contact_gender)
        item._cell = ('' + (order.cell || order.contact_num || '')).trim()
        item._orderCode = order.code || ('#' + (order.id || ''))
        out.push(item)
      }
    }
    return out
  },

  // 关键字过滤（编码 / 名称 / 分类名 / 顾客名 / 手机号）
  filterItems() {
    var kw = ('' + (this.data.keyword || '')).trim().toLowerCase()
    var src = this.data.allItems
    if (!kw) return src
    var out = []
    for (var i = 0; i < src.length; i++) {
      var it = src[i]
      var hit = (('' + (it.code || '')).toLowerCase().indexOf(kw) >= 0)
        || (('' + (it.name || '')).toLowerCase().indexOf(kw) >= 0)
        || (('' + (it._categoryName || '')).toLowerCase().indexOf(kw) >= 0)
        || (('' + (it._customerName || '')).toLowerCase().indexOf(kw) >= 0)
        || (('' + (it._cell || '')).toLowerCase().indexOf(kw) >= 0)
      if (hit) out.push(it)
    }
    return out
  },

  // 按当前模式把过滤后的租赁物重组为 sections
  buildSections(items, mode) {
    if (mode === 'order') return this.buildByOrder(items)
    if (mode === 'customer') return this.buildByCustomer(items)
    return this.buildByCategory(items)
  },

  // 按分类：品类 → 订单分组（头显示顾客+订单号）
  buildByCategory(items) {
    var secMap = {}, secs = []
    for (var i = 0; i < items.length; i++) {
      var it = items[i]
      var sk = (it._categoryId != null) ? ('c' + it._categoryId) : 'c_uncat'
      var sec = secMap[sk]
      if (!sec) {
        sec = { _key: sk, _icon: 'apps-o', _title: it._categoryName, _honorific: '', _cell: '', _code: '', _count: 0, _groups: [], _gmap: {} }
        secMap[sk] = sec; secs.push(sec)
      }
      var gk = (it._orderId != null) ? ('o' + it._orderId) : ('x' + i)
      var g = sec._gmap[gk]
      if (!g) {
        g = { _gkey: gk, _ghead: true, _gIcon: 'manager-o', _gLeft: it._customerName, _gHonorific: it._honorific, _gCell: it._cell, _gRight: it._orderCode, items: [] }
        sec._gmap[gk] = g; sec._groups.push(g)
      }
      g.items.push(it); sec._count++
    }
    return this.dropGmap(secs)
  },

  // 按订单：订单 → 直接列租赁物（顾客+订单号在 section 头）
  buildByOrder(items) {
    var secMap = {}, secs = []
    for (var i = 0; i < items.length; i++) {
      var it = items[i]
      var sk = (it._orderId != null) ? ('o' + it._orderId) : ('x' + i)
      var sec = secMap[sk]
      if (!sec) {
        sec = { _key: sk, _icon: 'orders-o', _title: it._customerName, _honorific: it._honorific, _cell: it._cell, _code: it._orderCode, _count: 0, _groups: [{ _gkey: 'g', _ghead: false, items: [] }] }
        secMap[sk] = sec; secs.push(sec)
      }
      sec._groups[0].items.push(it); sec._count++
    }
    return secs
  },

  // 按顾客：仅以手机号汇总（无手机号归入同一组）；称呼取最早含未归还租赁物订单的称呼
  buildByCustomer(items) {
    var secMap = {}, secs = []
    for (var i = 0; i < items.length; i++) {
      var it = items[i]
      var sk = it._cell ? ('cell:' + it._cell) : '_nocell'
      var sec = secMap[sk]
      if (!sec) {
        sec = { _key: sk, _icon: 'manager-o', _title: it._customerName, _honorific: it._honorific, _cell: it._cell, _code: '', _count: 0, _earliestTs: it._pickTs, _groups: [], _gmap: {} }
        secMap[sk] = sec; secs.push(sec)
      } else if (it._pickTs < sec._earliestTs) {
        // 出现更早的订单 → 称呼改用该订单的
        sec._earliestTs = it._pickTs
        sec._title = it._customerName
        sec._honorific = it._honorific
      }
      var gk = (it._orderId != null) ? ('o' + it._orderId) : ('x' + i)
      var g = sec._gmap[gk]
      if (!g) {
        g = { _gkey: gk, _ghead: true, _gIcon: 'orders-o', _gLeft: it._orderCode, _gHonorific: '', _gCell: '', _gRight: '', items: [] }
        sec._gmap[gk] = g; sec._groups.push(g)
      }
      g.items.push(it); sec._count++
    }
    return this.dropGmap(secs)
  },

  dropGmap(secs) {
    for (var i = 0; i < secs.length; i++) { delete secs[i]._gmap; delete secs[i]._earliestTs }
    return secs
  },

  // 渲染：过滤 → 重组 → 计数 →（可选）默认展开第一个 section
  render(resetExpand) {
    var items = this.filterItems()
    var sections = this.buildSections(items, this.data.groupMode)
    var activeNames = this.data.activeNames
    if (resetExpand) {
      activeNames = {}
      if (sections.length > 0) activeNames[sections[0]._key] = true
    }
    var labelMap = { category: '未归还分类', order: '未归还订单', customer: '未归还顾客' }
    this.setData({
      displaySections: sections,
      activeNames: activeNames,
      groupLabel: labelMap[this.data.groupMode] || '未归还分类',
      groupCount: sections.length,
      itemCount: items.length
    })
  },

  onSwitchMode(e) {
    var key = e.currentTarget.dataset.key
    if (key === this.data.groupMode) return
    var that = this
    this.setData({ groupMode: key }, function () { that.render(true) })
  },

  onKeywordInput(e) {
    var that = this
    this.setData({ keyword: e.detail.value }, function () { that.render(false) })
  },

  onToggleSection(e) {
    var k = e.currentTarget.dataset.key
    var key = 'activeNames.' + k
    this.setData({ [key]: !this.data.activeNames[k] })
  },

  call(e) {
    var cell = e.currentTarget.dataset.cell
    if (!cell) return
    wx.makePhoneCall({ phoneNumber: '' + cell })
  },

  // 深链跳转：携带订单 id + 目标 rent_item id
  gotoItem(e) {
    var ds = e.currentTarget.dataset
    if (ds.orderId == null || ds.orderId === '') return
    wx.navigateTo({
      url: '/pages/admin/rent/rent_order_detail/rent_order_detail?id=' + ds.orderId + '&rentItemId=' + ds.itemId
    })
  },

  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    }).catch(function () {})
  }
})
