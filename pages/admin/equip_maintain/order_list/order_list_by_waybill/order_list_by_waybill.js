var wxloginModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    waybillNo:'',
    maintain_task_arr:[],
    maintain_task_count: '0',
    associateUserInfo:[],
    waybillIsValid: true,
    validTaskIds: '',
    haveCheckedWaybill:false,
    haveCheckedTask:'',
    msgTitle:'',
    msgBody:'',
    dialogShow:false,
    dialogButton:[{text: '确定'}]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.setData({waybillNo: options.waybillno})
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
      tabIndex: 0})
    var url = 'https://' + app.globalData.domainName + '/api/maintain_orders_get_by_waybill.aspx?waybillno=' + this.data.waybillNo+'&sessionkey='+encodeURIComponent(app.globalData.sessionKey.trim())
    wx.request({
      url: url,

      success: (res) => {
        var maintain_task_arr_temp = res.data.maintain_task_arr
        var associateUserInfo = new Array(maintain_task_arr_temp.length)
        for(var i = 0; i < maintain_task_arr_temp.length; i++) {
          var cardNo = maintain_task_arr_temp[i].card_no.toString()
          maintain_task_arr_temp[i].card_no = cardNo.substring(0, 3) + '-' + cardNo.substring(3, 6) + '-' + cardNo.substring(6, 9)
          var urlUserInfo = 'https://' + app.globalData.domainName + '/api/get_official_account_user_info.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(maintain_task_arr_temp[i].open_id)
          wx.request({
            url: urlUserInfo,
            success: (res) => {
              associateUserInfo[i] = res.data
              this.setData({associateUserInfo: associateUserInfo})
            }
          })
          
        }
        this.setData({maintain_task_count: res.data.count, maintain_task_arr: res.data.maintain_task_arr})
      }
    })
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

  },
  checkWaybill: function(source) {
    var valid = ((source.detail.value == 'yes')?1:0)
    if (valid == 1){
      this.setData({waybillIsValid: true})
    }
    else {
      this.setData({waybillIsValid: false, msgTitle: '快递有误', msgBody: '请备注用户快递包裹内物品有几个，在线提交的订单记录的物品有几个。', dialogButton: [{text: '备注'}]})
    }
    this.setData({haveCheckedWaybill: true})
  },
  checkTask: function(source) {
    var taskId = source.currentTarget.id.replace("task_radio_", "")
    var haveCheckedTask = this.data.haveCheckedTask
    if (haveCheckedTask.indexOf(taskId) < 0){
      haveCheckedTask = haveCheckedTask + ((haveCheckedTask.trim() != '')?",":"") + taskId
    }
    this.setData({haveCheckedTask: haveCheckedTask})
    if (source.detail.value == 'yes') {
      
      var validTaskIds = this.data.validTaskIds
      if (validTaskIds.indexOf(taskId) < 0){
        validTaskIds = validTaskIds + ((validTaskIds.trim() != '')?",":"") + taskId
      }
      
      this.setData({validTaskIds: validTaskIds})
    }
    else {
      this.setData({msgTitle: '快递有误', msgBody: '请备注，快递包裹中实际物品和用户提交内容不一样的情况。', dialogButton: [{text: '备注'}]})
    }
  },
  submit: function() {
    if (!this.data.haveCheckedWaybill) {
      this.setData({msgTitle: "签收未完成", msgBody: "请确认包裹内物品个数和用户提交的一致。", dialogShow: true})
    }
    if (this.data.haveCheckedTask.trim().split(',').length != this.data.maintain_task_arr.length) {
      this.setData({msgTitle: "签收未完成", msgBody: "请确认包裹内物品的实际内容和用户提交的一致。", dialogShow: true})
    }
    if (this.data.msgTitle.trim() == '快递有误') {
      this.setData({dialogShow: true})
    }
    if (this.data.msgBody == '' && this.data.msgTitle == '') {
      
      var url = 'https://' + app.globalData.domainName + '/api/waybill_confirm.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey.trim())+'&waybillno='+ encodeURIComponent(this.data.waybillNo)+'&orderids='+encodeURIComponent(this.data.validTaskIds)
      wx.request({
        url: url,
        success: (res)=>{
          if (this.data.validTaskIds.trim().split(',').length == this.data.maintain_task_arr.length && this.data.waybillIsValid) {
            this.setData({dialogButton: [{text: '打印标签'}], dialogShow: true, msgTitle: '快递签收无误', msgBody:'点击“打印标签”，开始打印任务标签。'})
          }
          else {
            this.setData({dialogButton: [{text: '返回'}], dialogShow: true, msgTitle: '快递签收有误', msgBody:'请和客户核对后再行签收。'})
          }
        }
      })
    }
  },
  tabDialogButton: function() {
    
    if (this.data.dialogButton[0].text == '返回') {
      this.setData({dialogShow: false, msgTitle: '', msgBody: ''})
      wx.navigateBack({
        delta: 0
      })
    }
    if (this.data.dialogButton[0].text = '备注'){
      var memo = this.data.memo.trim()
      if (memo!=''){
        var url = 'https://' + app.globalData.domainName + '/api/waybill_confirm.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey.trim())+'&waybillno='+ encodeURIComponent(this.data.waybillNo)+'&state=0&memo=' + encodeURIComponent(this.data.memo.toString().trim())
        wx.request({
          url: url,
          success: (res) => {
            wx.navigateBack({
              delta: 0
            })
          }
        })
      }
    }
  },
  inputMemo: function(source) {
    this.setData({memo: source.detail.value.toString().trim()})
  }
})