// pages/admin/ski_pass/common_skipass_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    dayType:['平日','周末','节假日'],
    saving: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    that.setData({id: id})
    app.loginPromiseNew.then(function(resolve){
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

  },
  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetProduct/' + that.data.id
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var product = res.data
        console.log('product', product)
        for(var i = 0; i < product.avaliablePriceList.length; i++){
          var item = product.avaliablePriceList[i]
          var rDate = new Date(item.reserve_date)
          product.avaliablePriceList[i].reserve_dateStr = util.formatDate(rDate)
          product.avaliablePriceList[i].settlementPriceStr = util.showAmount(parseFloat(product.avaliablePriceList[i].settlementPrice))
        }
        wx.setNavigationBarTitle({
          title: product.name,
        })
        that.setData({product})
        that.setColor()
      }
    })
  },
  setColor(){
    var that = this
    var product = that.data.product
    for(var i = 0; i < product.avaliablePriceList.length; i++){
      var item = product.avaliablePriceList[i]
      var rDate = new Date(item.reserve_date)
      var day = rDate.getDay()
      if (day == 0 || day == 6){
        if (item.day_type == '平日'){
          item.color = 'red' 
        }
        item.backColor = '#00bfff'
      }
      else{
        if (item.day_type == '周末'){
          item.color = 'red'
          item.backColor = ''
        }
      }
      if (item.day_type == '节假日'){
        item.color = 'red'
        item.backColor = 'yellow'
      }
    }
    that.setData({product})
  },
  setTotalPrice(e){
    var id = e.currentTarget.id
    var price = parseFloat(e.detail.value)
    if (isNaN(price)){
      return
    }
    var that = this
    var product = that.data.product
    if (id == 'common'){
      product.commonDayDealPrice = price
      //product.mod = true
    }
    if (id == 'weekend'){
      product.weekendDealPrice = price
      //product.mod = true
    }
    for(var i = 0; i < product.avaliablePriceList.length; i++){
      var item = product.avaliablePriceList[i]
      if (item.day_type == '周末' && id == 'weekend'){
        item.deal_price = price
        item.mod = true
      }
      if (item.day_type == '平日' && id == 'common'){
        item.deal_price = price
        item.mod = true
      }
    }
    that.setData({product})
    that.setColor()
  },
  setDayType(e){
    var id = e.currentTarget.id
    var that = this
    var product = that.data.product
    for(var i = 0; i < product.avaliablePriceList.length; i++){
      var item = product.avaliablePriceList[i]
      if (item.id == parseInt(id)){
        item.day_type = that.data.dayType[e.detail.value]
        item.mod = true
      }
    }
    that.setData({product})
    that.setColor()
  },
  setItemPrice(e){
    var id = e.currentTarget.id
    var that = this
    var product = that.data.product
    if (e.detail.value[e.detail.value.length - 1] == '.'){
      return
    }
    var price = parseFloat(e.detail.value)
    if (isNaN(price) || price == 0){
      return
    }
    for(var i = 0; i < product.avaliablePriceList.length; i++){
        var item = product.avaliablePriceList[i]
        if (item.id == id){
        item.mod = true
        item.deal_price = price
      }
    }
    that.setData({product})
  },
  setHidden(e){
    var that = this
    var product = that.data.product
    var hidden = e.detail.value
    product.hidden = parseInt(hidden)
    product.mod = true
    that.setData({product})
  },
  save(){
    var that = this
    var product = that.data.product
    that.setData({saving: true})
    wx.showModal({
      title: '确认保存？',
      content: product.name,
      complete: (res) => {
        if (res.cancel) {
          that.setData({saving: false})
        }
    
        if (res.confirm) {
          if (product.mod==true){
            that.updateProduct()
          }
          that.updateDailyPrice()

        }
      }
    })
  },
  updateProduct(){
    var that = this
    var product = that.data.product
    var updateUrl = 'https://' + app.globalData.domainName + '/core/Product/SetHidden/' + product.product_id.toString() + '?hidden=' + product.hidden + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) 
    product.mod = false
    wx.request({
      url: updateUrl,
      method: 'GET',
      success:(res)=>{
        that.setData({saving: false})
        if (res.statusCode != 200){
          return
        }
        var msg = product.hidden == 0 ? '该商品已上架' : '该商品已下架'
        wx.showToast({
          title: msg,
          icon: 'success'
        })
      }
    })
  },
  updateDailyPrice(){
    var that = this
    var product = that.data.product
    for(var i = 0; i < product.avaliablePriceList.length; i++){
      var item = product.avaliablePriceList[i]
      if (item.mod==true){
        item.mod = false
        var updateUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/ModDailyPrice/' + item.id + '?price=' + encodeURIComponent(item.deal_price) + '&dayType=' + encodeURIComponent(item.day_type) + '&sessionKey='+ encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: updateUrl,
          method: 'GET',
          success:(res)=>{
            that.setData({saving: false})
            if (res.statusCode != 200){
              return
            }
            item = res.data
            that.setData({product})
          }
        })
      }
    }
    wx.showToast({
      title: '价格已经更新',
      icon:'success'
    })
  }
})