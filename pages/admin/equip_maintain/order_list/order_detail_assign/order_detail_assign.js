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
    err_msg:'目前所有订单已经都分配了客服!'
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
    if (this.data.gender == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请选择性别', showOneButtonDialog: true})
    }
    if (this.data.edge_degree == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请选择修刃角度', showOneButtonDialog: true})
    }
    if (this.data.candle_temperature == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请选择蜡温', showOneButtonDialog: true})
    }
    if (this.data.real_name == '') {
      this.setData({err_title: '请填写必填项', err_msg: '请填写姓名', showOneButtonDialog: true})
    }
    var postData = 'cell_number=' + encodeURIComponent(this.data.cell) + '&contact_name=' + encodeURIComponent(this.data.real_name)
      + '&contact_gender=' + encodeURIComponent(this.data.gender) + '&user_relation=' + encodeURIComponent(this.data.user_relationship)
      + '&body_length=' + encodeURIComponent(this.data.body_length) + '&boot_length=' + encodeURIComponent(this.data.boot_length)
      + '&hobby=' + encodeURIComponent(this.data.ski_hobby) + '&edge_degree=' + encodeURIComponent(this.data.edge_degree)
      + '&candle_temperature=' + encodeURIComponent(this.data.candle_temperature)
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
