// components/order-summary-card/index.js
// 订单详情卡片（可折叠）。仅根据 orderId 拉取并展示租赁商品名称。
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
        that.setData({
          order: order,
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
