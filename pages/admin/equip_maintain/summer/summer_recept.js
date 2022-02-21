// pages/admin/equip_maintain/summer/summer_recept.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    keep: true,
    address:'',
    name:'',
    cell:'',
    equipType:'双板',
    brand:'',
    images:'',
    msg:'',
    role: ''
  },
  equipInfoChanged:function(e){
    console.log(e)
    var that = this
    that.setData({equipType: e.detail.equipType, brand: e.detail.brand, images: e.detail.images, scale: e.detail.scale})
  },

  inputChanged: function(e){
    var that = this
    console.log(e)
    switch(e.currentTarget.id){
      case 'keep':
        that.setData({keep: e.detail.value=='是'?true:false})
        break
      case 'name':
        that.setData({name: e.detail.value})
        break
      case 'address':
        that.setData({address: e.detail.value})
        break
      case 'cell':
        that.setData({cell: e.detail.value})
        break
      default:
        break
    }
  },
  checkValid: function(){
    var msg = ''
    var that = this
    if (that.data.equipType.trim()==''){
      msg = '请选择装备类型。'
    }
    if (that.data.brand.trim()==''){
      msg = '请选择品牌。'
    }
    if (!that.data.keep){
      if (that.data.address.trim()==''){
        msg = '请填写快递地址。'
      }
      if (that.data.name.trim()==''){
        msg = '请填写收件人姓名。'
      }
      if (that.data.cell.trim()==''){
        msg = '请填写收件人电话。'
      }
    }
    that.setData({msg: msg})
    return msg
  },

  submit: function(e){
    var that = this
    if (that.checkValid()==''){
      var submitData = {
        id: 0,
        open_id: '',
        equip_type: that.data.equipType.trim(),
        brand: that.data.brand.trim(),
        scale: that.data.scale.trim(),
        images: that.data.images.trim(),
        keep: that.data.keep?'是':'否',
        contact_name: that.data.name.trim(),
        address: that.data.address.trim(),
        cell: that.data.cell.trim(),
        service:'非雪季养护',
        oper_open_id: app.globalData.sessionKey,
        send_item: '现场交付'
      }
      var submitUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/Recept'
      wx.request({
        url: submitUrl,
        data: submitData,
        method: 'POST',
        success:(res)=>{
          var id = parseInt(res.data)
          if (id>0){
            wx.navigateTo({
              url: 'summer_recept_pay?id=' + id.toString(),
            })
          }
        }
      })
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
    })
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