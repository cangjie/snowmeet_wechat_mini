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
    newMemo: undefined,
    id: undefined,
    balanceId: undefined,
    showAll: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({id: options.id})
    if (options.balanceId != undefined){
      that.setData({balanceId: options.balanceId})
    }
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
    this.getAccount()

  },
  getAccount(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/deposit/GetAccount/' + that.data.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('get account', res.data)
        var account = res.data
        var createDate = new Date(account.create_date)
        account.dateStr = util.formatDate(createDate)
        account.timeStr = util.formatTimeStr(createDate)
        account.income_amountStr = util.showAmount(account.income_amount)
        account.consume_amountStr = util.showAmount(account.consume_amount)
        account.avaliableAmountStr = util.showAmount(account.avaliableAmount)
        var balances = account.balances
        var preDeposit = 0
        var currentDeposit = 0
        for(var i = balances.length - 1; i >= 0; i--){
          if (i == balances.length - 1){
            preDeposit = 0
            currentDeposit = balances[balances.length - 1].amount
          }
          else{
            preDeposit = balances[i + 1].currentDeposit
            currentDeposit = preDeposit + balances[i].amount
          }
          balances[i].preDeposit = preDeposit
          balances[i].currentDeposit = currentDeposit
          balances[i].preDepositStr = util.showAmount(preDeposit)
          balances[i].currentDepositStr = util.showAmount(currentDeposit)
        }
        that.setData({account})
        that.getBalance()
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
  },
  getBalance(){
    var that = this
    var account = that.data.account
    var balances = account.balances
    if (!isNaN(that.data.balanceId)){
      balances = []
      for(var i = 0; i < account.balances.length; i++){
        if (that.data.showAll || that.data.balanceId == account.balances[i].id)
        balances.push(account.balances[i])
      }
    }
    for(var i = 0; i < balances.length; i++){
      var b = balances[i]
      if (b.amount <= 0){
        b.type = '消费'
      }
      else {
        b.type = '储值'
      }
      if (b.type == '消费'){
        b.biz_type = ''
        b.biz_id = ''
        if (b.order && b.order.maintainList && b.order.maintainList.length > 0){
          b.biz_type = '养护'
          b.biz_id = b.order.maintainList[0].task_flow_num
        }
        if (b.order && b.order.rentOrderList && b.order.rentOrderList.length > 0){
          b.biz_type = '租赁'
          b.biz_id = b.order.rentOrderList[0].id
        }
      }
      b.amountStr = util.showAmount(Math.abs(b.amount))
      var createDate = new Date(b.create_date)
      b.dateStr = util.formatDate(createDate)
      b.timeStr = util.formatTimeStr(createDate)
    }
    that.setData({balances: balances})
  },
  setShow(){
    var that = this
    var showAll = !that.data.showAll
    that.setData({showAll})
    that.getBalance()
  }
})