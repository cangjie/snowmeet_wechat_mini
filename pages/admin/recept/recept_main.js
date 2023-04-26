// pages/admin/recept/recept_main.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    topFrameHeight: 60,
    bottomFrameHeight: 50,
    rentSteps:[
      {component: 'confirm_item', title: '确认租赁物品'},
      {component: 'confirm_deposit', title: '确认押金'}
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
      that.setData({nextDisable: false})
    }
  },
  next(){
    var that = this
    var currentStepIndex = that.data.currentStepIndex
    var recept = that.data.recept
    var jumpUrl = 'recept_main?id=' + recept.id + '&stepIndex=' + (parseInt(currentStepIndex) + 1)
    wx.navigateTo({
      url: jumpUrl
    })
  },
  prev(){
    wx.navigateBack()
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
          var stepIndex = options.stepIndex
          if (stepIndex == undefined){
            stepIndex = 0
          }
          that.setData({recept: recept, windowHeight: windowHeight, id: options.id, currentStepIndex: stepIndex})
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