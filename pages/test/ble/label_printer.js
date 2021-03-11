// pages/test/ble/label_printer.js
Page({

  /**
   * Page initial data
   */
  data: {
    deviceName: 'Printer_1048_BLE',
    errMsg: '',
    isScanning: false,
    findDevice: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log(res)
        wx.getBluetoothAdapterState({
          success: (res) => {
            console.log(res)
            if (res.available) {
              if (res.discovering) {
                wx.stopBluetoothDevicesDiscovery({
                  success: (res) => {
                    console.log(res)
                  },
                })
              }
              else {
                this.getBluetoothDevices()
              }
            }
            else {
              this.setData({errMsg: '当前蓝牙不可用'})
            }
          },
          fail: (res) => {
            console.log(res)
            this.setData({errMsg: '失去蓝牙设备通信'})
          }
        })
      },
      fail: (res) => {
        console.log(res)
        this.setData({errMsg: '请打开蓝牙'})
      }
    })
  },
  getBluetoothDevices() {
    wx.showLoading({
      title: '正在搜索'
    })
    this.setData({isScanning: true})
    var that = this
    wx.startBluetoothDevicesDiscovery({
      success: (res) => {
        console.log(res)
        setTimeout(() => {
          wx.getBluetoothDevices({
            success: (res) => {
              console.log(res)
              var devices = []
              var num = 0
              for(var i = 0; i < res.devices.length; i++){
                if (res.devices[i].name.toString().indexOf(this.data.deviceName)>=0) {
                  devices[num] = res.devices[i]
                  num++
                }
              }
              this.setData({list: devices, isScanning: false})
              wx.hideLoading()
              wx.stopPullDownRefresh()
              wx.stopBluetoothDevicesDiscovery({
                success: (res) => {
                  console.log(res)
                  if (devices.length > 0){
                    this.setData({findDevice: true})
                  }
                },
              })
            },
            
          })
        }, 5000);
        
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