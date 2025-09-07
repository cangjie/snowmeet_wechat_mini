const util = require("../../../utils/util")

// pages/admin/recept/recept_member_info.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needUpdate: false,
    score: 0,
    totalScore: 0,
    shop: '',
    valid: false,
    invalid: true,
    socket: null
  },
  getMemberInfo(e) {
    console.log('get member info', e)
    var member = e.detail
    var that = this
    that.data.member = member
    var socket = that.data.socket
    if (member.cell == null){
      socket = wx.connectSocket({
        url: 'wss://' + app.globalData.domainName + '/ws',
        header:{'content-type': 'application/json'}
      })
      socket.onError((res)=>{
        that.socketError(res)
      })
      socket.onMessage((res)=>{
        that.socketMessage(res)
      })
      socket.onOpen((res)=>{
        console.log('socket open')
        that.socketOpen(res)
      })
      socket.onClose((res)=>{
        that.socketClosed()
      })
      that.data.socket = socket
    }
  },
  socketOpen(e){
    var that = this
    var socket = that.data.socket
    var socketCmd = {
      command: 'querybindcell',
      id: that.data.member.id,
      sessionKey: decodeURIComponent(app.globalData.sessionKey)
    }
    var cmdStr = JSON.stringify(socketCmd)
    socket.send({
      data: cmdStr,
      success:(res)=>{
        console.log('send command', cmdStr)
      }
    })
  },
  socketClosed(e){

  },
  socketMessage(e){
    console.log('socket message', e)
    var that = this
    var result = JSON.parse(e.data)
    var member = result.data
    if (member.cell == null){
      wx.showToast({
        title: '未绑定手机号',
        icon: 'error'
      })
      return
    }
    that.setData({memberId: null})
    that.setData({memberId: member.id})
    that.closeSocket()
    wx.showToast({
      title: '绑定成功',
      icon: 'success'
    })
  },
  socketError(e){

  },
  closeSocket(){
    var that = this
    var socket = that.data.socket
    socket.close({
      success:()=>{
        console.log('socket will be closed')
      }
    })
  },
  getUpdatedMemberInfo(e) {
    console.log('updated member info', e)
    var that = this
    var updatedMember = e.detail
    var memberId = null
    var contactNum = null
    var real_name = null
    var gender = null
    if (updatedMember.id){
      memberId = e.detail.id
    }
    if (updatedMember.real_name){
      real_name = updatedMember.real_name
    }
    if (updatedMember.gender){
      gender = updatedMember.gender
    }
    if (updatedMember.currentContactNum){
      contactNum = updatedMember.currentContactNum
    }
    that.setData({ updatedMember, needUpdate: true, memberId, real_name, gender, contactNum })
  },
  updateUserInfo() {
    wx.showModal({
      title: '确认更新',
      content: '',
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          var that = this
          var updatedMember = that.data.updatedMember
          var updateUrl = app.globalData.requestPrefix + 'Member/UpdateMemberInfo?scene=' + encodeURIComponent('开单') + '&sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(updateUrl, updatedMember).then(function (resolve) {
            console.log('member info updated', resolve)
          }).catch(function (reject) {

          })
        }
      }
    })


  },
  /*
  getScore() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Point/GetUserPointsSummary?openId=' + that.data.openId + '&openIdType=snowmeet_mini'
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        that.setData({ score: res.data })
        getUrl = 'https://' + app.globalData.domainName + '/core/Point/GetUserPointsTotalEarned?openId=' + that.data.openId + '&openIdType=snowmeet_mini'
        wx.request({
          url: getUrl,
          method: 'GET',
          success: (res) => {
            if (res.statusCode != 200) {
              return
            }
            that.setData({ totalScore: res.data })
          }
        })
      }
    })
  },
  */
  shopSelected(e) {
    console.log('shop selected', e)
    var that = this
    var shop = e.detail.shop
    var invalid = false
    if (shop == '') {
      invalid = true
    }
    that.setData({ shop: e.detail.shop, invalid })
  },
  gotoFlow(e) {
    var that = this
    var id = e.currentTarget.id
    var naviUrl = 'verify_items?memberId=' + that.data.memberId + '&type=' + id
    if (id == 'sale') {
      naviUrl = 'recept_new?type=' + id + '&memberId=' + that.data.memberId
    }
    wx.navigateTo({
      url: naviUrl,
    })
  },
  selectTicket(e) {
    console.log('select ticket', e)
    var code = e.detail.code
    var that = this
    that.setData({ ticketCode: code })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.memberId != undefined) {
      that.setData({ memberId: options.memberId })
    }
  },
  onShow() {
    //var that = this
    //that.getScore()
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
    var that = this
    that.closeSocket()
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

  }
})