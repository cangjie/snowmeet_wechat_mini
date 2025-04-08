// pages/admin/sale/enterain_form.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    name: '',
    cell: '',
    gender: '',
    date: util.formatDate(new Date()),
    time: util.formatTimeStr(new Date()),
    mi7: 'XSD',
    priceStr: '',
    shop: ''

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
    app.loginPromiseNew.then(function (resolve) {

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
  input(e) {
    var that = this
    var id = e.currentTarget.id
    switch (id) {
      case 'cell':
        that.setData({ cell: e.detail.value })
        if (that.data.cell.length == 11 && that.data.cell.substr(0, 1) == '1') {
          that.getMember()
        }
        break
      case 'name':
        that.setData({ name: e.detail.value })
        break
      case 'gender':
        that.setData({ gender: e.detail.value })
        break
      case 'date':
        that.setData({ date: e.detail.value })
        break
      case 'mi7':
        that.setData({ mi7: e.detail.value })
        break
      case 'price':
        that.setData({ priceStr: e.detail.value })
        break
      case 'time':
        that.setData({ time: e.detail.value })
        break
      default:
        break
    }
    
  },
  checkValid() {
    var that = this
    var msg = ''
    if (that.data.cell.length != 11 || that.data.cell.indexOf('1') != 0) {
      msg = '手机号不正确'
    }
    else if (that.data.name == '') {
      msg = '必须填姓名'
    }
    else if (that.data.gender == '') {
      msg = '必须选性别'
    }
    else if (that.data.mi7.length != 15 || that.data.mi7.indexOf('XSD') != 0
      || (that.data.mi7.substr(that.data.mi7.length - 1, 1).toUpperCase() != 'A' && that.data.mi7.substr(that.data.mi7.length - 1, 1).toUpperCase() != 'I')) {
      msg = '七色米订单号不合法'
    }
    else if (isNaN(that.data.priceStr)) {
      msg = '零售价必须是数字'
    }
    else {
      return true
    }
    wx.showToast({
      title: msg,
      icon: 'error'
    })
    return false
  },
  submit() {
    var that = this
    if (!that.checkValid()) {
      return
    }
    wx.showModal({
      title: '确认添加招待订单？',
      content: '',
      complete: (res) => {
        if (res.cancel) {

        }
        if (res.confirm) {
          that.save()
        }
      }
    })
  },
  save() {
    var that = this
    var dateStr = that.data.date + ' ' + that.data.time
    dateStr = util.formatDateTime(new Date(dateStr))
    var url = 'https://' + app.globalData.domainName + '/core/Mi7Order/Enterain/' + that.data.mi7 + '?cell=' + that.data.cell + '&name=' + encodeURIComponent(that.data.name) + '&gender=' + encodeURIComponent(that.data.gender) 
    + '&shop=' + encodeURIComponent(that.data.shop) + '&date=' + dateStr
      + ((that.data.priceStr == '') ? '' : '&price=' + that.data.priceStr) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        if (res.statusCode == 404) {
          wx.showToast({
            title: '七色米订单号重复',
            icon: 'error'
          })
          return
        }
        if (res.statusCode != 200) {
          return
        }
        wx.showModal({
          title: '添加成功',
          content: '',
          confirmText: '下一单',
          cancelText: '查看列表',
          complete: (res) => {
            if (res.cancel) {
              wx.navigateTo({
                url: 'order_list',
              })
            }
        
            if (res.confirm) {
              wx.navigateTo({
                url: 'enterain_form',
              })
            }
          }
        })
      }
    })
  },
  getMember() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/member/GetMemberByCell/' + that.data.cell + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        var member = res.data
        that.setData({ name: member.real_name, gender: member.gender })
        console.log('get member', member)
      }
    })
  },
  shopSelected(e){
    var that = this
    console.log('shop selected:', e)
    that.setData({shop: e.detail.shop})
  },
})