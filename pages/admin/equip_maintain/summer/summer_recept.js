// pages/admin/equip_maintain/summer/summer_recept.js
Page({

  /**
   * Page initial data
   */
  data: {
    keep: true,
    address:'',
    name:'',
    cell:'',
    equipType:'',
    brand:'',
    images:''
  },
  equipInfoChanged:function(e){
    console.log(e)
  },

  inputChanged: function(e){
    var that = this
    console.log(e)
    switch(e.currentTarget.id){
      case 'keep':
        that.setData({keep: e.detail.value=='是'?true:false})
        break
      case 'name':
        that.setData({name: e.detail.value})
        break
      case 'address':
        that.setData({address: e.detail.value})
        break
      case 'cell':
        that.setData({cell: e.detail.value})
        break
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