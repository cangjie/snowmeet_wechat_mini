// pages/admin/sale/supplement.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    urgent: false,
    bizDate: '——',
    bizTime: '——',
    mi7No: 'XSD',
    shop: ''
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

  },
  userInfoUpdate(e){
    console.log('user info trig', e)
  },
  setUrgent(e){
    var that = this
    var urgent = e.detail.value
    var mi7No = ''
    var bizDate = '——'
    var bizTime = '——'
    if (urgent){
      mi7No = ''
      bizDate = util.formatDate(new Date())
      bizTime = util.formatTimeStr(new Date())
    }
    else{
      mi7No = 'XSD'
      bizDate = '——'
      bizTime = '——'
    }
    that.setData({bizDate, bizTime, mi7No, urgent})
    console.log('urgent', e)
  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.value})
  },
  checkValid(){
    var that = this
    var msg = ''
    if (that.data.shop == ''){
      msg = '必须选择店铺'
    }
    else if (urgent){
      if (that.data.bizDate == '——' || that.data.bizDate == ''
      || that.data.bizTime == '——' || that.data.bizTime == ''){
        msg = '紧急开单必须选择业务日期'
      }
    }
  }
})