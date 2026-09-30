// pages/ski_pass/ski_pass_selector.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    resort: '万龙',
    productList: [],
    tabIndex: 0,
    resortArr:[]
  },

  onChange(e){
    console.log('tab change', e)
    var that = this
    var value = e.detail.index
    that.setData({productList:[], resort: that.data.resortArr[value]})
    that.GetData()
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var resort = decodeURIComponent(options.resort)
    var memberId = options.memberId
    var staffId = options.staffId
    if (memberId){
      that.setData({memberId})
    }
    if (staffId){
      that.setData({staffId})
    }
    if (!resort){
      resort = '万龙'
    }
    that.setData({resort})
    app.loginPromiseNew.then(function(resolve) {
      that.setData({tabbarItemList: app.globalData.userTabBarItem, canGetInfo: true})
      that.getResortArr()
    })
  },
  GetWanLongProduct() {
    var that = this
    var resort = that.data.resort
    if (!resort || resort == undefined || resort == 'undefined'){
      resort = '万龙'
      that.setData({resort})
    }
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetProductsByResort?showHidden=0&resort=' + encodeURIComponent(resort)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        
        if (res.statusCode != 200 ){
          return
        }
        var productList = []
        for(var i = 0; i < res.data.length; i++ ){
          var item = res.data[i]
          var product = {
            id: item.product_id,
            name: item.name,
            sale_price_str: util.showAmount(parseFloat(item.sale_price)),
            market_price_str: util.showAmount(parseFloat(item.market_price)),
            deposit_str: util.showAmount(0),
            commonDayDealPriceStr: util.showAmount(item.commonDayDealPrice),
            desc: item.rules
          }
          productList.push(product)
        }
        that.setData({productList: productList})
        console.log('get resort product', productList)
      }
    })
  },
  GetData(){
    var that = this
    that.setData({productList:[]})
    that.GetWanLongProduct()
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

  },
  gotoDetail(e){
    var that = this
    var id = e.currentTarget.id
    var url = 'skipass_detail_new?id=' + id 
    url += (that.data.memberId?('&memberId=' + that.data.memberId) : '')
    url += (that.data.staffId?('&staffId=' + that.data.staffId ): '')
    wx.navigateTo({
      url: url,
    })
  },
  getResortArr(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetResorts'
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        var resortArr = []
        if (res.statusCode != 200){
          resortArr = ['万龙', '云顶', '太舞']
        }
        else{
          // 南山已关店（2026-09-30），小程序里的南山雪票代码已删除；服务端 GetResorts 仍会返回南山，这里剔除。
          resortArr = res.data.filter(function (r) { return r != '南山' })
        }
        var tabs = []
        var activeTab = -1
        var resort = that.data.resort
        for(var i = 0; i < resortArr.length; i++){
          tabs.push({title: resortArr[i], title2:'', img: '', desc: ''})
          if (resort == resortArr[i]){
            activeTab = i
          }
        }
        // 带着列表里没有的雪场（如旧链接里的 resort=南山）进来时，落到第一个雪场，
        // 否则会按那个雪场去查商品并走万龙的下单流程。
        if (activeTab < 0){
          activeTab = 0
          resort = resortArr[0]
        }

        this.setData({ tabs,  resortArr, activeTab, resort })
        that.GetData()
      }
    })
  }
})