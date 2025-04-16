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
    shop: '',
    cell: '',
    name: '',
    gender: '',
    openId: '',
    payMethod: '微信支付'
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
    var that = this
    var userInfo = e.detail.user_info
    if (!userInfo){
      return
    }
    if (userInfo.cell_number){
      that.setData({cell: userInfo.cell_number})
    }
    if (userInfo.real_name){
      that.setData({name: userInfo.real_name})
    }
    if (userInfo.gender){
      that.setData({gender: userInfo.gender})
    }
    if (userInfo.open_id){
      that.setData({openId: userInfo.open_id})
    }
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
    var urgent = that.data.urgent
    if (that.data.shop == ''){
      msg = '必须选择店铺'
    }
    else if (urgent
      && (that.data.bizDate == '——' || that.data.bizDate == ''
      || that.data.bizTime == '——' || that.data.bizTime == '')){
      msg = '紧急开单必须选择业务日期'
    }
    else if (!urgent && (!that.data.mi7No || that.data.mi7No == '')){
      msg = '必须填写七色米订单号'
    }
    else if (isNaN(that.data.sale)){
      msg = '零售价必须是数字'
    }
    else if (isNaN(that.data.deal)){
      msg = '成交价必须是数字'
    }
    else if (!that.data.name){
      msg = '必须填写姓名'
    }
    else if (!that.data.cell || that.data.cell.length != 11){
      msg = '必须填写手机'
    }
    else if (!that.data.gender){
      msg = '必须选择性别'
    }
    if (msg == ''){
      return true
    }
    else{
      wx.showToast({
        icon: 'error',
        title: msg
      })
      return false
    }
  },
  input(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    switch(id){
      case 'mi7No':
        that.setData({mi7No: value})
        break
      case 'date':
        that.setData({bizDate: value})
        break
      case 'time':
        that.setData({bizTime: value})
        break
      case 'sale':
        that.setData({sale: value})
        break
      case 'deal':
        that.setData({deal: value})
        break
      case 'payer':
        that.setData({payer: value})
        break
      default:
        break
    }
  },
  submit(){
    var that = this
    if (!that.checkValid()){
      return
    }
    var content = ''
    if (that.data.payMethod=='微信支付'){
      //content = '微信支付订单，付款人'
      if(that.data.payer == '顾客本人'){
        content = '微信支付订单，顾客本人支付，提交后会显示支付二维码，请顾客扫码支付。'
      }
      else{
        content = '微信支付订单，店员代付，提交后请在确认页面，点击支付按钮支付。'
      }

    }
    else{
      content = '非微信支付方式，提交后订单即刻生效。'
    }
    wx.showModal({
      title: '确认提交',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.invokeApi()
        }
      }
    })
  },
  invokeApi(){

  },
  modPayMethod(e){
    var that = this
    var payMethod = e.detail.payMethod
    that.setData({payMethod: payMethod})
  }
})