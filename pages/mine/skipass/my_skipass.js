// pages/mine/skipass/my_skipass.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    canelling: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getData()
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
    var url = 'https://' + app.globalData.domainName + '/core/SkiPass/GetMySkipass?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var list = res.data
        for(var i = 0; i < list.length; i++){
          var prod = list[i]
          
          var desc = '<ul><li>出票后不支持退换！</li><li>出票前可申请免费退换。</li><li>客服电话：17800191050。</li><li>出票当日自动出票。</li><more/></ul>'
          if (prod.product_name.indexOf('日场') >= 0){
            var subDesc = '<li>日场营业时间 9:00-17:00</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          else if (prod.product_name.indexOf('上午场') >= 0){
            var subDesc = '<li>上午场滑雪时间：9:00-13:00</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          else if (prod.product_name.indexOf('下午') >= 0){
            var subDesc = '<li>下午加夜场时间：限当日14:30后使用</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          else if (prod.product_name.indexOf('夜场') >= 0) {
            var subDesc = '<li>夜场营业时间18:30-22:00（除夕、初一仅开放日场）</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          prod.desc = desc
         
          prod.sale_price_str = util.showAmount(prod.ticket_price)
          prod.deposit_str = util.showAmount(prod.deposit)
          prod.reserve_dateStr = util.formatDate(new Date(prod.reserve_date))
          prod.deal_priceStr = util.showAmount(prod.deal_price)
          switch(prod.status){
            case '已退押金':
              prod.color = 'gray'
              break
            case '已还卡':
              prod.color = 'green'
              break
            case '已取卡':
              prod.color = 'orange'
              break
            case '已出票':
              prod.color = 'red'
              break
            default:
              break
          }

        }
        that.setData({list, canelling: false})
        console.log('ski pass list', list)
      }
    })
  },
  cancel(e){
    var that = this
    that.setData({cancelling: true})
    var id = e.currentTarget.id
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Cancel/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        console.log('cancel result', res)
        //that.setData({cancelling: false})
        that.getData()
      }
    })
  },
  refund(e){
    var that = this
    that.setData({cancelling: true})
    var id = e.currentTarget.id
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Refund?skipassId=' + id + '&reason=' + encodeURIComponent('确认取消成功后退款') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        console.log('cancel result', res)
        //that.setData({cancelling: false})
        that.getData()
      }
    })
  }
})