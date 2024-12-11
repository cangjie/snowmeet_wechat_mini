// pages/admin/ski_pass/nanshan_card_search.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    keyword: '',
    searching: false
  },
  setKeyword(e){
    var that = this
    var v = e.detail.value
    that.setData({keyword: v})
  },
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/SearchSkipass?key=' + encodeURIComponent(that.data.keyword) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        that.setData({searching: false})
        if (res.statusCode != 200){
          return
        }
        var list = res.data
        for(var i = 0; i < list.length; i++){
          list[i].reserveDateStr = util.formatDate(new Date(list[i].reserveDate))
        }
        that.setData({list})
        console.log('list', list)
      }
    })
  },
  search(){
    var that = this
    that.setData({searching: true})
    that.getData()
    
  },
  getSkipass(id){
    var that = this
    var list = that.data.list
    var ret = undefined
    for(var i = 0; i < list.length; i++){
      for(var j = 0; j < list[i].skipasses.length; j++){
        if (list[i].skipasses[j].id == id){
          ret = list[i].skipasses[j]
          break
        }
      }
    }
    return ret
  },
  setFee(e){
    var that = this
    var id = parseInt(e.currentTarget.id)
    var value = parseInt(e.detail.value)
    var skipass = that.getSkipass(id)
    skipass.feeFilled = value
    /*
    var content = '卡号：' + skipass.card_no?skipass.card_no:'未填' + ' 姓名：' + skipass.contact_name + ' 电话：' + skipass.contact_cell + ' 消费金额：' + value.toString() + '元'
    wx.showModal({
      title: '确认消费',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          
        }
      }
    })
    */
  },
  confirmFee(e){
    
    var that = this
    var id = parseInt(e.currentTarget.id)
    var value = parseInt(e.detail.value)
    var skipass = that.getSkipass(id)
    if (!skipass.feeFilled){
      return
    }
    var content = '卡号：' + (skipass.card_no?skipass.card_no:'未填') + ' 姓名：' + skipass.contact_name + ' 电话：' + skipass.contact_cell + ' 消费金额：' + skipass.feeFilled.toString() + '元'
    wx.showModal({
      title: '确认消费金额',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          skipass.fee = skipass.feeFilled
          that.updateSkipass(skipass)
        }
      }
    })
    
    
    
    
    
    wx.showModal({
      title: '确认消费金额',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          
        }
      }
    })
  },
  updateSkipass(skipass){
    var that = this
    var modUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/UpdateSkiPass?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: modUrl,
      method: 'POST',
      data: skipass,
      success:(res)=>{
        if (res.statusCode != 200){
          if (res.statusCode == 204){
            wx.showToast({
              title: '卡号重复',
              icon: 'error',
            })
            return
          }
          wx.showToast({
            title: '更新失败',
            icon: 'error',
          })
          return
        }
        skipass.status = undefined
        var list = that.data.list
        that.setData({list})
        console.log('ski pass updated', res)
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function(resolve){

    })
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