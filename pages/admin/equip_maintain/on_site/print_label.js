// pages/admin/equip_maintain/on_site/print_label.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 'maintain_on_site_lable_print',
    deviceId: '',
    canRead: false,
    readServiceId: '',
    readUuid: '',
    canWrite: false,
    writeServiceId: '',
    writeUuid: '',
    canNotify: false,
    notifyServiceId: '',
    notifyUuid: ''
  },
  connectDevice: function(){
    var deviceId = this.data.deviceId
    wx.openBluetoothAdapter({
      success: (res) => {
        wx.createBLEConnection({
          deviceId: deviceId,
          success: (res) => {
            console.log(res)
            wx.getBLEDeviceServices({
              deviceId: this.data.deviceId,
              success: (res) => {
                console.log(res)
                this.setData({services: res.services, currentServiceIndex: 0})
                this.getCharacteristics()
                
              }
            })
          },
          fail: (res) => {
            console.log(res)
          }
        })
      }
    })
  },
  getCharacteristics: function() {
    var currentServiceId = this.data.services[this.data.currentServiceIndex].uuid
    wx.getBLEDeviceCharacteristics({
      deviceId: this.data.deviceId,
      serviceId: currentServiceId,
      success:(res)=>{
        for (var i = 0; i < res.characteristics.length; i++){
          if (!this.data.canRead) {
            if (res.characteristics[i].properties.read) {
              this.setData({canRead: true, readServiceId: currentServiceId, readUuid: res.characteristics[i].uuid})
            }
          }
          if (!this.data.canWrite){
            if (res.characteristics[i].properties.write){
              this.setData({canWrite: true, writeServiceId: currentServiceId, writeUuid: res.characteristics[i].uuid})
            }
          }
          if (!this.data.canNotify) {
            if (res.characteristics[i].properties.notify) {
              this.setData({canNotify: true, notifyServiceId: currentServiceId, notifyUuid: res.characteristics[i].uuid})
            }
          }
        }
        if (!this.data.canRead || !this.data.canWrite || !this.data.canNotify) {
          this.data.currentServiceIndex++
          if (this.data.currentServiceIndex < this.data.services.length) {
            this.getCharacteristics()
          }
        }
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.data.sessionKey = resolve.sessionKey
    })
    var getDeviceUrl = 'https://' + app.globalData.domainName + '/api/blt_device_list.aspx'
    wx.request({
      url: getDeviceUrl,
      success:(res) => {
        if (res.data.status == 0) {
          var deviceList = res.data.blt_devices
          for(var i = 0; i < deviceList.length; i++) {
            if (deviceList[i].scene == this.data.scene) {
              this.setData({deviceId: deviceList[i].device_id})
              this.connectDevice()
            }
          }
        }
      }
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