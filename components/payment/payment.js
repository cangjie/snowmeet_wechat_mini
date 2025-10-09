// components/payment/payment.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Component({

  /**
   * Component properties
   */
  properties: {
    orderId: Number
  },

  /**
   * Component initial data
   */
  data: {
    payMethod: null,
    othersPayMethods: ['京东收银', 'POS机刷卡', '现金', '手工填写']
  },
  lifetimes: {
    ready() {
      var that = this
      that.setData({ orderId: that.properties.orderId })
      app.loginPromiseNew.then(function (resovle) {
        that.getData()
        var getPayMethodUrl = app.globalData.requestPrefix + 'Order/GetUnCommonPayMethod'
        util.performWebRequest(getPayMethodUrl, null).then(function (resolve) {
          var inputedPayMethodList = resolve
          var othersPayMethods = ['京东收银', 'POS机刷卡', '现金']
          for (var i = 0; i < inputedPayMethodList.length; i++) {
            othersPayMethods.push(inputedPayMethodList[i])
          }
          othersPayMethods.push('手工填写')
          that.setData({ othersPayMethods })
        })
      })
    }
  },
  methods: {
    setSubPayMethod(e) {
      var that = this
      var disable = e.detail.value == that.data.othersPayMethods.length - 1
      if (disable) {
        if (that.data.inputedPayMethod) {
          disable = false
        }
      }
      that.setData({
        subPayMethodIndex: e.detail.value,
        subPayMethod: that.data.othersPayMethods[e.detail.value],
        disabledConfirmPaidButton: disable
      })
    },
    getData() {
      var that = this
      data.getOrderByStaffPromise(that.data.orderId, app.globalData.sessionKey).then(function (order) {
        console.log('order', order)
        that.setData({ order })
      })
    },
    setPayMethod(e) {
      var that = this
      console.log('set pay method', e.detail.value)
      var payMethod = e.detail.value
      switch (payMethod) {
        case '微信支付':
        case '支付宝':
          wx.showModal({
            title: '选择支付方式',
            content: '当前支付方式为：' + payMethod + '，需要支付：' + that.data.totalChargeStr + '。点击确定显示支付二维码，点击取消重新选择。',
            complete: (res) => {
              if (res.cancel) {
                that.setData({ payMethod: null })
              }
              if (res.confirm) {
                that.setData({ payMethod })
                that.showQrCode()
              }
            }
          })
          break
        default:
          that.setData({ payMethod })
          break
      }
    },
  }
})