// components/fire/fire_charge.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({
  /**
   * Component properties
   */
  properties: {
    bizType: String,
    memberId: Number,
    cell: String,
    name: String,
    gender: String,
    shop: String
  },
  /**
   * Component initial data
   */
  data: {
    order: {
      id: 0
    }
  },
  lifetimes:{
    ready(){
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var order = that.data.order
        order.member_id = that.properties.memberId? that.properties.memberId: null
        order.contact_name = that.properties.name? that.properties.name: null
        order.contact_cell = that.properties.cell? that.properties.cell: null
        order.contact_gender = that.properties.gender? that.properties.gender: null
        order.shop = that.properties.shop
        
        order.sub_type = '雪季初临时订单'
        var type = ''
        switch(that.properties.bizType){
          case 'rent':
            order.type = '租赁'
            order.rentals = []
            break
          case 'care':
            order.type = '养护'
            order.cares = []
            break
          default:
            break
        }
        that.setData({order})
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    setAmount(e){
      var that = this
      var value = e.detail.value
      var order = that.data.order
      if (!isNaN(value)){
        order.paying_amount = parseFloat(value)
        order.total_amount = parseFloat(value)
      }
      that.setData({order})
    },
    setMemo(e){
      var that = this
      var value = e.detail.value
      var order = that.data.order
      order.memo = value
      that.setData({order})
    },
    placeOrder(e){
      var that = this
      var order = that.data.order
      order.valid = 1
      var url = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(url, order).then(function(placedOrder){
        that.setData({order: placedOrder})

      })
    },
    dealPaidResult(e){
      var that = this
      var orderId = e.detail.id
      data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
        var paid = util.orderPaid(order)
        if (paid) {
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          })
          that.triggerEvent('Jump', { url: '/pages/admin/fire/fire_order_detail?id=' + order.id })
        }
      })

    }
  }
})