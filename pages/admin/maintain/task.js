// pages/admin/maintain/task.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    yearList: ['未知', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    yearListSelectedIndex: 0,
    idDiff: false,
    showGallery: false,
    galleryIndex: -1,
    edgeMemo: '',
    waxMemo: '',
    unWaxMemo: '',
    moreMemo: '',
    finish: false,
    isClosed: false,
    currentStep: "安全检查",
    showUploader: true,
    isManager: 0,
    showQrCode: false,
    userConfirmed: false,
    status: 'view',
    relationArr: ['本人', '配偶', '子女', '长辈', '朋友'],
    needUpdateSerial: false,
    needUpdateBrand: false,
    brandSelectedIndex: 0,
    refunding: false
  },

  goHome() {
    wx.redirectTo({
      url: '../admin',
    })

  },


  /*
  getBoardBrands(){
    var that = this
    var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('单板')
    wx.request({
      url: getBrandUrl,
      method: 'GET',
      success:(res)=>{
        var boardBrands = []
        for(var i = 0; i < res.data.length; i++){
          var brand = res.data[i].brand_name.trim()
          if (res.data[i].chinese_name.trim()!=''){
            brand = brand + '/' + res.data[i].chinese_name.trim()
          }
          boardBrands.push(brand)
        }
        that.setData({brands: boardBrands})
      }
    })
  },
  getSkiBrands(){
    var that = this
    var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('双板')
    wx.request({
      url: getBrandUrl,
      method: 'GET',
      success:(res)=>{
        var boardBrands = []
        for(var i = 0; i < res.data.length; i++){
          var brand = res.data[i].brand_name.trim()
          if (res.data[i].chinese_name.trim()!=''){
            brand = brand + '/' + res.data[i].chinese_name.trim()
          }
          boardBrands.push(brand)
        }
        that.setData({brands: boardBrands})
      }
    })
  },
  */

  getBrands(type) {
    var that = this
    var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent(type)
    wx.request({
      url: getBrandUrl,
      method: 'GET',
      success: (res) => {
        var boardBrands = []
        for (var i = 0; i < res.data.length; i++) {
          var brand = res.data[i].brand_name.trim()
          if (res.data[i].chinese_name.trim() != '') {
            brand = brand + '/' + res.data[i].chinese_name.trim()
          }
          boardBrands.push(brand)
        }
        boardBrands.push('新增品牌')
        that.setData({ brands: boardBrands, brandSelectedIndex: 0 })
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    if (options.q != undefined) {
      var urlArr = decodeURIComponent(options.q).split('/')
      options.id = urlArr[urlArr.length - 1]

    }
    var that = this
    that.setData({ id: options.id })


    
  },


  getCurrentStep() {
    var that = this
    var getStepsUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/GetStepsByStaff/' + that.data.task.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getStepsUrl,
      method: 'GET',
      success: (res) => {
        console.log('steps', res)
        var currentStep = '安全检查'
        var stepSafe = undefined
        var stepEdge = undefined
        var stepWax = undefined
        var stepMore = undefined
        var stepUnWax = undefined
        for (var i = 0; i < res.data.length; i++) {
          switch (res.data[i].step_name) {
            case '安全检查':
              stepSafe = res.data[i]
              break
            case '修刃':
              stepEdge = res.data[i]
              var start = new Date(stepEdge.start_time)
              var end = new Date(stepEdge.end_time)
              if (start != undefined) {
                stepEdge.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
              }
              else {
                stepEdge.start_time_str = ''
              }
              if (end != undefined && end.getFullYear() > 1970) {
                stepEdge.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
              }
              else {
                stepEdge.end_time_str = ''
              }
              break
            case '打蜡':
              stepWax = res.data[i]
              var start = new Date(stepWax.start_time)
              var end = new Date(stepWax.end_time)
              if (start != undefined) {
                stepWax.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
              }
              else {
                stepWax.start_time_str = ''
              }
              if (end != undefined && end.getFullYear() > 1970) {
                stepWax.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
              }
              else {
                stepWax.end_time_str = ''
              }
              break
            case '刮蜡':
              stepUnWax = res.data[i]
              var start = new Date(stepUnWax.start_time)
              var end = new Date(stepUnWax.end_time)
              if (start != undefined) {
                stepUnWax.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
              }
              else {
                stepUnWax.start_time_str = ''
              }
              if (end != undefined && end.getFullYear() > 1970) {
                stepUnWax.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
              }
              else {
                stepUnWax.end_time_str = ''
              }
              break

            default:
              stepMore = res.data[i]
              var start = new Date(stepMore.start_time)
              var end = new Date(stepMore.end_time)
              if (start != undefined) {
                stepMore.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
              }
              else {
                stepMore.start_time_str = ''
              }
              if (end != undefined && end.getFullYear() > 1970) {
                stepMore.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
              }
              else {
                stepMore.end_time_str = ''
              }
              break
          }
        }
        var task = that.data.task

        switch (currentStep) {
          case '安全检查':
            if (stepSafe != undefined) {
              if (task.confirmed_edge == 1) {
                currentStep = '修刃'
              }
              else if (task.confirmed_more != undefined && task.confirmed_more != '') {
                currentStep = '维修'
              }
              else if (task.confirmed_candle == 1) {
                currentStep = '打蜡'
              }
              else {
                currentStep = '完成'
              }
            }
          case '修刃':
            if (currentStep == '修刃' && stepEdge != undefined && stepEdge.end_time_str != '') {
              if (task.confirmed_more != undefined && task.confirmed_more != '') {
                currentStep = '维修'
              }
              else if (task.confirmed_candle == 1) {
                currentStep = '打蜡'
              }
              else {
                currentStep = '完成'
              }
            }
          case '维修':
            if (currentStep == '维修' && stepMore != undefined && stepMore.end_time_str != '') {
              if (task.confirmed_candle == 1) {
                currentStep = '打蜡'
              }
              else {
                currentStep = '完成'
              }
            }
          case '打蜡':
            if (currentStep == '打蜡' && stepWax != undefined && stepWax.end_time_str != '') {
              currentStep = '刮蜡'
            }
          case '刮蜡':
            if (currentStep == '刮蜡' && stepUnWax != undefined && stepUnWax.end_time_str != '') {
              currentStep = '完成'
            }
          default:
            break
        }
        console.log('current step', currentStep)
        var finish = false
        if (currentStep == '完成') {
          finish = true
        }
        that.setData({ currentStep: currentStep, stepSafe: stepSafe, stepEdge: stepEdge, stepMore: stepMore, stepWax: stepWax, stepUnWax: stepUnWax, finish: finish })

      }
    })

  },

  showGallery(e) {
    var id = e.currentTarget.id
    var that = this
    that.setData({ showGallery: true, galleryIndex: parseInt(id) })
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

  terminate(e) {
    var that = this
    wx.showModal({
      title: '确认用户中途索回，此操作不可逆。',
      confirmText: '确认',
      cancelText: '取消',
      showCancel: true,
      success: (res) => {
        console.log(res)
        if (res.confirm) {
          that.setData({ isClosed: true })
          that.logStep('强行索回')
          var task = that.data.task
          task.outStatus = '强行索回'
          that.setData({ task: task })
        }

      }
    })
  },

  finish() {
    var that = this
    wx.showModal({
      title: '核对无误，发板给用户。',
      confirmText: '确认',
      cancelText: '取消',
      showCancel: true,
      success: (res) => {
        console.log(res)
        if (res.confirm) {
          that.setData({ isClosed: true })
          that.logStep('发板')
          var task = that.data.task
          task.outStatus = '发板'
          that.setData({ task: task })
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
        var brandArr = task.confirmed_brand.split('/')
        var brand = value + '/' + (brandArr.length == 2 ? brandArr[1] : '')
        task.confirmed_brand = brand
        that.setData({ needUpdateBrand: true })
        break
      case 'brand_chinese_name':
        var brand = task.confirmed_brand
        brand = brand.split('/')[0] + '/' + value
        task.confirmed_brand = brand
        that.setData({ needUpdateBrand: true })
        break
      case 'serial_picker':
        var serial = that.data.serialList[value]
        task.confirmed_serial = serial
        that.setData({ serialSelectedIndex: value })
        break
      case 'serial_input':
        task.confirmed_serial = value
        that.setData({ needUpdateSerial: true, serialSelectedIndex: that.data.serialList.length - 1 })
        break
      case 'year_picker':
        task.confirmed_year = that.data.yearList[value]
        that.setData({ yearListSelectedIndex: value })
        break
      case 'id_left':
        task.id_left = value
        task.confirmed_id = task.id_left + '~' + task.id_right
        that.setData({ task: task })
        break
      case 'id_right':
        task.id_right = value
        task.confirmed_id = task.id_left + '~' + task.id_right
        that.setData({ task: task })
        break
      case 'id_no':
        task.confirmed_id = value
        that.setData({ task: task })
        break
      case 'safe_memo':
        that.setData({ safeMemo: value })
        break
      case 'edge_memo':
        that.setData({ edgeMemo: value })
        break
      case 'brand':
        var brand = that.data.brands[value]
        task.confirmed_brand = brand
        var brandSelectedIndex = value
        that.getSerial(brand, task.confirmed_equip_type)
        that.setData({ task: task, brandSelectedIndex })
        break
      case 'uploader':
        var filesStr = ''
        var fileArr = e.detail.files
        for (var i = 0; i < fileArr.length; i++) {
          filesStr += ((i != 0) ? ',' : '') + fileArr[i].url
        }
        task.confirmed_images = filesStr
        that.setData({ task: task, showUploader: false })
        that.setData({showUploader: true})
        break
      case 'front':
        task.confirmed_front = value
        break
      case 'scale':
        task.confirmed_scale = value
        break
      case 'memo':
        task.confirmed_memo = value
        break
      case 'relation':
        task.confirmed_relation = value
        break

      case 'foot_length':
        task.confirmed_foot_length = value
        break
      default:
        break
    }
    that.setData({ task })
    console.log('task mod', that.data.task)
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

  updateTask() {
    var that = this
    var task = that.data.task
    //task.confirmed_serial = that.data.serialList[]
    if (task.confirmed_serial == '' || task.confirmed_serial == '新增') {
      task.confirmed_serial = '未知'
    }
    var updateUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/UpdateTask?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: that.data.task,
      success: (res) => {
        console.log('task updated', res)
        var task = res.data
        wx.showToast({
          title: '保存成功',
          icon: 'none',
          complete: (e) => {
            //that.getStatus()
            that.getBrands(task.confirmed_equip_type)
            that.getSerial(task.confirmed_brand, task.confirmed_equip_type)
          }
        })
      }
    })
  },
  safeCheck() {
    this.logStep('安全检查')
    this.getCurrentStep()
  },
  gotoPrint() {
    var that = this
    wx.navigateTo({
      url: 'print_label?id=' + that.data.task.id,
    })
  },
  logStep(stepName) {
    var that = this
    var startSafeCheck = 'https://' + app.globalData.domainName + '/core/MaintainLogs/StartStep/' + that.data.task.id + '?stepName=' + encodeURIComponent(stepName) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: startSafeCheck,
      method: 'GET',
      success: (res) => {
        var stepSafe = res.data
        if (stepSafe.id > 0) {
          var memo = that.data.safeMemo == undefined ? '' : that.data.safeMemo
          var endSafeCheck = 'https://' + app.globalData.domainName + '/core/MaintainLogs/EndStep/' + stepSafe.id + '?memo=' + encodeURIComponent(memo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: endSafeCheck,
            method: 'GET',
            success: (res) => {
              stepSafe = res.data
              that.setData({ stepSafe: stepSafe })
              wx.showToast({
                title: stepName + '完成',
                icon: 'none',
                complete: () => {
                  //that.getStatus()
                }

              })
            }
          })
        }
      }
    })
  },
  startStep(e) {
    var that = this
    var task = that.data.task
    var stepName = ''
    switch (e.currentTarget.id) {
      case 'edge':
        stepName = '修刃'
        break
      case 'wax':
        stepName = '打蜡'
        break
      case 'unWax':
        stepName = '刮蜡'
        break
      default:
        stepName = '维修'
        break
    }
    var startStepUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/StartStep/' + task.id + '?stepName=' + encodeURIComponent(stepName) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: startStepUrl,
      method: 'GET',
      success: (res) => {
        var ret = res.data
        var start = new Date(ret.start_time)
        var end = new Date(ret.end_time)
        if (start != undefined) {
          ret.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
        }
        else {
          ret.start_time_str = ''
        }
        if (end != undefined && end.getFullYear() > 1970) {
          ret.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
        }
        else {
          ret.end_time_str = ''
        }
        switch (stepName) {
          case '修刃':
            that.setData({ stepEdge: ret })
            break
          case '打蜡':
            that.setData({ stepWax: ret })
            break
          case '刮蜡':
            that.setData({ stepUnWax: ret })
          default:
            that.setData({ stepMore: ret })
            break
        }
        //that.setData({stepEdge: res.data})
        that.getCurrentStep()

      }
    })
  },
  endStep(e) {
    var that = this
    var id = e.currentTarget.id.split('_')[0]
    var type = e.currentTarget.id.split('_')[1]
    var memo = ''
    switch (type) {
      case 'edge':
        memo = that.data.edgeMemo
        break
      case 'wax':
        memo = that.data.waxMemo
        break
      case "unWax":
        memo = that.data.unWaxMemo
        break
      default:
        memo = that.data.moreMemo
        break
    }
    var endStepUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/endStep/' + id + '?memo=' + encodeURIComponent(memo) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: endStepUrl,
      method: 'GET',
      success: (res) => {
        var ret = res.data
        var start = new Date(ret.start_time)
        var end = new Date(ret.end_time)
        if (start != undefined) {
          ret.start_time_str = util.formatDate(start) + ' ' + util.formatTimeStr(start)
        }
        else {
          ret.start_time_str = ''
        }
        if (end != undefined && end.getFullYear() > 1970) {
          ret.end_time_str = util.formatDate(end) + ' ' + util.formatTimeStr(end)
        }
        else {
          ret.end_time_str = ''
        }
        var stepName = ret.step_name
        //console.log('step name', stepName)
        switch (stepName) {
          case '修刃':
            that.setData({ stepEdge: ret })
            break
          case '打蜡':
            that.setData({ stepWax: ret })
            break
          case '刮蜡':
            that.setData({ stepUnWax: ret })
            break
          default:
            that.setData({ stepMore: ret })
            break
        }
        //that.getStatus()
        that.getCurrentStep()
      }
    })

  },

  setMemo(e) {
    var that = this
    var task = that.data.task
    var order = task.order
    order.memo = e.detail.value
    that.setData({ task: task })
    var setUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/SetOrderMemo/' + order.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&memo=' + encodeURIComponent(e.detail.value)
    wx.request({
      url: setUrl,
      method: 'GET'
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
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      console.log('user info', app.globalData.userInfo)
      that.setData({ userInfo: app.globalData.userInfo })
      var isManager = 0
      if (app.globalData.is_admin == 1 || app.globalData.is_manager == 1) {
        isManager = 1
        that.setData({ isManager })
      }
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
    var that = this
    clearInterval(that.data.interval)
    that.setData({ showQrCode: false, userConfirmed: false })
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
  showQrCode() {
    var that = this
    var getQrUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewIdByScene?scene=' + encodeURIComponent('发板') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&bizId=' + that.data.id
    wx.request({
      url: getQrUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        //that.setData({showQrCode: true})
        var interActId = parseInt(res.data)
        that.setData({ interActId })
        var scene = 'maintainreturn_interact_id_' + interActId.toString()
        var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scene
        wx.request({
          url: getQRUrl,
          method: 'GET',
          success: (res) => {
            if (res.statusCode != 200) {
              return
            }
            that.setData({ qrcodeUrl: res.data, showQrCode: true })
            var interval = setInterval(that.checkScan, 1000);
            that.setData({ interval })
          }
        })
      }
    })
  },
  checkScan() {
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.interActId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: checkScanUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        clearInterval(that.data.interval)
        var confirmUrl = 'https://' + app.globalData.domainName + '/core/MaintainLogs/CheckReturnScan/' + that.data.interActId + '?taskId=' + that.data.id
        wx.request({
          url: confirmUrl,
          method: 'GET',
          success: (res) => {
            console.log('check scan user', res)
            if (res.statusCode != 200) {
              that.setData({ showQrCode: false })
              wx.showToast({
                icon: 'error',
                title: '用户身份未确认。'
              })
              return
            }
            if (res.data) {
              var msg = that.data.finish ? '养护完成，取板用户身份确认，可以发板。' : '养护未完成，取板用户身份确认，发板中止服务。'
              wx.showModal({
                title: '确认发板',
                content: msg,
                complete: (res) => {
                  that.setData({ showQrCode: false })
                  if (res.cancel) {

                  }

                  if (res.confirm) {
                    if (that.data.finish) {
                      that.data.safeMemo = '本人扫码取板'
                      that.setData({ isClosed: true })
                      that.logStep('发板')
                      var task = that.data.task
                      task.outStatus = '发板'
                      that.setData({ task })
                    }
                    else {
                      that.data.safeMemo = '本人扫码取板'
                      that.setData({ isClosed: true })
                      that.logStep('强行索回')
                      var task = that.data.task
                      task.outStatus = '强行索回'
                      that.setData({ task })
                    }
                  }
                }
              })
            }
            else {
              that.setData({ showQrCode: false })
              wx.showToast({
                icon: 'error',
                content: '用户身份未确认。'
              })
            }
          }
        })
        //that.setData({userConfirmed: true})
      }
    })
  },
  modBaseInfo() {
    var that = this
    var task = that.data.task
    var brands = that.data.brands
    var serialList = that.data.serialList
    var selectedBrandIndex = 0
    for (var i = 0; i < brands.length; i++) {
      var brand = brands[i].split('/')[0]
      if (task.confirmed_brand.indexOf(brand) == 0) {
        selectedBrandIndex = i
        break
      }
    }
    var selectedSerialIndex = 0
    for (var i = 0; i < serialList.length; i++) {
      if (serialList[i] == task.confirmed_serial) {
        selectedSerialIndex = i
        break
      }
    }
    that.setData({ status: 'edit_equip_info', brandSelectedIndex: selectedBrandIndex, selectedSerialIndex })
  },
  getSerial(brand, type) {
    var that = this
    brand = brand.split('/')[0]
    var getSerialUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetSerials?brand=' + encodeURIComponent(brand) + '&type=' + encodeURIComponent(type)
    wx.request({
      url: getSerialUrl,
      method: 'GET',
      success: (res) => {
        var serialList = []
        for (var i = 0; i < res.data.length; i++) {
          serialList.push(res.data[i].serial_name)
        }
        serialList.push('未知')
        serialList.push('新增')
        that.setData({ serialList, serialSelectedIndex: 0 })

      }
    })
  },
  updateTaskCancel() {
    var that = this
    that.setData({ status: '' })
  },
  getData() {
    var that = this
    var getInfoUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTask/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getInfoUrl,
      method: 'GET',
      success: (res) => {
        console.log('task info', res)
        var task = res.data
        that.setData({ showUploader: false })
        //console.log('images', task.confirmed_images)
        that.getBrands(task.confirmed_equip_type)
        that.getSerial(task.confirmed_brand.split('/')[0], task.confirmed_equip_type)
        /*
        if (task.confirmed_equip_type == '单板'){
          that.getBoardBrands()
        }
        else{
          that.getSkiBrands()
        }
        */
        task.images = []
        var idDiff = that.data.idDiff
        if (task.confirmed_images != '') {
          task.images = task.confirmed_images.split(',')
        }
        if (task.confirmed_id != '') {
          if (task.confirmed_id.indexOf('~') >= 0) {
            idDiff = true
            var id = task.confirmed_id
            var idLeft = id.split('~')[0]
            var idRight = id.split('~')[1]
            task.id_left = idLeft
            task.id_right = idRight
            //task.idDesc = '左：' + idLeft + ' 右：' + idRight 

          }
        }
        var yearIndex = 0
        for (var i = 0; i < that.data.yearList.length; i++) {
          if (that.data.yearList[i].trim() == task.confirmed_year) {
            yearIndex = i
            break
          }
        }
        that.getSerial(task.confirmed_brand, task.confirmed_equip_type)
        if (task.order && (!task.confirmed_memo || task.confirmed_memo == '')) {
          task.confirmed_memo = task.order.memo
        }
        if(task.order){
          task.order.paidAmountStr = util.showAmount(task.order.paidAmount)
          task.order.refundAmountStr = util.showAmount(task.order.refundAmount)
          task.order.earnStr = util.showAmount(task.order.paidAmount - task.order.refundAmount)
        }
        that.setData({ task: task, yearListSelectedIndex: yearIndex, idDiff: idDiff, showUploader: true })
        that.getCurrentStep()
      }
    })
  },
  refundInput(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    switch(id){
      case 'reason':
        that.setData({reason: value})
        break
      case 'refundAmount':
        that.setData({refundAmount: value})
        break
      default:
        break
    }
  },
  refund(e){
    //var id = e.currentTarget.id
    
    var that = this
    var task = that.data.task

    var msg = ''
    if (!that.data.reason || that.data.reason == ''){
      msg = '必须填写退款原因'
    }
    if (!that.data.refundAmount || isNaN(that.data.refundAmount)){
      msg = '退款金额是数字'
    }
    if (!task.order || task.order.paidAmount <= 0){
      msg = '为支付订单不能退款'
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
        icon: 'error'
      })
      return
    }
    var id = task.order.paymentList[0].id
    
    that.setData({refunding: true})
    wx.showModal({
      title: '确认退款',
      content: '该操作不可逆，且店长以下操作会失败。是否确认？',
      complete: (res) => {
        if (res.cancel) {
          that.setData({refunding: false})
        }
    
        if (res.confirm) {
          var refundUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/Refund/' + id + '?amount=' + that.data.refundAmount + '&reason=' + encodeURIComponent(that.data.reason) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
          wx.request({
            url: refundUrl,
            method: 'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                wx.showToast({
                  title: '退款失败',
                  icon: 'error'
                })
              }
              wx.showToast({
                title: '退款成功',
                icon: 'success'
              })
            },
            complete:(res)=>{
              that.setData({refunding: false})
              that.getData()
            }
          })
        }
      }
    })
  }
})