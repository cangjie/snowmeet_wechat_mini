const util = require("../../../utils/util")
const data = require('../../../utils/data.js')
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
    socket: null,
    wellFormed: false
  },
  checkWellFormed(){
    var that = this
    var member = that.data.oriMember
    if (member == null || !member.id){
      member = that.data.updatedMember
    }
    var wellFormed = false
    if (
        ((member.cell != null && member.cell.length == 11) 
        || (that.data.contactNum != null && that.data.contactNum.length == 11 ) 
        || (member.currentContactNum != null && member.currentContactNum.length == 11))
        && member.real_name != null && member.real_name != '' && member.gender != null && member.gender != ''
    ){
      wellFormed = true
    }
    that.setData({wellFormed})
  },
  socketOpen(e) {
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
      success: (res) => {
        console.log('send command', cmdStr)
      }
    })
  },
  socketClosed(e) {

  },
  socketMessage(e) {
    console.log('socket message', e)
    var that = this
    var result = JSON.parse(e.data)
    var member = result.data
    if (member.cell == null) {
      wx.showToast({
        title: '未绑定手机号',
        icon: 'error'
      })
      return
    }
    that.setData({ memberId: null })
    that.setData({ memberId: member.id })
    //that.closeSocket()
    wx.showToast({
      title: '绑定成功',
      icon: 'success'
    })
    var socket = that.data.socket
    socket.close({
      success:()=>{
        console.log('socket will be closed')
      }
    })
  },
  socketError(e) {

  },
  closeSocket() {
    var that = this
    var member = that.data.member
    if(!member){
      return
    }
    var getUrl = app.globalData.requestPrefix + 'Member/StopQueryMemberBindCell/' + member.id.toString() + '?sessionKey=' + app.globalData.sessionKey 
    util.performWebRequest(getUrl, null).then(function(resolve){

    }).catch(function (reject){

    })
  },
  getMemberInfo(e) {
    console.log('get member info', e)
    var member = e.detail
    var that = this
    that.data.member = member
    data.getMemberPromise(member.id, app.globalData.sessionKey).then(function (oriMember) {
      that.data.oriMember = oriMember
      that.checkWellFormed()
    }).catch(function (reject) {

    })
    var socket = that.data.socket
    console.log('socket', socket)

    if (member.cell == null) {
      if (socket == null) {
        socket = wx.connectSocket({
          url: 'wss://' + app.globalData.domainName + '/ws',
          header: { 'content-type': 'application/json' }
        })
        socket.onError((res) => {
          that.socketError(res)
        })
        socket.onMessage((res) => {
          that.socketMessage(res)
        })
        socket.onOpen((res) => {
          console.log('socket open')
          that.socketOpen(res)
        })
        socket.onClose((res) => {
          that.socketClosed()
        })
        that.data.socket = socket
      }
    }
  },
  getUpdatedMemberInfo(e) {
    console.log('updated member info', e)
    var that = this
    var updatedMember = e.detail
    var oriMember = that.data.oriMember
    var needUpdate = that.data.needUpdate
    var memberId = null
    var contactNum = that.data.contactNum
    var real_name = null
    var gender = null
    var modContent = ''
    if (updatedMember.id) {
      memberId = e.detail.id
    }
    if (oriMember && updatedMember.real_name) {
      real_name = updatedMember.real_name
      if (real_name != oriMember.real_name) {
        modContent += '  姓名改为：' + real_name
        needUpdate = true
      }
    }
    if (oriMember && updatedMember.gender) {
      gender = updatedMember.gender
      if (gender != oriMember.gender) {
        modContent += '  性别改为：' + gender
        needUpdate = true
      }
    }
    if (oriMember && updatedMember.currentContactNum) {
      contactNum = updatedMember.currentContactNum ? updatedMember.currentContactNum : contactNum
      var exists = false
      for (var i = 0; oriMember && i < oriMember.contactNums.length; i++) {
        if (oriMember.contactNums[i].num == updatedMember.currentContactNum) {
          exists = true
          break
        }
      }
      if (!exists) {
        modContent += '  增加联系电话：' + updatedMember.currentContactNum
        needUpdate = true
      }
    }
    that.setData({ updatedMember, needUpdate, memberId, real_name, gender, contactNum, modContent })
    that.checkWellFormed()
  },
  updateUserInfo() {
    var that = this
    wx.showModal({
      title: '确认更新',
      content: that.data.modContent,
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          var that = this
          var updatedMember = that.data.updatedMember
          var updateUrl = app.globalData.requestPrefix + 'Member/UpdateMemberInfo?scene=' + encodeURIComponent('开单') + '&sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(updateUrl, updatedMember).then(function (resolve) {
            console.log('member info updated', resolve)
            that.setData({ memberId: null })
            that.setData({ memberId: resolve.id, needUpdate: false })
            data.getMemberPromise(member.id, app.globalData.sessionKey).then(function (oriMember) {
              that.data.oriMember = oriMember
            }).catch(function (reject) {

            })
          }).catch(function (reject) {

          })
        }
      }
    })
  },
  
  shopSelected(e) {
    console.log('shop selected', e)
    var that = this
    var shop = e.detail.shop
    var sale = e.detail.sale
    var care = e.detail.care 
    var rent = e.detail.rent
    var restuarant = e.detail.restuarant
    that.setData({ shop, sale, care, rent, restuarant})
  },
  
  gotoFlow(e){
    var that = this
    var memberId = that.data.memberId
    var realName = null
    var cell = null
    var gender = null
    var shop = that.data.shop
    if (memberId){
      realName = that.data.real_name
      gender = that.data.gender
      cell = that.data.contactNum
    }
    else{
      realName = that.data.updatedMember? that.data.updatedMember.real_name : null
      gender = that.data.updatedMember? that.data.updatedMember.gender : null
      cell = that.data.updatedMember? that.data.updatedMember.currentContactNum : null
    }
    var bizType = e.currentTarget.id 
    var fire = null
    if (bizType.indexOf('_temp') > 0){
      fire = 1
    }
    bizType = bizType.replace('_temp', '')
    var url = 'recept_new?bizType=' + bizType + '&shop=' + shop
      + (memberId? '&memberId=' + memberId.toString() : '')
      + (realName? '&realName=' + realName : '')
      + (cell? '&cell=' + cell : '')
      + (gender? '&gender=' + gender : '')
      + (fire == 1 ? '&fire=1' : '')
      //+ (e.currentTarget.id != 'retail'? '' : '&fire=1')
    wx.navigateTo({
      url: url
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
    var that = this
    that.closeSocket()
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