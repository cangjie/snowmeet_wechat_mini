// components/rent/rent_backdrop.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    rentals: Array
  },

  /**
   * Component initial data
   */
  data: {

  },
  lifetimes: {
    ready() {
      var that = this
      var rentals = that.properties.rentals
      var wellFormed = util.checkRentalsWellForm(rentals)
      that.setData({ wellFormed, rentals })
      that.renderRentals()

    }
  },

  /**
   * Component methods
   */
  methods: {
    renderRentals() {
      var that = this
      var rentals = that.data.rentals
      var totalGuaranty = 0;
      for (var i = 0; i < rentals.length; i++) {
        var rental = rentals[i]
        rental.type = (rental.package_id && rental.package_id > 0) ? '套餐' : '单品'
        var guaranty = rental.guaranty - rental.guaranty_discount
        if (rental.noGuaranty == 1) {
          guaranty = 0
        }
        totalGuaranty += guaranty
        rental.guarantyStr = util.showAmount(guaranty)
        that.setData({ rentals,totalGuaranty, totalGuarantyStr: util.showAmount(totalGuaranty) })
        if (rental.package_id && rental.package_id > 0) {
          data.getPackagePromise(rental.package_id).then(function (rentPackage) {
            rental.name = rentPackage.name
          })
        }
        else {
          data.getRentCategoryPromise(rental.category_id).then(function(rentCategory){
            rental.name = rentCategory.name

          })
        }

      }

    },
    placeOrder(){
      var that = this
      var rentals = that.data.rentals
      var orderId = null
      for(var i = 0; rentals && i < rentals.length; i++){
        if (rentals[i].order_id && rentals[i].order_id > 0){
          orderId = rentals[i].order_id
          break
        }
      }
      var placeUrl = app.globalData.requestPrefix + 'Order/PlaceRentOrder/' + orderId + '?sessionKey=' + app.globalData.sessionKey
      util.performWebRequest(placeUrl, null).then(function(rentOrder){
        if (rentOrder.valid == 1){
          that.triggerEvent('RentOrderPaying', {})
          that.setData({order: rentOrder})
        }
      })
    },
    orderStatusChange(e){
      console.log('order status changed', e)
    },
    dealPaidResult(e) {
      var that = this
      var orderId = e.detail.id
      data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
        var paid = util.orderPaid(order)
        if (paid) {
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          })
          that.triggerEvent('Jump', { url: '/pages/admin/rent/rent_details?id=' + order.id })
        }
      })

    }
   
  }
})