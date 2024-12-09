// pages/admin/ski_pass/nanshan_verify.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
  },

  getData(){
    var that = this
    var param = ''
    if (that.data.memberId){
      param += 'memberId=' + that.data.memberId
    }
    if (that.data.openId){
      param += ((param!=''?'&':'') + 'wechatMiniOpenId=' + that.data.openId)
    }
    var getUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/GetMemberCard?' + param
    getUrl += '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res)=>{
        if (res.statusCode != 200){
          return
        }
        var cardList = res.data
        var cell = ''
        var name = ''
        for(var i = 0; i < cardList.length; i++){
          if (cardList[i] && cardList[i].skiPasses && cardList[i].skiPasses.length > 0){
            if (cell == ''){
              cell = cardList[i].skiPasses[0].contact_cell
            }
            if (name == ''){
              name = cardList[i].skiPasses[0].contact_name
            }
            cardList[i].reserveDateStr = util.formatDate(new Date(cardList[i].reserveDate))
          }
          
        }
        console.log('get cardList', cardList)
        that.setData({cardList, name, cell})
      }
    })
  },
  checkPickAndReturn(e){
    var that = this
    var id = e.currentTarget.id
    var idArr = id.split('_')
    var productId = idArr[0]
    var reserveDate = idArr[1]
    var pickArr = []
    var returnArr = []
    var valueArr = e.detail.value
    for(var i = 0; i < valueArr.length; i++){
      var vArr = valueArr[i].split('_')
      var act = vArr[0]
      var skipassId = vArr[1]
      switch(act){
        case 'pick':
          pickArr.push(skipassId)
          break
        case 'return':
          returnArr.push(skipassId)
          break
        default:
          break
      }
      //var cardList = that.data.cardList
      
    } 
    var card = that.getCard(productId, reserveDate)
    if (card){
       card.pickArr = pickArr
      card.returnArr = returnArr
    } 
  },

  setPick(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var productId = parseInt(idArr[0])
    var reserveDate = idArr[1]
    var card = that.getCard(productId, reserveDate)
    if (!card){
      return
    }
    console.log('card', card)
    if (!card.pickArr || card.pickArr.length < 1){
      return
    }
    var content = '确认 ' + card.name + '取卡' + card.pickArr.length.toString() + '张。'
    wx.showModal({
      title: '确认客人取卡',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
        if (res.confirm) {
          for(var i = 0; i < card.pickArr.length; i++){
            var skipass = that.getSkipass(card.pickArr[i])
            skipass.card_member_pick_time = util.formatDateString(new Date())
            that.updateSkiPass(skipass.id)
          }
          var cardList = that.data.cardList
          that.setData({cardList})
        }
      }
    })
    
  },

  getSkipass(id){
    var skipass = undefined
    var that = this
    var cardList = that.data.cardList
    var skipass = undefined
    for(var i = 0; i < cardList.length; i++){
      for(var j = 0; j < cardList[i].skiPasses.length; j++){
        var s = cardList[i].skiPasses[j]
        if (parseInt(s.id) == parseInt(id)){
          skipass = s
          break
        }
      }
    }
    return skipass
  },

  getCard(productId, dateStr){
    var card = undefined
    var that = this
    var cardList = that.data.cardList
    productId = parseInt(productId)

    for(var i = 0; i < cardList.length; i++){
      if (productId == parseInt(cardList[i].product_id)
        && util.formatDate(new Date(cardList[i].reserveDate)) == util.formatDate(new Date(dateStr))){
          card = cardList[i]
      }
    }
    return card
  },

  updateSkiPass(id){
    var that = this
    var skipass = that.getSkipass(id)
    if (skipass == undefined){
      return
    }
    var modUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/UpdateSkiPass?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: modUrl,
      method: 'POST',
      data: skipass,
      success:(res)=>{

      }
    })
  },

  setReturn(e){
    var that = this
    console.log('return', e)
    var id = e.currentTarget.id
    var skipass = that.getSkipass(id)
    if (!skipass){
      return
    }
    skipass.card_member_return_time = util.formatDateString(new Date())
    skipass.card_lost = parseInt(e.detail.value)
    skipass.newReturn = 1
  },

  saveReturn(e){
    var that = this
    var idArr = e.currentTarget.id.split('_')
    var productId = parseInt(idArr[0])
    var reserveDate = idArr[1]
    var card = that.getCard(productId, reserveDate)
    var count = 0
    for(var i = 0; i < card.skiPasses.length; i++){
      if (card.skiPasses[i].newReturn == 1){
        count++
        //card.skiPasses[i].newReturn = undefined
      }
    }
    var content = '确认 ' + card.name + '取卡' + count.toString() + '张。如果选择无卡结算，卡工本费20元会自动从押金中扣除。'
    wx.showModal({
      title: '确认退卡',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          for(var i = 0; i < card.skiPasses.length; i++){
            if (card.skiPasses[i].newReturn == 1){
              card.skiPasses[i].newReturn = undefined
              that.updateSkiPass(card.skiPasses[i].id)
            }
          }
          var cardList = that.data.cardList
          that.setData({cardList})
        }
      }
    })
  },


  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({memberId: options.memberId, openId: options.openId})
    app.loginPromiseNew.then(function(resovle){
      that.getData()
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