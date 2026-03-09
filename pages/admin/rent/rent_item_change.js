// pages/admin/rent/rent_item_change.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({
  /**
   * Page initial data
   */
  data: {
    newItem:{
      id: 0,
      noCode: true,
      code: '',
      name: ''
    },
    wellFormed: false
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.data.orderId = options.orderId
    that.data.rentItemId = options.rentItemId
    
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
    data.getOrderByStaffPromise(that.data.orderId, app.globalData.sessionKey).then(function (order){
      that.data.order = order
      var rentItem = that.getRentItem(that.data.rentItemId)
      console.log('get rent item', rentItem)
      rentItem = that.renderRentItem(rentItem)
      data.getRentCategoryPromise(rentItem.category_id).then(function (category){
        rentItem.category = category
        var newItem = that.data.newItem
        newItem.category = rentItem.category
        newItem.category_id = rentItem.category_id
        that.setData({rentItem, newItem})
        data.queryRentItemChangeCompatibleCategory(rentItem.category_id, null).then(function (categories){
          console.log('categories', categories)
          for(var i = 0; i < categories.length; i++){
            categories[i].text = categories[i].name
            categories[i].value = categories[i].id
          }
          that.setData({categories})
        })
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

  },
  getRentItem(id){
    var that = this
    var order = that.data.order
    var item = null
    for(var i = 0; item == null && i < order.rentals.length; i++){
      var rental = order.rentals[i]
      for(var j = 0; item== null && j < rental.rentItems.length; j++){
        if (rental.rentItems[j].id == that.data.rentItemId){
          item = rental.rentItems[j]
        }
      }
    }
    return item
  },
  renderRentItem(item){
    var pickDate = new Date(item.pickDate)
    item.pickDateDateStr = util.formatDate(pickDate)
    item.pickDateTimeStr = util.formatTimeStr(pickDate)
    return item
  },
  cancel(e){
    wx.navigateBack()
  },
  setInput(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    var newItem = that.data.newItem
    switch(id){
      case 'name':
        newItem.name = value
        break
      case 'noCode':
        newItem.noCode = value.length == 0? false: true
        if (newItem.noCode){
          newItem.code = '无'
        }
        else{
          newItem.code = ''
        }
        break
      case 'code':
        newItem.code = value
        break
      case 'category':
        newItem.category_id = e.detail
        break
      case 'memo':
        newItem.memo = value
        break
      default:
        break
    }
    that.setData({wellFormed: that.checkValid(newItem), newItem})
  },
  checkValid(rentItem){
    var valid = false
    if (rentItem.noCode){
      if (rentItem.name != ''){
        valid = true
      }
    }
    else{
      if (rentItem.code != ''){
        valid = true
      }
    }
    return valid
  },
  change(e){
    var that = this
    var rentItem = that.data.rentItem
    var newItem = that.data.newItem
    var newItemCategoryName = ''
    for(var i = 0; newItemCategoryName == '' && i < that.data.categories.length; i++){
      if (that.data.categories[i].id == newItem.category_id){
        newItemCategoryName = that.data.categories[i].name
      }
    }
    var message = ''
    if (rentItem.category_id == newItem.category_id){
      message = rentItem.category.name + ' 同品类租赁物更换'
    }
    else{
      message = '原品类：' + rentItem.category.name + ' 更换为 ' + newItemCategoryName
    }
    wx.showModal({
      title: '租赁物更换确认',
      content: message,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          var changeUrl = app.globalData.requestPrefix + 'Rent/ChangeRentItemByStaff/' +  rentItem.id.toString() + '?sessionKey=' + app.globalData.sessionKey
          util.performWebRequest(changeUrl, newItem).then(function (rental){
            console.log('changed', rental)
            wx.showToast({
              title: '更换成功',
              icon: 'success'
            })
            wx.navigateBack()
          })
        }
      }
    })

  }
})