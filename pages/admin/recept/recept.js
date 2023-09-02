// pages/admin/recept/recept.js
const app = getApp()
const topFrameHeightMax = 360
const topFrameHeightMin = 60
const bottomFrameHeightMax = 360
const bottomFrameHeightMin = 60
const rentStep = [{name:'confirm_item', title:'选择租赁物品'}, {name: 'confirm_deposit', title:'确认支付押金'}]
const maintainStep = [{name: 'maintain_log', title:'养护记录'}, {name: 'maintain_item', title:'添加装备并拍照'}, {name: 'maintain_charge', title:'添加装备并拍照'}]
Page({

  /**
   * Page initial data
   */
  data: {
    topFrameHeight: topFrameHeightMin,
    bottomFrameHeight: bottomFrameHeightMin,
    ticketCode: '',
    ticketName: '',
    bottomShowDetail: false,
    gotoNext: false,
    gotoPrev:false
  },
  getInnerData(e){
    console.log('get data', e)
    var that = this
    var recept = that.data.recept
    switch(recept.recept_type){
      case '租赁下单' :
        if (!e.detail.Goon){
          return
        }
        if (e.detail.recept.rentOrder!=null){
          var rentOrder = e.detail.recept.rentOrder
          if (rentOrder.details != null){
            var deposit = 0
            for(var i = 0; i < rentOrder.details.length; i++){
              deposit += rentOrder.details[i].deposit
            }
            rentOrder.deposit = deposit
          }
          recept.rentOrder = rentOrder
        }
        break
      default:
        break
    }
    that.setData({recept: recept, gotoNext: e.detail.Goon})
  },

  changeBottom(e){
    var that = this
    console.log('bottom tapped', e)
    var bottomShowDetail = that.data.bottomShowDetail
    bottomShowDetail = !bottomShowDetail
    that.setData({bottomShowDetail: bottomShowDetail})
    var oriBottomFrameHeight = that.data.bottomFrameHeight
    
    var targetBottomFrameHeight = that.data.windowHeight - 100
    if (!bottomShowDetail){
      targetBottomFrameHeight = that.data.oriBottomFrameHeight
    }
    that.setData({oriBottomFrameHeight: oriBottomFrameHeight, targetBottomFrameHeight: targetBottomFrameHeight})
    that.resizeBottom()
  },

  resizeBottom(){
    var that = this
    var bottomShowDetail = that.data.bottomShowDetail
    var bottomFrameHeight = that.data.bottomFrameHeight
    var target = that.data.targetBottomFrameHeight
    var stop = false
    if (bottomShowDetail){
      bottomFrameHeight+=10
      if (bottomFrameHeight >= target ){
        stop = true
      }
    }
    else{
      bottomFrameHeight-=10
      if (bottomFrameHeight <= target){
        stop = true
      }
    }
    that.setData({bottomFrameHeight: bottomFrameHeight})
    if (!stop){
      setTimeout(()=>{this.resizeBottom()}, 1)
    }
    
  },

  saveJump(e){
    var id = e.currentTarget.id
    var that = this
    var recept = that.data.recept
    switch(id){
      case 'prev':
        recept.current_step--
        break
      case 'next':
        recept.current_step++
        break
      default:
        break
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Recept/UpdateRecept/' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method:'POST',
      data: recept,
      success:(res)=>{
        console.log('recept update', res)
        if (res.statusCode != 200){
          return
        }
        wx.navigateTo({
          url: 'recept?id=' + recept.id
        })
      }
    })
  },
  confirm(){
    var that = this
    var recept = that.data.recept
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Recept/UpdateRecept/' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method:'POST',
      data: recept,
      success:(res)=>{
        console.log('recept update', res)
        if (res.statusCode != 200){
          wx.showToast({
            title: '系统出错',
            icon: 'error'
          })
          return
        }
        var id = res.data.id
        var placeOrderUrl = 'https://' + app.globalData.domainName + '/core/Recept/PlaceOrder/' + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: placeOrderUrl,
          method: 'GET',
          success:(res)=>{
              if (res.statusCode != 200){
                wx.showToast({
                    title: '系统出错',
                    icon: 'error'
                  })
                  return
              }
              wx.navigateTo({
                url: 'recept_summary?id=' + res.data.id,
              })
          }
        })
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
   
    var stepIndex = 0
    if (options.stepIndex != undefined){
      stepIndex = parseInt(option.stepIndex)
    }
    that.setData({id: options.id, stepIndex: stepIndex})
    app.loginPromiseNew.then(function (resolve){
      console.log('page resolve', resolve)
      var windowHeight = 0
      var windowWidth = 0
      if (app.globalData.systemInfo.safeArea != null){  
        windowHeight = app.globalData.systemInfo.safeArea.height  * 0.95
        windowWidth = app.globalData.systemInfo.safeArea.width
        console.log('safeArea', windowWidth)
      }
      else{
        windowHeight = app.globalData.systemInfo.windowHeight
        windowWidth = app.globalData.systemInfo.windowWidth
        console.log('unsafeArea', windowWidth)
      }
      that.setData({windowHeight: windowHeight, windowWidth: windowWidth})
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
    var that = this
    app.loginPromiseNew.then(function (resolve){
      console.log('recept on onShow')
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.id 
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          console.log('get recept', res)
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          var stepIndex = parseInt(recept.current_step)
          if (isNaN(stepIndex)){
            stepIndex = 0
          }
          switch(recept.recept_type){
            case '租赁下单':
                that.setData({steps: rentStep, stepIndex: stepIndex})
                break
            case '养护下单':
                that.setData({steps: maintainStep, stepIndex: stepIndex})
                break
            default:
              break
          }
          recept.deposit_real = recept.deposit
          that.setData({recept: recept, gotoPrev: stepIndex > 0})
          wx.setNavigationBarTitle({
            title: recept.shop + '-' + recept.recept_type + '-' + that.data.steps[that.data.stepIndex].title
          })
          var getUserUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniAppUser?openId=' + encodeURIComponent(recept.open_id)
          + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getUserUrl,
            method:'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              that.setData({user: res.data})
              if (recept.code != ''){
                var getTicketUrl = 'https://' + app.globalData.domainName + '/core/GetTicket/' + recept.code
                wx.request({
                  url: getTicketUrl,
                  method: 'GET',
                  success:(res)=>{
                    if (res.statusCode != 200){
                      return
                    }
                    that.setData({ticketCode: recept.code, ticketName: res.data.name})
                  }
                })
              }
            }
          })
        }
      })
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

  }
})