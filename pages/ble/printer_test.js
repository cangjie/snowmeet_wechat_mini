// pages/ble/printer_test.js
var tsc = require('../../utils/ble_printer/tsc.js')
var encode = require('../../utils/ble_printer/encoding.js')
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
  },
  printLabel: function() {
    var cmd = tsc.jpPrinter.createNew()
    cmd.setCls()
    cmd.setSize(74, 49)
    cmd.setGap(4)
    cmd.setBox(10, 10, 464, 230, 5)//绘制一个边框
    cmd.setBar(10, 75, 455, 5);//绘制一条黑线
    cmd.setText(150, 20, "TSS24.BF2", 0, 2, 2, "棒棒糖")//绘制文字
    cmd.setText(340, 20, "TSS24.BF2", 0, 2, 2, "8 元")//绘制文字
    cmd.setText(360, 40, "TSS24.BF2", 0, 1, 1, ".8")//绘制文字
    cmd.setText(50, 100, "TSS24.BF2", 0, 1, 1, "单位：______")//绘制文字
    cmd.setText(140, 90, "TSS24.BF2", 0, 1, 1, "包")//绘制文字
    cmd.setText(50, 140, "TSS24.BF2", 0, 1, 1, "重量：______")//绘制文字
    cmd.setText(140, 130, "TSS24.BF2", 0, 1, 1, "500g")//绘制文字
    cmd.setText(50, 170, "TSS24.BF2", 0, 1, 1, "条码:")//绘制文字
    cmd.setBarCode(120, 170, "128", 48, 0, 0, 2, 2, "12345678")//绘制code128条码
    cmd.setBar(300, 80, 5, 150);//绘制一条黑线
    cmd.setQrcode(320, 90, "L", 5, "A", "http://www.howbest.cn/cn/")//绘制一个二维码
    cmd.setPagePrint()//执行打印指令
  }
})