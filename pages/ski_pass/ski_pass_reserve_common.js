// pages/ski_pass/ski_pass_reserve_common.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    needAuth: false,
    count: 1,
    countArray:[1,2,3,4,5,6,7,8,9]

  },

  getCell(e){
    var that = this
    console.log('get cell', e)
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(e.detail.encryptedData)+'&iv='+encodeURIComponent(e.detail.iv)
    wx.request({
      url: url,
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '网络繁忙，请稍候再试。',
            icon: 'error',
            success: (res) => {},
            fail: (res) => {},
            complete: (res) => {},
          })
          return
        }
        that.setData({cell: res.data.cell_number})
      }
    })
  },
  changeDate(e){
    console.log('date change', e)
    var that = this
    that.setData({date: e.detail.value})
  },
  input(e){
    console.log('count change', e)
    var count = parseInt(e.detail.value)
    if (isNaN(count)){
      return
    }
    count++
    
    var that = this
    var prod = that.data.currentProduct
    var totalAmount = prod.sale_price * count
    var totalAmountStr = util.showAmount(totalAmount)
    that.setData({totalAmount: totalAmount, totalAmountStr: totalAmountStr, count: count})
  },
  GetWanLongProduct() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/WanlongZiwoyouHelper/GetProductList'
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get wanlong product', res)
        if (res.statusCode != 200 || res.data.state != 1 
          || res.data.data.results == undefined || res.data.data.results == null){
          return
        }
        var productList = []
        for(var i = 0; i < res.data.data.results.length; i++ ){
          var item = res.data.data.results[i]
          var product = {
            id: item.productNo,
            name: item.productName,
            sale_price_str: util.showAmount(parseFloat(item.settlementPrice)),
            sale_price: item.settlementPrice,
            deposit_str: util.showAmount(0),
            desc: item.orderDesc
          }
          productList.push(product)
        }
        that.setData({productList: productList})
        for(var i = 0; i < productList.length; i++){
          if (productList[i].id == that.data.productNo){
            var currentProduct = productList[i]
            //currentProduct.settlementPricetStr = util.showAmount(currentProduct.settlementPrice)
            //currentProduct.depositStr = '¥0.00'
            var totalAmount = that.data.count * currentProduct.sale_price
            var totalAmountStr = util.showAmount(totalAmount)
            that.setData({currentProduct: currentProduct, totalAmount: totalAmount, totalAmountStr: totalAmountStr})
            break
          }
        }
        if (that.data.currentProduct == undefined){
          return
        }


      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var productNo = options.id
    var date = options.date
    that.setData({productNo: productNo, date: date})
    
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
    app.loginPromiseNew.then(function(resolve){
      var cell = ''
      var name = ''
      if (app.globalData.cellNumber==undefined || app.globalData.cellNumber==null || app.globalData.cellNumber==''){
        that.setData({needAuth: true})
      }
      else {
        cell = app.globalData.cellNumber
        that.setData({cell: cell})
      }
      if (app.globalData.userInfo != undefined && app.globalData.userInfo != null && app.globalData.userInfo.real_name != null){
        name = app.globalData.userInfo.real_name
        that.setData({name: name})
      }
      that.GetWanLongProduct()
      //var productList = that.data.productList
      

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