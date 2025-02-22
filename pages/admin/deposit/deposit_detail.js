// pages/admin/deposit/deposit_detail.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    dealing: false,
    newBizId: undefined,
    newMemo: undefined
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    that.setData({id})
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
      that.getData()
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

  },
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/deposit/GetAccount/' + that.data.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var account = res.data
        var createDate = new Date(account.create_date)
        account.dateStr = util.formatDate(createDate)
        account.timeStr = util.formatTimeStr(createDate)
        account.income_amountStr = util.showAmount(account.income_amount)
        account.consume_amountStr = util.showAmount(account.consume_amount)
        account.avaliableAmountStr = util.showAmount(account.avaliableAmount)
        that.setData({account})
      }
    })
  },
  setInput(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    switch(id){
      case 'bizId':
        that.setData({newBizId: value})
        break
      case 'memo':
        that.setData({newMemo: value})
        break
      default:
        break
    }
  },
  mod(e){
    var that = this
    var account = that.data.account
    var content = (that.data.newBizId!=undefined && that.data.newBizId != account.biz_id)? '订单号修改为：' + that.data.newBizId : ''
    content += ' ' + ((that.data.newMemo != undefined && that.data.newMemo != account.memo) ? '备注修改为：' + that.data.newMemo : '')
    if (content.trim() == ''){
      wx.showToast({
        title: '未做任何修改',
        icon: 'error'
      })
      return
    }
    wx.showModal({
      title: '修改确认',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.setData({dealing: true})
          var bizId = that.data.newBizId == undefined? account.bizId : that.data.newBizId
          var memo = that.data.newMemo == undefined? account.memo : that.data.newMemo
          var url = 'https://' + app.globalData.domainName + '/core/deposit/ModAccountInfo/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')+'&bizId=' + encodeURIComponent(bizId) + '&memo=' + encodeURIComponent(memo) 
          wx.request({
            url: url,
            method: 'GET',
            success:(res)=>{
              var msg = ''
              var icon = 'none'
              if (res.statusCode != 200){
               msg = '修改失败'
               icon = 'error'
             } 
             else{
               msg = '修改成功'
               icon = 'success'
             }
             wx.showToast({
               title: msg,
               icon: icon
             })
            },
            complete: (res)=>{
              that.setData({dealing: false})
            }
          })
        }
      }
    })
  }
})