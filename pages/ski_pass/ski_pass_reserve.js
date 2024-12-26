// pages/ski_pass/ski_pass_reserve.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    needAuth: false,
    date: null,
    name:'',
    count: 1,
    cell: '',
    total: '',
    avaliableCount:0,
    tabIndex: 0
  },

  GetSkiPassDetailInfo(){
    var that = this
    var getInfoUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetSkiPassDetailInfo/' + that.data.id.toString()
    wx.request({
      url: getInfoUrl,
      method: 'GET',
      success:(res)=>{
        var item = res.data
        if (item.name.indexOf('租') >= 0){
          item.desc = util.skiPassDescNanashanRent
        }
        else{
          item.desc = util.skiPassDescNanashanCommon
        }
        item.sale_price_str = util.showAmount(item.sale_price)
        item.deposit_str = util.showAmount(item.deposit)
        that.setData({item: item})
        that.CountTotal()
        that.GetAvaliableCount()
      }
    })
  },

  CountTotal(){
    var that = this
    var total = (that.data.item.sale_price + that.data.item.deposit) * that.data.count
    if (!isNaN(total)){
      that.setData({total: util.showAmount(total)})
    }
    
  },

  GetAvaliableCount(){

    
    var that = this
    /*
    var url = 'https://' + app.globalData.domainName + '/core/SkiPass/CheckNanshanReserveAvaliabelCount/' + that.data.id + '?date=' + util.formatDate(new Date(that.data.date))
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        that.setData({avaliableCount: parseInt(res.data)})
      }
    })
    */
    that.setData({avaliableCount:99999})
  },

  input(e){
    var that = this
    switch(e.currentTarget.id){
      case 'cell':
        that.setData({cell: e.detail.value})
        break
      case 'name':
        that.setData({name: e.detail.value})
        break
      case 'count':
        var count = parseInt(e.detail.value)
        that.setData({count: count})
        that.GetAvaliableCount()
        that.CountTotal()
        break
      default:
        break
    }
    
  },

  GetRealName(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniUserOld?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res) => {
        if (res.data.mini_users.length > 0){
          that.setData({name: res.data.mini_users[0].real_name, cell: res.data.mini_users[0].cell_number})
        }
        
      }
    })
  },

  AuthFinish(){
    var that = this
    that.GetRealName()
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var memberId = options.memberId
    that.setData({id: options.id, date: options.date, tabbarItemList: app.globalData.userTabBarItem, memberId})
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.cellNumber==undefined || app.globalData.cellNumber==null || app.globalData.cellNumber==''){
        that.setData({needAuth: true})
        that.GetSkiPassDetailInfo()
      }
      else{
        that.setData({cell: app.globalData.cellNumber})
        that.GetSkiPassDetailInfo()
      }
      if (app.globalData.userInfo != undefined && app.globalData.userInfo != null && app.globalData.userInfo.real_name != null){
        that.setData({name: app.globalData.userInfo.real_name})
      }
      that.GetRealName()
    })
  },

  submit(){
    console.log('reserve')
    var valid = true
    var that = this
    var name = that.data.name
    var cell = that.data.cell
    var count = that.data.count
    if (cell.length != 11){
      wx.showToast({
        title: '请填写手机号。',
        icon: 'error'
      })
      valid = false
    }
    else if (name == ''){
      wx.showToast({
        title: '请填写姓名。',
        icon: 'error'
      })
      valid = false
    }
    else if (isNaN(count)){
      wx.showToast({
        title: '请填写购票数量。',
        icon: 'error'
      })
      valid = false
    }
    if (!valid){
      return
    }
    var submitUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/ReserveSkiPass/' + that.data.id + '?date=' + util.formatDate(new Date(that.data.date)) + '&count=' + that.data.count + '&cell='  + that.data.cell + '&name=' + encodeURIComponent(that.data.name) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + (that.data.memberId?'&refereeMemberId=' + that.data.memberId: '')
    wx.request({
      url: submitUrl,
      method: 'GET',
      success:(res)=>{
        console.log('reserve order create', res)
        var order = res.data
        var paymentId = order.payments[0].id
        var paymentUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/TenpayRequest/' + paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: paymentUrl,
          method: 'GET',
          success:(res) => {
            wx.requestPayment({
              nonceStr: res.data.nonce,
              package: 'prepay_id=' + res.data.prepay_id,
              paySign: res.data.sign,
              timeStamp: res.data.timeStamp,
              signType: 'MD5',
              success:(res)=>{
                wx.showToast({
                  title: '支付成功。',
                  icon: 'success',
                  success:()=>{
                    wx.redirectTo({
                      url: '../mine/skipass/my_skipass',
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
    //console.log(submitUrl)

  },
  tabSwitch: function(e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
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
  getCell(e){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateWechatMemberCell?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(e.detail.encryptedData)+'&iv='+encodeURIComponent(e.detail.iv)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var member = res.data
        console.log('get member', member)
        that.setData({cell: member.cell})
      }
    })
  }

})