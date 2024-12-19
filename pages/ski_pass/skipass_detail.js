// pages/ski_pass/skipass_detail.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    count: 1
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({id: options.id})
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
        product.sale_price_str = util.showAmount(parseFloat(product.sale_price)),
        product.market_price_str = util.showAmount(parseFloat(product.market_price))
        
        that.setData({product, summaryStr: util.showAmount(that.data.count * product.sale_price)})
        console.log('get product', product)
        var title = product.resort + ' 雪票预定'
        wx.setNavigationBarTitle({
          title: title,
        })
        that.GetRealName()
      }
    })
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
    var product = that.data.product
    var count = parseInt(e.detail.value)
    if (isNaN(count))
    {
      return
    }
    var summary = product.sale_price * count
    that.setData({count: count, summaryStr: util.showAmount(summary)})
  }

})