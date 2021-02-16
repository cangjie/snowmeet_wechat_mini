// pages/ble/printer_test.js
Page({

  /**
   * Page initial data
   */
  data: {
    deviceId: '88F1577E-4F79-D82A-E888-D9CC6F75A9FD',
    canRead: false,
    readServiceId: '',
    readUuid: '',
    canWrite: false,
    writeServiceId: '',
    writeUuid: '',
    canNotify: false,
    notifyServiceId: '',
    notifyUuid: '',
    currentServiceIndex: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    
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
  connect: function() {
    wx.openBluetoothAdapter({
      success: (res) => {
        wx.createBLEConnection({
          deviceId: this.data.deviceId,
          success: (res) => {
            console.log('Connected.')
            wx.getBLEDeviceServices({
              deviceId: this.data.deviceId,
              success: (res) => {
                console.log('Service id getted.')
                this.data.services = res.services
                this.data.currentServiceIndex = 0
                this.getCharacteristics()
                console.log('success')
              }
            })
          },
          fail: (res) => {
            console.log('bb')
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
              this.data.canRead = true
              this.data.readServiceId = currentServiceId
              this.data.readUuid = res.characteristics[i].uuid
            }
          }
          if (!this.data.canWrite){
            if (res.characteristics[i].properties.write){
              this.data.canWrite = true
              this.data.writeServiceId = currentServiceId
              this.data.writeUuid = res.characteristics[i].uuid
            }
          }
          if (!this.data.canNotify) {
            if (res.characteristics[i].properties.notify) {
              this.data.canNotify = true
              this.data.notifyServiceId = currentServiceId
              this.data.notifyUuid = res.characteristics[i].uuid
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
  }
})