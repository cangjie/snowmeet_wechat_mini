// pages/admin/equip_maintain/on_site/recept.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    confirmedInfo: {
      shop: '万龙',
      degree: '89',
      equipInfo: {
        type: '双板',
        brand: ''
      }
    },
    pickDateDescription: '明天',
    totalCharge: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var pickDate = new Date()
    var pickDateStartStr = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
    var pickDateEndStr = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 2).toString() + '-' + pickDate.getDate().toString()
    pickDate.setDate(pickDate.getDate() + 1)

    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
    this.setData({confirmedInfo: confirmedInfo, pickDateStart: pickDateStartStr, pickDateEnd: pickDateEndStr})
    
    var brandListUrl = 'https://' + app.globalData.domainName + '/api/brand_list_get.aspx'
    wx.request({
      url: brandListUrl,
      success: (res)=>{
        var listArray = res.data.brand_list
          var skiList = []
          skiList.push('请选择...')
          var boardList = []
          boardList.push('请选择...')
          for(var i = 0; i < listArray.length; i++){
            if (listArray[i].brand_type == '双板') {
              skiList.push(listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name)
            }
            else{
              boardList.push(listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name)
            }
            
          }
          skiList.push('未知')
          boardList.push('未知')
          this.setData({skiBrandList: skiList, boardBrandList: boardList, brandSelectIndex: 0, displayedBrandList: skiList})
      }
    })
  },
  selectType: function(e) {
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.type = e.detail.value
    if (e.detail.value=='单板') {
      this.setData({brandSelectIndex: 0, displayedBrandList: this.data.boardBrandList, confirmedInfo: confirmedInfo})
    }
    else {
      this.setData({brandSelectIndex: 0, displayedBrandList: this.data.skiBrandList, confirmedInfo: confirmedInfo})
    }
    

  },
  selectBrand: function(e){
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.brand = this.data.displayedBrandList[e.detail.value]
    if (confirmedInfo.equipInfo.brand != '') {
      var canSubmit = false
      if (this.data.totalCharge > 0) {
        canSubmit = true
      }
      this.setData({brandSelectIndex: e.detail.value, confirmedInfo: confirmedInfo, canSubmit: canSubmit})
    }
    
  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  pickDateChange: function(e) {
    var pickDate = new Date(e.detail.value)
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = e.detail.value
    var nowDate = new Date()
    var pickDateDescription = ''
    if (nowDate.getDate() == pickDate.getDate() && nowDate.getMonth() == pickDate.getMonth()) {
      pickDateDescription = '今天'
    }
    else if (nowDate.getDate() + 1 == pickDate.getDate() ) {
      pickDateDescription = '明天'
    }
    else if (nowDate.getDate() + 2 == pickDate.getDate()) {
      pickDateDescription = '后天'
    }
    else if (nowDate.getDate() + 3 == pickDate.getDate()) {
      pickDateDescription = '大后天'
    }
    else if (nowDate.getDate() + 7 > pickDate.getDate() && pickDate.getDay() == 0) {
      pickDateDescription = '本周日'
    }
    else if (nowDate.getDate() + 7 > pickDate.getDate() && pickDate.getDay() == 6) {
      pickDateDescription = '本周六'
    }
    else if (nowDate.getDate() + 14 > pickDate.getDate() && pickDate.getDay() == 0) {
      pickDateDescription = '下周日'
    }
    else if (nowDate.getDate() + 14 > pickDate.getDate() && pickDate.getDay() == 6) {
      pickDateDescription = '下周六'
    }
    else {
      pickDateDescription = ''
    }
    this.setData({confirmedInfo: confirmedInfo, pickDateDescription: pickDateDescription})
  }
})