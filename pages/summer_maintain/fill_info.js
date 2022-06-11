// pages/summer_maintain/fill_info.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    equipType: '',
    brand:'',
    scale:'',
    binderBrand:'',
    binderColor:'',
    sendItem:'万龙存板牌',
    wanlongNo: '',
    associateItem: '',
    keep: true,
    contactName:'',
    address:'',
    cell:'',
    selectedService: '非雪季养护',
    needToPay: 300,
    step: 0,
    valid: true,
    validInfo: ''
  },

  getSelectedBrand: function(e){
    console.log(e)
  },
  updateInfoSucess: function(e){
    var that = this
    that.setData({step: 1})
  },
  inputChanged: function(e){
    var that = this
    console.log(e)
    switch(e.type){
      case 'BrandSelected':
        that.setData({equipType: e.detail.equipType, brand: e.detail.brand})
      default:
        switch(e.currentTarget.id){
          case 'scale':
            that.setData({scale: e.detail.value})
            break
          case 'binderBrand':
            that.setData({binderBrand: e.detail.value})
            break
          case 'binderColor':
            that.setData({bindColor: e.detail.value})
            break
          case 'sendItem':
            var sendItem = e.detail.value
            if (sendItem!='万龙存板牌'){
              that.setData({needToPay: 300, selectedService: '非雪季养护', wanlongNo: ''})
            }
            that.setData({sendItem: e.detail.value})
            break
          case 'wanlongNo':
            that.setData({wanlongNo: e.detail.value})
            break
          case 'keep':
            var keep = (e.detail.value=='是')?true:false
            that.setData({keep: keep})
            break
          case 'selectedService':
            var needToPay = 300
            if (e.detail.value!='非雪季养护'){
              needToPay = 50
            }
            that.setData({selectedService: e.detail.value, keep: false, needToPay: needToPay})
            break
          case 'contact':
            that.setData({contactName: e.detail.value})
            break
          case 'address':
            that.setData({address: e.detail.value})
            break
          case 'cell':
            that.setData({cell: e.detail.value})
            break
          case 'associate':
            that.setData({associateItem: e.detail.value})
            break
          default:
            break
        }
        break
    }
  },
  checkValid:function(){
    var that = this
    var valid = true
    var validInfo = ''
    if (that.data.brand == '' || that.data.equipType == ''){
      valid = false
      validInfo = '请选择装备的类型和品牌。'
    }
    if (that.data.sendItem=='万龙存板牌' && that.data.wanlongNo==''){
      valid = false
      validInfo = '请填写万龙存板牌的编号。'
    }
    if (that.data.address=='' && (that.data.selectedService=='代取回寄' || !that.data.keep)){
      valid = false
      validInfo = '请填写快递地址。'
    }
    if (that.data.contactName == ''){
      valid = false
      validInfo = '请填写联系人的真实姓名。'
    }
    if (that.data.cell.trim().length != 11 || that.data.cell.trim().substr(0,1)!='1'){
      valid = false
      validInfo = '请填写正确的联系人手机号。'
    }
    that.setData({valid: valid, validInfo: validInfo})
  },
  submit: function(){
    var that = this
    that.checkValid()
    
    if (that.data.valid){
      var submitData = {
        id: 0,
        open_id: app.globalData.sessionKey,
        equip_type: that.data.equipType.trim(),
        brand: that.data.brand.trim(),
        scale: that.data.scale.trim(),
        binder_brand: that.data.binderBrand.trim(),
        binder_color: that.data.binderColor.trim(),
        send_item: that.data.sendItem.trim(),
        wanlong_no: that.data.wanlongNo.trim(),
        associates: that.data.associateItem.trim(),
        keep: that.data.keep?'是':'否',
        contact_name: that.data.contactName.trim(),
        address: that.data.address.trim(),
        cell: that.data.cell.trim(),
        service: that.data.selectedService.trim(),
        code: '',
        order_id:0,
        source: '',
        //owner_name: '',
        //owner_cell:''
      }
      var submitUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/PlaceOrder'
      wx.request({
        url: submitUrl,
        method: 'POST',
        data: submitData,
        success:(res)=>{
          console.log(res)
          wx.navigateTo({
            url: '/pages/payment/order_payment?orderid='+res.data.toString()+'&callback=' + encodeURIComponent('/pages/summer_maintain/summer_maintain_pay_success'),
          })
        }
      })
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    if (app.globalData.sessionKey == null || app.globalData.sessionKey == '') {
      var that = this
      app.loginPromiseNew.then(function(resolve) {
        if (app.globalData.cellNumber!=undefined && app.globalData.cellNumber!=''){
          that.setData({step: 1, cell: app.globalData.cellNumber})
        }
        
      })
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

  }
})