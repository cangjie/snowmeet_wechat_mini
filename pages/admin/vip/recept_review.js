// pages/admin/vip/recept_review.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  confirm(){
    var that = this
    var recept = that.data.recept
    var confirmUrl = 'https://' + app.globalData.domainName + '/core/Recept/ConfirmServe/' + recept.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: confirmUrl,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        switch(recept.recept_type){
          case '养护招待':
            wx.navigateTo({
              url: '../maintain/task_list'
            })
            break
          case '租赁招待':
            break
          default:
            break
        }
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var receptId = options.receptId
    
    var that = this
    that.setData({receptId: receptId})
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
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.receptId.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          switch(recept.recept_type){
            case '养护招待':
              for(var i = 0; i < recept.maintainOrder.items.length; i++){
                var item = recept.maintainOrder.items[i]
                var desc = ''
                if (item.confirmed_edge == 1){
                  desc += '修刃' + item.confirmed_degree + ' '
                }
                if (item.confirmed_candle == 1){
                  desc += '打蜡 ' 
                }
                desc += (item.confirmed_more + ' ' + item.confirmed_memo)
                item.desc = desc
              }
              break
            default:
              break
          }
          that.setData({recept: recept})
          getUrl = 'https://' + app.globalData.domainName + '/core/Vip/GetVipInfo/' + recept.cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getUrl,
            method: 'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              var vip = res.data
              that.setData({vip: vip})
              
              console.log('recept', that.data.recept)
              console.log('vip', vip)
            }
          })

        }
      })
      
    })
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

  }
})