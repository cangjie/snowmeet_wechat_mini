// pages/ski_pass/ski_pass_selector.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    resort: '南山',
    tags:'',
    reserveDate: util.formatDate(new Date()),
    productList: [],
    desc: '<p style="color:red" >test</p>',
    skiPassDescNanashanRent: util.skiPassDescNanashanRent
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    const tabs = [
      {
        title: '南山',
        title2: '',
        img: '',
        desc: '本视频系列课程，由腾讯课堂NEXT学院与微信团队联合出品，通过实战案例，深入浅出地进行讲解。',
      },
      {
        title: '万龙',
        title2: '',
        img: '',
        desc: '微信小程序直播系列课程持续更新中，帮助大家更好地理解、应用微信小程序直播功能。',
      }
    ]
    this.setData({ tabs })
    var that = this
    app.loginPromiseNew.then(function(resolve) {
      var reserveDate = new Date(that.data.reserveDate)
      var startDate = util.formatDate(reserveDate)
      var endDate = new Date()
      endDate.setDate(endDate.getDate() + 5)

      reserveDate.setDate(reserveDate.getDate() + 1)
      
      that.setData({tabbarItemList: app.globalData.userTabBarItem, tabIndex: 1, 
        role: app.globalData.role, canGetInfo: true, reserveDate: util.formatDate(reserveDate),
        startDate: startDate, endDate: util.formatDate(endDate)})
      that.GetData()
    })
  },

  DateChanged(e){
    console.log('date change', e.detail.value)
    var that = this
    that.setData({reserveDate: e.detail.value})
    that.GetData()
  },
  TagsChange(e){
    console.log('tags change', e)
    var that = this
    that.setData({tags: e.detail.value})
    that.GetData()
  },
  GetData(){
    var that = this
    var resort = encodeURIComponent(that.data.resort)
    var date = that.data.reserveDate
    var tags = that.data.tags

    var dateValue = new Date(date)
    var subTag = ''
    switch(dateValue.getDay()){
      case 6:
        subTag = '周六'
        break 
      case 0:
        subTag = '周日'
        break
      default:
        subTag = '平日'
        break
    }
    if (subTag.length > 0){
      tags = tags.length == 0 ? subTag : tags + ',' + subTag
    }
    tags = encodeURIComponent(tags)

    var getProductUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetSkiPassProduct?resort=' + resort + '&date=' + date + '&tags=' + tags
    wx.request({
      url: getProductUrl,
      method: 'GET',
      success:(res)=>{
        console.log('ski pass getted', res)
        var productList = res.data
        for(var i = 0; i < productList.length; i++){
          var prod = productList[i]
          if (prod.name.indexOf('租')>=0){
            prod.desc = util.skiPassDescNanashanRent
          }
          else{
            prod.desc = util.skiPassDescNanashanCommon
          }
          prod.sale_price_str = util.showAmount(prod.sale_price)
          prod.deposit_str = util.showAmount(prod.deposit)
        }
        that.setData({productList: productList})
      }
    })
  },
  reserve(e){
    var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'ski_pass_reserve?id=' + id + '&date=' + that.data.reserveDate,
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