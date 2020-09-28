// pages/admin/equip_maintain/order_list/order_detail_assign/order_detail_assign.js
var wxloginModule = require('../../../../../utils/wxlogin.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    showOneButtonDialog: false,
    oneButton: [{text: '返回'}],
    task_info:{},
    user_filled_info:{},
    user_info:{},
    user_head_image:'',
    user_nick:'',
    order_date:'',
    order_time:'',
    cell:'',
    real_name:'',
    gender:'',
    user_relationship:'',
    body_length:'',
    boot_length:'',
    ski_hobby:'',
    edge_degree:'',
    candle_temperature:'',
    buy_channel:'',
    err_title:'没有新订单',
    err_msg:'目前所有订单已经都分配了客服!',
    key_task_id:0,
    dialogShow: false,
    success_message: '',
    buttons: [{text: '取消'}, {text: '确定'}]
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wxloginModule.wxlogin()
    this.setData({tabbarItemList: app.globalData.adminTabbarItem,
      tabIndex: 0})
      
      var url = 'https://' + app.globalData.domainName + '/api/get_a_new_maintain_order.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      
      wx.request({
        url: url,
        success: res => {
          if (res.data.count > 0) {
            var maintain_task =  res.data.maintain_task_arr[0].maintain_task
            var str_task_id = maintain_task.id.toString()
            str_task_id = new Array(9 - str_task_id.length).join('0')+str_task_id
            this.setData({key_task_id: maintain_task.id})
            maintain_task.id = str_task_id
            var str_card_no = maintain_task.card_no
            str_card_no = str_card_no.substring(0, 3) + '-' + str_card_no.substring(3, 6) + '-' + str_card_no.substring(6, 9)
            maintain_task.card_no = str_card_no
            this.setData({task_info: maintain_task, order_date: maintain_task.create_date.toString().split(' ')[0], order_time: maintain_task.create_date.toString().split(' ')[1]})
            this.setData({user_filled_info: res.data.maintain_task_arr[0].user_filled_info})
            url = 'https://' + app.globalData.domainName + '/api/get_official_account_user_info.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(this.data.task_info.open_id)
            wx.request({
              url: url,
              success: res => {
                this.setData({user_info: res.data})
              }
            })
          }
          else {
            this.setData({showOneButtonDialog: true})
          }
        },
        fail: res => {
          this.setData({showOneButtonDialog: true})
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
  tapDialogButton: function() {
    this.setData({showOneButtonDialog: false})
    switch(this.data.err_title){
      case '请填写必填项':
        break
      default:
        wx.navigateBack({
          delta: 0
        })
        break
    }
    
  },
  onSubmit: function() {
    var err = false
    if (this.data.gender == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请选择性别', showOneButtonDialog: true})
      err = true
    }
    if (this.data.edge_degree == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请选择修刃角度', showOneButtonDialog: true})
      err = true
    }
    /*
    if (this.data.candle_temperature == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请选择蜡温', showOneButtonDialog: true})
      err = true
    }
    */
    if (this.data.real_name == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请填写姓名', showOneButtonDialog: true})
      err = true
    }
    if (!err) {
      var postData = '{"fields_data": {"cell_number": "' + this.data.cell + '", "contact_name": "' + this.data.real_name
      + '", "contact_gender": "' + this.data.gender + '", "user_relation": "' + this.data.user_relationship
      + '", "body_length": "' + this.data.body_length + '", "boot_length": "' + this.data.boot_length
      + '", "hobby": "' + this.data.ski_hobby + '", "edge_degree": "' + this.data.edge_degree
      + '", "candle_temperature": "' + this.data.candle_temperature + '", "service_open_id": "@#$current_open_id$#@"}, '
      + ' "keys": {"id": "' + this.data.key_task_id.toString() + '"}}'
      var url = 'https://' + app.globalData.domainName + '/api/update_table.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&table=maintain_task'
      wx.request({
        url: url,
        data: postData,
        method: 'POST',
        success: res => {
          if (res.data.status == 0 && res.data.affect_rows == 1) {
            var msg = this.data.real_name.trim() + ' ' + ((this.data.gender.trim()) == '男'?'先生':'女士') + ' ' + '的订单已经指派给你，点击“确定”，联系下一位客户；点击“取消”，回到主界面。'
            this.setData({success_message: msg, dialogShow: true })

          }
        },
        fail: res => {
          var i = 0
        }
      })
    }

  },
  tapDialogButtonNext: function(e) {
    if (e.detail.index==0) {
      wx.navigateTo({
        url: '../order_list_main',
      })
    }
    else {
      wx.navigateTo({
        url: 'order_detail_assign',
      })
    }
  },
  formInputChange: function(e) {
    switch(e.currentTarget.id){
      case 'cell':
        this.setData({cell: e.detail.value})
        break
      case 'real_name':
        this.setData({real_name: e.detail.value})
        break
      case 'gender':
        if (e.target.id=='gender_male') {
          this.setData({gender: '男'})
        }
        if (e.target.id=='gender_female') {
          this.setData({gender: '女'})
        }
        break
      case 'gender_female':
        this.setData({gender: '女'})
        break
      case 'user_relationship':
        this.setData({user_relationship: e.detail.value})
        break
      case 'hobby':
        var str_hobby = ''
        for(var i = 0; i < e.detail.value.length; i++) {
          str_hobby = str_hobby + ((i>0)?',':'') + e.detail.value[i].toString()
        }
        break
      case 'edge_degree':
        this.setData({edge_degree: e.detail.value})
        break
      case 'candle_temperature':
        this.setData({candle_temperature: e.detail.value})
        break
      case 'buy_channel':
        this.setData({buy_channel: e.detail.value})
        break
      default:
        break
    }
  }


})
