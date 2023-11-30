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
    skiPassDescNanashanRent: util.skiPassDescNanashanRent,
    nowTime: util.formatTimeStr(new Date()),
    reserveDateDesc: '今天'
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
      var nowDate = new Date()

      var startDate = util.formatDate(reserveDate)
      var endDate = new Date()
      endDate.setDate(endDate.getDate() + 5)

      if (util.formatTimeStr(new Date()) > '16:00:00'){
        reserveDate.setDate(reserveDate.getDate() + 1)
      }
      else{
        reserveDate.setDate(reserveDate.getDate())
      }
      var reserveDateDesc = ''
      switch(reserveDate.getDate() - nowDate.getDate()){
        case 0:
          reserveDateDesc = '今天'
          break
        case 1:
          reserveDateDesc = '明天'
          break
        case 2:
          reserveDateDesc = '后天'
          break
        case 3:
          reserveDateDesc = '大后天'
          break
        default:
          break
      }


      
      
      that.setData({tabbarItemList: app.globalData.userTabBarItem, tabIndex: 1, 
        role: app.globalData.role, canGetInfo: true, reserveDate: util.formatDate(reserveDate),
        startDate: startDate, endDate: util.formatDate(endDate), reserveDateDesc: reserveDateDesc})
      that.GetData()
    })
  },

  DateChanged(e){
    console.log('date change', e.detail.value)
    var that = this
    var reserveDate = e.detail.value
    var reserveDateValue = new Date(reserveDate)
    var reserveDateDesc = ''
    //that.setData({reserveDate: reserveDate})
    var now = new Date()
    switch(reserveDateValue.getDate() - now.getDate()){
      case 0:
        reserveDateDesc = '今天'
        break
      case 1:
        reserveDateDesc = '明天'
        break
      case 2:
        reserveDateDesc = '后天'
        break
      case 3:
        reserveDateDesc = '大后天'
        break
      default:
        
        break
    }
    switch(reserveDateValue.getDay()){
      case 0:
        reserveDateDesc += '周日'
        break
      case 1:
        reserveDateDesc += '周一'
        break
      case 2:
        reserveDateDesc += '周二'
        break
      case 3:
        reserveDateDesc += '周三'
        break
      case 4:
        reserveDateDesc += '周四'
        break
      case 5:
        reserveDateDesc += '周五'
        break
      case 6:
        reserveDateDesc += '周六'
        break
      default:
        break

    }
    that.setData({reserveDate: reserveDate, reserveDateDesc: reserveDateDesc})

/*
    if (now.getDate() == reserveDate.getDate()){

    }
    */
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
          if (prod.end_sale_time <= that.data.nowTime  && util.formatDate(new Date()) == util.formatDate(new Date(that.data.reserveDate))){
            productList.splice(i, 1)
            i--
          }
          var desc = '<ul><li>出票后不支持退换！</li><li>出票前可申请免费退换</li><li>出票当日自动出票</li><more/></ul>'
          if (prod.name.indexOf('日场') >= 0){
            var subDesc = '<li>日场营业时间 9:00-17:00</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          else if (prod.name.indexOf('上午场') >= 0){
            var subDesc = '<li>上午场滑雪时间：9:00-13:00</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          else if (prod.name.indexOf('下午') >= 0){
            var subDesc = '<li>下午加夜场时间：限当日14:30后使用</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          else if (prod.name.indexOf('夜场') >= 0) {
            var subDesc = '<li>夜场营业时间18:30-22:00（除夕、初一仅开放日场）</li>'
            desc = desc.replace('<more/>', subDesc)
          }
          prod.desc = desc
         
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
  tabSwitch: function(e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
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