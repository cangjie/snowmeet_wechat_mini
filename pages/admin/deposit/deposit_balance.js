// pages/admin/deposit/deposit_balance.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    cell: '',
    dealing: false,
    type: 'all'
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var currentDate = util.formatDate(new Date())
    that.setData({start: currentDate, end: currentDate})
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
    app.loginPromiseNew.then(function(resolve){

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
  gotoDetail(){
    wx.redirectTo({
      url: 'deposit_detail?id=1',
    })
  },
  setCell(e){
    var that = this
    that.setData({cell: e.detail.value})
  },
  getData(){
    var that = this
    var cell = that.data.cell
    if (cell == ''){
      that.setData({members: undefined})
      that.getBalance()
    }
    else{
      that.getAccounts()
    }
  },
  getAccounts(){
    var that = this
    var key = that.data.cell
    if (!key || (!isNaN(key) && key.length < 4) || key.length <= 1){
      wx.showToast({
        title: '比如是手机号后四位或者姓名。',
        icon: 'error'
      })
      return
    }
    that.setData({dealing: true})
    var url = 'https://' + app.globalData.domainName + '/core/deposit/SearchMember?key=' + encodeURIComponent(key) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('get members', res.data)
        var members = res.data
        var newMembers = []
        var totalIncome = 0
        var totalConsume = 0
        for(var i = 0; i < members.length; i++){
          var member = members[i]
          var order = undefined
          if (member.orders && member.orders.length > 0){
            order = member.orders[0]
          }
          member.orderDateStr = '——'
          member.orderAmountStr = '——'
          if (order){
            member.orderDateStr = util.formatDate(new Date(order.pay_time))
            member.orderAmountStr = util.showAmount(order.paidAmount)
          }
          if (member.depositAccounts && member.depositAccounts.length > 0){
            member.haveDeposit = '有'
            member.depositAmountStr = util.showAmount(member.depositAccounts[0].income_amount)
            member.depositAccounts[0].create_dateStr = util.formatDate(new Date(member.depositAccounts[0].create_date))
            member.depositAccounts[0].avaliableAmountStr = util.showAmount(member.depositAccounts[0].avaliableAmount)
            member.depositAccounts[0].consume_amountStr = util.showAmount(member.depositAccounts[0].consume_amount)
            member.depositAccounts[0].income_amountStr = util.showAmount(member.depositAccounts[0].income_amount)
            newMembers.push(member)
            totalIncome += member.depositAccounts[0].income_amount
            totalConsume += member.depositAccounts[0].consume_amount
          }
          else{
            member.haveDeposit = '无'
            member.depositAmountStr = '——'
          }
        }
        that.setData({members: newMembers,
          totalConsume, totalIncome,
          totalIncomeStr: util.showAmount(totalIncome),
          totalConsumeStr: util.showAmount(totalConsume) })

      },
      complete:(res)=>{
        that.setData({dealing: false})
      }
    })
  },
  getBalance(){
    var that = this
    that.setData({dealing: true, members: undefined})
    var getUrl = 'https://' + app.globalData.domainName + '/core/Deposit/GetAllBalance/' + that.data.type + '?start=' + that.data.start + '&end=' + that.data.end + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('get balance', res.data)
        var bArr = res.data
        var totalConsume = 0
        var totalIncome = 0
        for(var i = 0; i < bArr.length; i++){
          var b = bArr[i]
          var member = b.depositAccount.member
          b.name = member.real_name + (member.gender == '男'? '(先生)':(member.gender == '女'? '(女士)': ''))
          b.cell = member.cell
          b.type = b.amount < 0? '消费' : '储值'
          if (b.type == '消费'){
            b.biz_id = ''
            b.biz_type = ''
            totalConsume += -1 * b.amount
            if (b.order && b.order.maintainList && b.order.maintainList.length > 0){
              b.biz_type = '养护'
              b.biz_id = b.order.maintainList[0].task_flow_num
            }
            if (b.order && b.order.rentOrderList && b.order.rentOrderList.length > 0){
              b.biz_type = '租赁'
              b.biz_id = b.order.rentOrderList[0].id
            }
          }
          else {
            totalIncome += b.amount
          }
          b.amountStr = util.showAmount(Math.abs(b.amount))
          var createDate = new Date(b.create_date)
          b.date = util.formatDate(createDate)
          b.time = util.formatTimeStr(createDate)
        }
        that.setData({balances: bArr, totalConsume, totalIncome,
          totalIncomeStr: util.showAmount(totalIncome),
          totalConsumeStr: util.showAmount(totalConsume)})
      },
      complete:()=>{
        that.setData({dealing: false})
      }
    })


  },
  setType(e){
    console.log('set type', e)
    var that = this
    that.setData({type: e.detail.value})
  },
  gotoDetail(e){
    var that = this
    var id = e.currentTarget.id
    wx.redirectTo({
      url: 'deposit_detail?id=' + id,
    })
  },
  setDate(e){
    var that = this
    var value = util.formatDate(new Date(e.detail.value))
    var id = e.currentTarget.id
    switch(id){
      case 'start':
        that.setData({start: value})
        break
      case 'end':
        that.setData({end: value})
        break
      default:
        break
    }
  }
})