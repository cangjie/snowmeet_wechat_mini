// pages/admin/rent/settings/rent_package_list.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    newName: ''
  },

  getData(){
    var that = this
    var getList = 'https://' + app.globalData.domainName + '/api/Rent/GetRentPackageList'
    wx.request({
      url: getList,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.setData({packageList: res.data})
      }
    })
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'rent_package?id=' + e.currentTarget.id,
    })
  },

  setNewName(e){
    var that = this
    that.setData({newName: e.detail.value})

  },

  addNew(e){
    var that = this
    wx.showModal({
      title: '即将添加新套餐',
      content: '套餐名称：' + that.data.newName  ,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          var addUrl = 'https://' + app.globalData.domainName + '/api/Rent/AddRentPackage?'
          + 'name=' + encodeURIComponent(that.data.newName) + '&description='
          + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
          wx.request({
            url: addUrl,
            method: 'GET',
            success:(res)=>{
              wx.showToast({
                title: '添加成功，进入详情页填写详细信息。',
                icon: 'success'
              })
              wx.navigateTo({
                url: 'rent_package?id=' + res.data.id
              })
            }
          })
        }
      }
    })
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

  }
})