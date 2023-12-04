// pages/admin/vip/maintain_recept.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    valid: false
  },

  getVipInfo(e){
    console.log('vip', e)
    var that = this
    var vip = e.detail
    var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetUnFinishedRecept/' + vip.id.toString() + '?shop=' + encodeURIComponent(that.data.shop) + '&scene=' + encodeURIComponent('养护招待') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.setData({recept: res.data})
      }
    })
  },

  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
  },

  getInnerData(e){
    console.log('check valid', e)
    var that = this
    var recept = e.detail.recept
    
    that.setData({recept: recept, valid: e.detail.Goon})

  },
  save(){
    var that = this
    console.log('recept', that.data.recept)
    var postUrl = 'https://' + app.globalData.domainName + '/core/Recept/UpdateRecept/' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: postUrl,
      method: 'POST',
      data: that.data.recept,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('saved', res.data)
        wx.navigateTo({
          url: 'recept_review?receptId=' + res.data.id,
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