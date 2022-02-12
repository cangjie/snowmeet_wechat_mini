// pages/summer_maintain/fill_info.js
Page({

  /**
   * Page initial data
   */
  data: {
    equipType: '',
    brand:'',
    scale:'',
    binderBrand:'',
    binderColor:'',
    sendItem:'万龙存板牌',
    wanlongNo: '',
    associateItem: '',
    keep: true,
    contactName:'',
    address:'',
    cell:''
  },

  getSelectedBrand: function(e){
    console.log(e)
  },

  inputChanged: function(e){
    var that = this
    console.log(e)
    switch(e.type){
      case 'BrandSelected':
        that.setData({equipType: e.detail.equipType, brand: e.detail.brand})
      default:
        switch(e.currentTarget.id){
          case 'scale':
            that.setData({scale: e.detail.value})
            break
          case 'sendItem':
            that.setData({sendItem: e.detail.value})
            break
          case 'keep':
            var keep = (e.detail.value=='是')?true:false
            that.setData({keep: keep})
            break
          default:
            break
        }
        break
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {

  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})