// pages/admin/rent/rent_admit_new.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 0,
    classSelectIndex: 0,
    rentItemList:[],
    currentRentItemIndex: -1,
    currentRentItem:{
      index: -1,
      code:'',
      isNoCode: false,
      class:'',
      classSelectedIndex: 0,
      name: '',
      rental: 0,
      deposit: 0,
      depositType:'立即租赁',
      startDate: util.formatDate(new Date()),
      memo: '',

    }
  },

  goBack(){
    wx.redirectTo({
      url: 'rent_admit',
    })
  },

  changeNoCode(e){
    var that = this
    var value = e.detail.value
    var currentRentItem = that.data.currentRentItem
    currentRentItem.isNoCode = e.detail.value
    if (currentRentItem.isNoCode){
      currentRentItem.code = ''
    }
    that.setData({currentRentItem: currentRentItem})
  },

  scan(){
    var that = this
    wx.scanCode({
      onlyFromCamera: false,
      success:(res)=>{
        console.log('scan result', res)
        var code = res.result
        var currentRentItem = that.data.currentRentItem
        currentRentItem.code = code
        that.getItemInfo(code, ctrlIndex)
      }
    })
  },

  getItemInfo(code){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var classList = that.data.classList
    var getItemUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentItem/' + code + '?shop=' + encodeURIComponent('万龙')
    wx.request({
      url: getItemUrl,
      success:(res)=>{
        if (res.statusCode == 200){
          currentRentItem.name = res.data.name
          currentRentItem.class = res.data.class
          currentRentItem.classSelectIndex = 0
          for(var i = 0; i < classList.length; i++){
            if (classList[i] == currentRentItem.class){
              currentRentItem.classSelectedIndex = i
              break
            }
          }
          currentRentItem.rental = res.data.rental
          currentRentItem.deposit = res.data.deposit
          that.setData({currentRentItem: currentRentItem})
          /*
          rentItem.code = code
          rentItem.name = res.data.name
          rentItem.deposit = res.data.deposit
          rentItem.rental = res.data.rental
          rentItem.noCode = false
          rentItemList[index] = rentItem
          that.setData({rentItemList: rentItemList})
          that.checkValid()
          */
        }
      }
    })
  },
  inputCode(e){
    var code = e.detail.value
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.code = code
    that.getItemInfo(code)
  },
  selectClass(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    var currentClass = that.data.classList[e.detail.value]
    currentRentItem.class = currentClass
    currentRentItem.classSelectedIndex = e.detail.value
    that.setData({currentRentItem: currentRentItem})
  },
  setDepositType(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.depositType = e.detail.value
    currentRentItem.name = ''
    currentRentItem.code = ''
    currentRentItem.rental = 0
    currentRentItem.isNoCode = false
    that.setData({currentRentItem: currentRentItem})
  },

  setNumber(e){
    var fieldName = ''
    switch(e.currentTarget.id){
      case 'rental':
        fieldName = '租金'
        break
      case 'deposit':
        fieldName = '押金'
        break
      default:
        break
    }
    var message = ''
    if (fieldName!=''){
      var amount = parseFloat(e.detail.value)
      if (!isNaN(amount)){
        var currentRentItem = that.data.currentRentItem
        switch(fieldName){
          case '租金':
            currentRentItem.rental = amount
            break
          case '押金':
            currentRentItem.deposit = amount
            break
          default:
            break
        }
        
      }
      else{
        message = '请填正确' + fieldName
        wx.showToast({
          title: message,
          icon: 'error'
        })
      }
    }
  },
  setMemo(e){
    var that = this
    var currentRentItem = that.data.currentRentItem
    currentRentItem.memo = e.detail.value
    that.setData({currentRentItem: currentRentItem})
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetClassList'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var classList = ['请选择...']
          for(var i = 0; i < res.data.length; i++){
            classList.push(res.data[i])
          }
          that.setData({classList: classList})
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