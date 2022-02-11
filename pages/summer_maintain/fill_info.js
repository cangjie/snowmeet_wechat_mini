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
    itemToPost:'',
    labelNo: '',
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