// pages/admin/maintain/recept.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    scene: '查看用户基本信息',
    equipArr:[],
    selectedEquipArr:[],
    maintainLogArr:[],
    relationItems:['本人', '配偶', '朋友', '长辈']
  },

  

  userInfoUpdate(e){
    console.log('user info update', e)
    var that = this
    var userInfo = e.detail.user_info
    that.setData({userInfo: userInfo})
    if (userInfo != null && e.detail.user_found){
      var equipArr = []
      var maintainLogArr = []
      var getEquipUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetEquip?openId=' + encodeURIComponent(userInfo.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getEquipUrl,
        method: 'GET',
        success:(res)=>{
          console.log('equip find', res)
          equipArr = res.data
          var getLogArr = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMaintainLog?openId=' + encodeURIComponent(userInfo.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getLogArr,
            method: 'GET',
            success:(res)=>{
              console.log('maintain log', res)
              maintainLogArr[0] = res.data[0]
              maintainLogArr[1] = res.data[1]
              maintainLogArr[2] = res.data[2]
              for(var i = 0; i < maintainLogArr.length; i++){
                var desc = maintainLogArr[i].confirmed_equip_type + ' ' + maintainLogArr[i].confirmed_brand + ' ' + maintainLogArr[i].confirmed_scale + ' ' + ((maintainLogArr[i].confirmed_edge == 1)?('修刃' + maintainLogArr[i].confirmed_degree): ' ') + (maintainLogArr[i].confirmed_candle == 1? '打蜡' : ' ') + maintainLogArr[i].confirmed_more
                maintainLogArr[i].date = util.formatDate(new Date(maintainLogArr[i].create_date))
                maintainLogArr[i].desc = desc
              }
              that.setData({equipArr: equipArr, maintainLogArr: maintainLogArr})
            }
          })
        }
      })
    }
  },
  checkEquip(e){
    console.log('check equip', e)
    var that = this
    var selectedEquipArr = []
    var equipArr = that.data.equipArr
    for(var i = 0; i < e.detail.value.length; i++){
      var index = parseInt(e.detail.value[i].toString())
      selectedEquipArr[i] = equipArr[index]
      selectedEquipArr[i].relation = '本人'
    }
    that.setData({selectedEquipArr: selectedEquipArr})
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('双板')
    wx.request({
      url: getBrandUrl,
      method: 'GET',
      success:(res)=>{
        
        var skiBrands = []
        for(var i = 0; i < res.data.length; i++){
          var brand = res.data[i].brand_name.trim()
          if (res.data[i].chinese_name.trim()!=''){
            brand = brand + '/' + res.data[i].chinese_name.trim()
          }
          skiBrands.push(brand)
          
        }
        that.setData({skiBrands: skiBrands})
        getBrandUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetBrand?type=' + encodeURIComponent('单板')
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
            that.setData({boardBrands: boardBrands})
          }
        })
      }
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
  gotoPlaceOrder(){
    var that = this
    that.setData({scene: '确定养护项目'})
    var selectedEquipArr = that.data.selectedEquipArr
    if (selectedEquipArr.length == 0){
      selectedEquipArr[0] = {type: '双板', brand: '请选择。。。', scale: '', serial: '', year: ''}
      that.setData({selectedEquipArr: selectedEquipArr})
    }

  },
  gotoConfirm(){
    var that = this
    that.setData({scene: '确认订单'})
  },
  gotoRecept(){
    var that = this
    that.setData({scene: '查看用户基本信息'})
  },
  changed(e){
    console.log('select changed', e)
    var that = this
    var targetIdArr = e.currentTarget.id.split('_')
    var targetType = targetIdArr[0]
    var targetId = parseInt(targetIdArr[1])
    var selectedEquipArr = that.data.selectedEquipArr
    var currentEquip = selectedEquipArr[targetId]
    var value = e.detail.value
    switch(targetType){
      case 'type':
        currentEquip.type = value
        currentEquip.brand = ''
        break
      case 'brand':
        var brandList = that.data.skiBrands
        if (currentEquip.type == '单板'){
          brandList = that.data.boardBrands
        }
        currentEquip.brand = brandList[parseInt(value)]
        break
      case 'scale':
        currentEquip.scale = value
        break
      case 'front':
        currentEquip.front = value
        break
      case 'footLength':
        currentEquip.footLength = value
        break
      case 'height':
        currentEquip.height = value
        break
      case 'weight':
        currentEquip.weight = value
        break
      case 'binderGap':
        currentEquip.binderGap = value
        break
      case 'binderAngle':
        currentEquip.angle = value
        break
      case 'dinFront':
        currentEquip.dinFront = value
        break
      case 'dinRear':
        currentEquip.dinRear = value
        break
      case 'relation':
        var relation = that.data.relationItems[parseInt(value)]
        currentEquip.relation = relation
        break
      case 'item':
        var edge = false
        var candle = false
        for(var i = 0; i < value.length; i++){
          switch(value[i].trim()){
            case '打蜡':
              candle = true
              break
            case '修刃':
              edge = true
              break
            default:
              break
          }
        }
        currentEquip.candle = candle
        currentEquip.edge = edge
        break;
      case 'degree':
        currentEquip.degree = value
        break
      case 'others':
        var v = ''
        for(var i = 0; i < value.length; i++){
          v = v + (v==''?'':',') + value[i].trim()
        }
        break
      case 'memo':
        currentEquip.memo = value
        break
      case 'othersCharge':
        currentEquip.othersCharge = value
        break
      default:
        break
    }
    that.setData({selectedEquipArr: selectedEquipArr})
  },
  addNew(){
    var that = this
    var selectedEquipArr = that.data.selectedEquipArr
    selectedEquipArr.push({type: '双板'})
    that.setData({selectedEquipArr: selectedEquipArr})
  }
})