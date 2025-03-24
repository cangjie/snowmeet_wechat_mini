// pages/admin/deposit/deposit_charge.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    dealing: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({ memberId: options.memberId })
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
    app.loginPromiseNew.then(function (resolve) {
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
  getData() {
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/deposit/GetMember/' + that.data.memberId.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    that.setData({ dealing: true })
    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        var member = res.data
        console.log('accounts', res)
        var order = undefined
        if (member.orders && member.orders.length > 0) {
          order = member.orders[0]
        }
        member.orderDateStr = '——'
        member.orderAmountStr = '——'
        if (order) {
          member.orderDateStr = util.formatDate(new Date(order.pay_time))
          member.orderAmountStr = util.showAmount(order.paidAmount)
        }
        if (member.depositAccounts && member.depositAccounts.length > 0) {
          member.haveDeposit = '有'
          member.depositAmountStr = util.showAmount(member.depositAccounts[0].income_amount)
        }
        else {
          member.haveDeposit = '无'
          member.depositAmountStr = '——'
        }
        that.setData({ member })
      },
      complete: (res) => {
        that.setData({ dealing: false })
      }
    })
  },
  input(e){
    var that = this
    var value = e.detail.value
    var id = e.currentTarget.id
    switch(id){
      case 'memo':
        that.setData({memo: value})
        break
      case 'bizId':
        that.setData({bizId: value})
        break
      case 'amount':
        that.setData({amount: value})
        break
      case 'bizType':
        that.setData({bizType: value})
        break
      default:
        break
    }
  },
  checkValid(){
    var that = this
    var memo = that.data.memo? that.data.memo:''
    var bizId = that.data.bizId? that.data.bizId:''
    var amount = that.data.amount?that.data.amount:''
    if (isNaN(amount)){
      wx.showToast({
        title: '金额必须是数字',
        icon: 'error'
      })
      return false
    }
    else if (!that.data.bizType) {
      wx.showToast({
        title: '必须选择类型',
        icon: 'error'
      })
      return false
    }
    else{
      that.setData({memo, bizId, amount})
      return true
    }
  },
  charge(){
    var that = this
    if (!that.checkValid()){
      return
    }
    var member = that.data.member
    var accountId = 0
    if (member.depositAccounts && member.depositAccounts.length > 0){
      accountId = member.depositAccounts[0].id
    }
    wx.showModal({
      title: '确认充值？',
      content: '',
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.setData({dealing: true})
          var chargeUrl = 'https://' + app.globalData.domainName + '/core/deposit/DepositCharge/' + that.data.member.id.toString() + '?accountId=' +  accountId.toString() + '&chargeAmount=' + that.data.amount + '&expireDate=2027-03-31 &sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid') + '&type=' + encodeURIComponent('服务储值') + '&subType=&mi7OrderId=' + that.data.bizId  + '&bizType=' + encodeURIComponent(that.data.bizType) + '&memo=' + encodeURIComponent(that.data.memo) 
          wx.request({
            url: chargeUrl,
            method: 'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                wx.showToast({
                  title: '充值失败',
                  icon:'error'
                })
                that.setData({dealing: false})
              }
              else{
                wx.showToast({
                  title: '充值成功',
                  icon:'success'
                })
                //that.setData({dealing: true})
                //that.getData()
                wx.navigateBack()
              }
            },
            complete:(res)=>{
              
            }
          })
        }
      }
    })
    

  }
})