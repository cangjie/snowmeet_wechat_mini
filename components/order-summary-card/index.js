// components/order-summary-card/index.js
// 订单详情卡片（可折叠）。根据 orderId 拉取并展示租赁商品 / 养护内容 / 零售单号。
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')

Component({
  properties: {
    orderId: Number
  },
  data: {
    expanded: false,
    order: null,
    rentals: [],
    payingAmountStr: ''
  },
  lifetimes: {
    attached() {
      var that = this
      app.loginPromiseNew.then(function () {
        that.loadOrder()
      })
    }
  },
  methods: {
    loadOrder() {
      var that = this
      var orderId = that.properties.orderId
      if (!orderId) return
      data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
        // 养护单：每个 care 派生一行展示名（装备 · 品牌 · 长度 + 服务描述）
        var cares = (order.cares || []).map(function (c) {
          var parts = []
          if (c.equipment) parts.push(c.equipment)
          if (c.brand) parts.push(String(c.brand).split('/')[0])
          if (c.scale) parts.push(c.scale + 'cm')
          var name = parts.join(' · ') || '养护装备'
          if (c.description && c.description !== '无') name += '（' + c.description + '）'
          return { id: c.id, name: name }
        })
        // 零售单：一单一笔，展示七色米单号（紧急开单时还没有）+ 订单类型 + 是否招待
        var retail = (order.retails || [])[0] || null
        var retailInfo = retail ? {
          mi7: retail.mi7_code || '紧急开单（待补单号）',
          type: retail.retail_type || '零售',
          entertain: (retail.order_type || '').trim() === '招待'
        } : null
        that.setData({
          order: order,
          isCare: (order.type || '').trim() === '养护',
          isRetail: (order.type || '').trim() === '零售',
          retailInfo: retailInfo,
          cares: cares,
          rentals: order.rentals || [],
          payingAmountStr: util.showAmount(order.paying_amount)
        })
        that.hydrateRentalNames()
      })
    },
    hydrateRentalNames() {
      var that = this
      var rentals = that.data.rentals
      for (var i = 0; i < rentals.length; i++) {
        (function (idx) {
          var rental = rentals[idx]
          if (rental.name) return
          if (rental.package_id && rental.package_id > 0) {
            data.getPackagePromise(rental.package_id).then(function (pkg) {
              var key = 'rentals[' + idx + '].name'
              var obj = {}
              obj[key] = pkg.name
              that.setData(obj)
            })
          } else if (rental.category_id) {
            data.getRentCategoryPromise(rental.category_id).then(function (cat) {
              var key = 'rentals[' + idx + '].name'
              var obj = {}
              obj[key] = cat.name
              that.setData(obj)
            })
          }
        })(i)
      }
    },
    onToggle() {
      this.setData({ expanded: !this.data.expanded })
    }
  }
})
