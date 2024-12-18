// pages/ski_pass/nanshan_overtime_reserve.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({id})
    var date = util.formatDate(new Date())
    that.setData({date})
    app.loginPromiseNew.then(function(resovle){
      that.GetSkiPassDetailInfo()
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
  GetSkiPassDetailInfo(){
    var that = this
    var getInfoUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetSkiPassDetailInfo/' + that.data.id.toString()
    wx.request({
      url: getInfoUrl,
      method: 'GET',
      success:(res)=>{
        var item = res.data
        if (item.name.indexOf('租') >= 0){
          item.desc = util.skiPassDescNanashanRent
        }
        else{
          item.desc = util.skiPassDescNanashanCommon
        }
        item.sale_price_str = util.showAmount(item.sale_price)
        item.deposit_str = util.showAmount(item.deposit)
        item.total = item.sale_price + item.deposit
        item.totalStr = util.showAmount(item.total)
        that.setData({item: item})
        var qrGetUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + encodeURIComponent('nanshanreserve_' + that.data.id.toString() + '_' + that.data.date)
        wx.request({
          url: qrGetUrl,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            that.setData({qrCode: res.data})
          }
        })
        console.log('get item', item)
        //that.CountTotal()
        //that.GetAvaliableCount()
      }
    })
  },
})