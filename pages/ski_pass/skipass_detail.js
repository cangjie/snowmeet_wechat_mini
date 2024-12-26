// pages/ski_pass/skipass_detail.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    count: 1,
    paying: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this

    that.setData({id: options.id, currentDate: util.formatDate(new Date()),
    memberId: options.memberId})
    that.getData()
    app.loginPromiseNew.then(function(resolve){

    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/WanlongZiwoyouHelper/GetProductById/' + that.data.id
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var product = res.data
        
        //product.sale_price_str = util.showAmount(parseFloat(product.sale_price)),
        //product.market_price_str = util.showAmount(parseFloat(product.market_price))
        
        that.setData({product})
        console.log('get product', product)
        var title = product.resort + ' 雪票预定'
        wx.setNavigationBarTitle({
          title: title,
        })

        that.GetRealName()
        that.getDailyPrice()
        that.setData({summaryStr: util.showAmount(that.data.count * that.data.dailyPrice.deal_price)})
      }
    })
  },
  getDailyPrice(){
    var that = this
    var product = that.data.product
    var currentDate = util.formatDate(new Date(that.data.currentDate))
    for(var i = 0; i < product.dailyPrice.length; i++){
      var pDate = util.formatDate(new Date(product.dailyPrice[i].reserve_date))
      if (pDate == currentDate){
        var dailyPrice = product.dailyPrice[i]
        dailyPrice.deal_priceStr = util.showAmount(parseFloat(dailyPrice.deal_price))
        dailyPrice.marketPriceStr = util.showAmount(parseFloat(dailyPrice.marketPrice))
        that.setData({dailyPrice: dailyPrice})
        break
      }
    }
  },
  GetRealName(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniUserOld?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res) => {
        if (res.data.mini_users.length > 0){
          that.setData({name: res.data.mini_users[0].real_name, cell: res.data.mini_users[0].cell_number})
        }
        
      }
    })
  },
  setCount(e){
    var that = this
    var count = parseInt(e.detail.value)
    if (isNaN(count))
    {
      return
    }
    var summary = that.data.dailyPrice.deal_price * count
    that.setData({count: count, summaryStr: util.showAmount(summary)})
  },

  submit(){
    var that = this
    var cell = that.data.cell
    var name = that.data.name
    var idNo = that.data.idNo
    var product = that.data.product
    var msg = ''
    that.setData({paying: true})
    if (!cell || cell.length != 11){
      msg = '请正确填写手机号。'
    }
    else if (!name){
      msg = '请填写姓名。'
    }
    else if (product.resort == '太舞' && !idNo){
      msg = '请填写身份证号码。'
    }
    if (!idNo){
      idNo = ''
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
        icon: 'error'
      })
      return
    }
    var submitUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/ReserveSkiPass/' + product.product_id + '?date=' + that.data.currentDate + '&count=' + that.data.count + '&cell=' + cell + '&name=' + encodeURIComponent(name) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid') + '&idNo=' + idNo + (that.data.memberId? '&refereeMemberId=' + that.data.memberId: '')
    wx.request({
      url: submitUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('skipass booked', res)
        var order = res.data
        var paymentId = order.payments[0].id
        var paymentUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/TenpayRequest/' + paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: paymentUrl,
          method: 'GET',
          success:(res) => {
            wx.requestPayment({
              nonceStr: res.data.nonce,
              package: 'prepay_id=' + res.data.prepay_id,
              paySign: res.data.sign,
              timeStamp: res.data.timeStamp,
              signType: 'MD5',
              success:(res)=>{
                wx.showToast({
                  title: '支付成功。',
                  icon: 'success',
                  complete:()=>{
                    wx.redirectTo({
                      url: '../mine/skipass/my_skipass',
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  },
  inputIdNo(e){
    var that = this
    that.setData({idNo: e.detail.value})
  },
  setDate(e){
    var that = this
    var date = new Date(e.detail.value)
    that.setData({currentDate: util.formatDate(date)})
    that.getDailyPrice()
    var dealPrice = that.data.dailyPrice.deal_price
    var count = that.data.count
    var summary = dealPrice * count
    that.setData({summaryStr: util.showAmount(summary)})
  }

})