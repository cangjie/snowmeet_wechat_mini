// pages/admin/recept/select_shop_business.js
const app = getApp();
Page({

  /**
   * Page initial data
   */
  data: {

  },

  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
  },

  gotoFlow(e){
    var that = this
    var id = e.currentTarget.id
    var scene = ''
    switch(id)
    {
      case 'sale':
        scene = '店销现货'
        break
      case 'rent':
        scene = '租赁下单'
        break
      case 'maintain':
        scene = '养护下单'
        break
      default:
        break

    }
    var newReceptUrl = 'https://' + app.globalData.domainName + '/core/Recept/NewRecept?openId=&scene=' + encodeURIComponent(scene) + '&shop=' + encodeURIComponent(that.data.shop) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: newReceptUrl,
      method: 'GET',
      success:(res)=>{
        console.log('new recept', e)
        if (res.statusCode != 200){
          return
        }
        wx.navigateTo({ 
          url: 'recept?id=' + res.data.id,
        })
      }
    })
   
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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

  }
})