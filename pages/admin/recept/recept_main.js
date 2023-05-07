// pages/admin/recept/recept_main.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    topFrameHeight: 60,
    bottomFrameHeight: 80,
    rentSteps:[
      {component: 'confirm_item', title: '确认租赁物品'},
      {component: 'confirm_deposit', title: '确认押金'},
      {component: 'confirm_final', title: '确认支付方式'},
    ],
    currentStepIndex: undefined,
    currentStepList: [],
    nextDisable: true,
    prevDisable: true
  },

  setSteps(){
    var that = this
    var recept = that.data.recept
    var currentStepList = []
    var title = ''
    switch(recept.recept_type){
      case '租赁下单':
        currentStepList = that.data.rentSteps
        break
      default:
        break
    }
    var currentStep = that.data.recept.current_step
    var currentStepIndex = that.data.currentStepIndex
    if (currentStepIndex == undefined)
    {
      for(var i = 0; i < currentStepList.length; i++){
        if (currentStepList[i].component == currentStep){
          currentStepIndex = i
          break
        }
      }
      if (currentStepIndex == undefined){
        currentStepIndex = 0
      }
      
    }
    if (currentStepIndex >= currentStepList.length){
      currentStepIndex = currentStepList[currentStepList.length - 1]
    }
    title = recept.recept_type + '-' + currentStepList[currentStepIndex].title
    wx.setNavigationBarTitle({
      title: title,
    })
    if (currentStepIndex > 0){
      that.setData({prevDisable: false})
    }
    that.setData({currentStepList: currentStepList, currentStepIndex: currentStepIndex})
  },
  checkValid(e){
    console.log('main check valid', e)
    var that = this
    if (e.detail.Goon){
      that.setData({nextDisable: false, recept: e.detail.recept})
    }
    else{
      that.setData({nextDisable: true})
    }
  },
  next(){
    var that = this
    var currentStepIndex = that.data.currentStepIndex
    var currentStepList = that.data.currentStepList
    var recept = that.data.recept
    recept.current_step = that.data.currentStepList[that.data.currentStepIndex].component
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Recept/UpdateRecept/' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: recept,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        if (currentStepIndex < currentStepList.length - 1){
          var jumpUrl = 'recept_main?id=' + recept.id + '&stepIndex=' + (parseInt(currentStepIndex) + 1)
          wx.navigateTo({
            url: jumpUrl
          })
        }
        else{
          that.submit()
        }
        
      }
    })
 
    
  },

  submit(){
    console.log('submit')
  },

  prev(){
    wx.navigateBack({
      fail:(res)=>{
        console.log('back fail')
        var that = this
        var currentStepIndex = that.data.currentStepIndex
        var recept = that.data.recept
        var jumpUrl = 'recept_main?id=' + recept.id + '&stepIndex=' + (parseInt(currentStepIndex) - 1)
          wx.navigateTo({
            url: jumpUrl
          })
      }
    })
    /*
    var that = this
    var currentStepIndex = that.data.currentStepIndex

    var recept = that.data.recept
    var jumpUrl = 'recept_main?id=' + recept.id + '&stepIndex=' + (parseInt(currentStepIndex) - 1)
    wx.redirectTo({
      url: jumpUrl
    })
    */
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    /*
    var winInfo = wx.getWindowInfo()
    that.setData({id: options.id, currentStepIndex: options.stepIndex,
      windowHeight: winInfo.windowHeight - winInfo.statusBarHeight})
    */

    app.loginPromiseNew.then(function (resolve){
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + options.id + '?sessionKey=' + app.globalData.sessionKey
      wx.request({
        url: getUrl,
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          var windowHeight = 0
          if (app.globalData.systemInfo.safeArea != null){
            windowHeight = app.globalData.systemInfo.safeArea.height
          }
          else{
            windowHeight = app.globalData.systemInfo.windowHeight 
          }

          /*
          var stepIndex = options.stepIndex
          if (stepIndex == undefined){
            var currentStep = recept.current_step

            stepIndex = 0
          }
          */
          that.setData({recept: recept, windowHeight: windowHeight, id: options.id, currentStepIndex: options.stepIndex})
          that.setSteps()
        }
      })

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