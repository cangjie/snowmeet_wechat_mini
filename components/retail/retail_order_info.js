// components/retail/retail_order_info.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    order: Object
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes: {
    ready() {
      var that = this
      var order = that.properties.order
      if (order) {
        var amount = 0
        for (var i = 0; i < order.retails.length; i++) {
          var retail = order.retails[i]
          if (retail.order_type != '招待') {
            amount += parseFloat(order.retails[i].deal_price)
          }
        }
        order.totalAmount = amount
        order.totalAmountStr = util.showAmount(amount)
        that.setData({ order })
      }
    }
  },

  /**
   * Component methods
   */
  methods: {
    dealPaidResult() {
      var that = this
      var order = e.detail
      var paid = util.orderPaid(order)
      if (paid) {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        })
        wx.navigateTo({
          url: '../../pages/admin/retail/retail_order_detail?id=' + order.id
        })
      }
    }
  }
})