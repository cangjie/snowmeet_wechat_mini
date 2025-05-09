// pages/admin/maintain/task_detail.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    yearList: ['未知', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'],
    yearListSelectedIndex: 0,
    txtColor: '',
    bgColor: '',
    showUploader: false,
    idDiff: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var id = options.id
    that.setData({ id })
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
    app.loginPromiseNew.then(function (resolve) {
      that.getData()
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
  getData() {
    var that = this
    var url = app.globalData.requestPrefix + 'Care/GetCareByStaff/' + that.data.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    util.performWebRequest(url, undefined).then(function (resolve) {
      console.log('get care', resolve)
      var task = resolve
      that.getBrands(task.equipment)
      that.getSeries(task.brand, task.equipment)
      task.order.paidAmountStr = util.showAmount(task.order.paidAmount)
      task.order.refundAmountStr = util.showAmount(task.order.refundAmount)
      task.order.surplus = task.order.paidAmount - task.order.refundAmount
      task.order.surplusStr = util.showAmount(task.order.surplus)
      if (task.serials.indexOf('~') >= 0){
        var serialsArr = task.serials.split('~')
        task.serial_left = serialsArr[0]
        task.serial_right = serialsArr[1]
        
      }
      that.setData({ task, showUploader: true })
    })
  },
  modBaseInfo() {
    var that = this
    that.setData({ status: 'edit_equip_info' })
  },
  getBrands(type) {
    var that = this
    var getBrandUrl = app.globalData.requestPrefix + 'Care/GetBrands?type=' + encodeURIComponent(type)
    util.performWebRequest(getBrandUrl, undefined).then(function (resolve) {
      var boardBrands = []
      for (var i = 0; i < resolve.length; i++) {
        var brand = resolve[i].brand_name.trim()
        if (resolve[i].chinese_name.trim() != '') {
          brand = brand + '/' + resolve[i].chinese_name.trim()
        }
        boardBrands.push(brand)
      }
      boardBrands.push('新增品牌')
      that.setData({ brands: boardBrands, brandSelectedIndex: 0 })
    })
  },
  getSeries(brand, type) {
    var that = this
    brand = brand.split('/')[0]
    var getSerialUrl = app.globalData.requestPrefix + 'Care/GetSeries?brand=' + encodeURIComponent(brand) + '&type=' + encodeURIComponent(type)
    util.performWebRequest(getSerialUrl, undefined).then(function (resolve) {
      var serialList = []
      for (var i = 0; i < resolve.length; i++) {
        serialList.push(resolve[i].serial_name)
      }
      serialList.push('未知')
      serialList.push('新增')
      that.setData({ serialList, serialSelectedIndex: 0 })
    })

  },
  setIdDiff(e) {
    var that = this
    if (e.detail.value == 'id_diff') {
      that.setData({ idDiff: true })
    }
    else {
      that.setData({ idDiff: false })
    }
  },
  updateTaskCancel() {
    var that = this
    that.setData({ status: '' })
  },
  updateTaskConfirm() {
    var that = this
    wx.showModal({
      title: '确认修改',
      content: '',
      complete: (res) => {
        if (res.cancel) {
          that.setData({ status: '' })
        }

        if (res.confirm) {
          that.updateTask()
          that.setData({ status: '' })
        }
      }
    })
  },
  mod(e) {
    console.log('mod', e)
    var that = this
    var value = e.detail.value
    var task = that.data.task
    switch (e.currentTarget.id) {
      case 'brand_name':
        var brandArr = task.brand.split('/')
        var brand = value + '/' + (brandArr.length == 2 ? brandArr[1] : '')
        task.brand = brand
        //that.setData({ needUpdateBrand: true })
        break
      case 'brand_chinese_name':
        var brand = task.brand
        brand = brand.split('/')[0] + '/' + value
        task.brand = brand
        //that.setData({ needUpdateBrand: true })
        break
      case 'serial_picker':
        var series = that.data.serialList[value]
        task.series = series
        that.setData({ serialSelectedIndex: value })
        break
      case 'serial_input':
        task.series = value
        that.setData({serialSelectedIndex: that.data.serialList.length - 1 })
        break
      case 'year_picker':
        task.year = that.data.yearList[value]
        that.setData({ yearListSelectedIndex: value })
        break
      case 'id_left':
        task.id_left = value
        task.serials = task.id_left + '~' + task.id_right? task.id_right: ''
        //that.setData({ task: task })
        break
      case 'id_right':
        task.id_right = value
        task.serials = (task.id_left? task.id_left: '') + '~' + task.id_right
        //that.setData({ task: task })
        break
      case 'id_no':
        task.serials = value
        //that.setData({ task: task })
        break
      case 'safe_memo':
        that.setData({ safeMemo: value })
        break
      case 'edge_memo':
        that.setData({ edgeMemo: value })
        break
      case 'brand':
        var brand = that.data.brands[value]
        task.brand = brand
        var brandSelectedIndex = value
        that.getSeries(brand, task.equipment)
        that.setData({brandSelectedIndex })
        break
      case 'uploader':
        var filesStr = ''
        var fileArr = e.detail.files
        for (var i = 0; i < fileArr.length; i++) {
          filesStr += ((i != 0) ? ',' : '') + fileArr[i].url
        }
        task.images = filesStr
        that.setData({ task: task, showUploader: false })
        that.setData({ showUploader: true })
        break
      case 'front':
        task.board_front = value
        break
      case 'scale':
        task.scale = value
        break
      case 'memo':
        task.memo = value
        break
      case 'boot_length':
        task.boot_length = value
        break
      default:
        break
    }
    that.setData({ task })
    console.log('task mod', that.data.task)
  },
  updateTask(){
    var that = this
    var task = that.data.task
    var updateUrl = app.globalData.requestPrefix + 'Care/UpdateCareByStaff?scene=' + encodeURIComponent('养护详情页修改装备信息') + '&sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(updateUrl, task).then(function(resolve){
      var task = resolve
      that.setData({task, status: ''})
    })
  }
})