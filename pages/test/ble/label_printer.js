// pages/test/ble/label_printer.js
Page({

  /**
   * Page initial data
   */
  data: {
    deviceName: 'Printer_1048',
    errMsg: '',
    isScanning: false,
    findDevice: false,
    connected: false,
    currentDeviceId: '',
    currentService:[],
    currentServiceIndex: 0,
    currentCharacter:{},
    findWriteCharacter: false,
    findReadCharacter: false,
    findNotifyCharacter: false,
    connectFinish: false

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
                    this.connectOneBleDevice(devices[0])
                  }
                },
              })
            },
            
          })
        }, 5000);
        
      }
    })
  },
  connectOneBleDevice: function(device) {
    console.log(device)
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: (res) => {
        console.log(res)
        this.setData({connected: true})
        this.getServiceId(device.deviceId)
      },
      fail: (res) => {
        console.log(res)
      }
    })
  },
  getServiceId: function(deviceId) {
    wx.getBLEDeviceServices({
      deviceId: deviceId,
      success: (res) => {
        console.log(res)
        this.setData({currentDeviceId: deviceId, currentService: res.services})
        this.getCharacteristics()
      },
      fail: (res) => {
        console.log(res)
      }
    })
  },
  getCharacteristics: function() {
    var char = this.data.currentCharacter
    var write = this.data.findWriteCharacter
    var read = this.data.findReadCharacter
    var notify = this.data.findNotifyCharacter
    wx.getBLEDeviceCharacteristics({
      deviceId: this.data.currentDeviceId,
      serviceId: this.data.currentService[this.data.currentServiceIndex].uuid,
      success: (res) => {
        console.log(res)
        for(var i = 0; i < res.characteristics.length; i++){
          var properties = res.characteristics[i].properties
          var item = res.characteristics[i].uuid
          if (!notify) {
            if (properties.notify) {
              char = this.data.currentCharacter
              char.notifyCharacterId = item
              char.notifyServiceId = this.data.currentService[this.data.currentServiceIndex].uuid
              notify = true
            }
          }
          if (!read) {
            if (properties.read) {
              char = this.data.currentCharacter
              char.readCharacterId = item
              char.readServiceId = this.data.currentService[this.data.currentServiceIndex].uuid
              read = true
            }
          }
          if (!write) {
            if (properties.write) {
              char = this.data.currentCharacter
              char.writeCharacterId = item
              char.writeServiceId = this.data.currentService[this.data.currentServiceIndex].uuid
              write = true
            }
          }
        }
        if (!write || !read || !notify) {
          this.data.currentServiceIndex = this.data.currentServiceIndex + 1
          this.data.findReadCharacter = read
          this.data.findWriteCharacter = write
          this.data.findNotifyCharacter = notify
          if (this.data.currentServiceIndex == this.data.currentService.length) {
            this.setData({errMsg: '特征值不全'})
          }
          else {
            this.getCharacteristics()
          }
        }
        else {
          console.log(this.data.currentCharacter)
          this.setData({connectFinish: true})
        }
      },
      fail: (res) => {
        console.log(res)
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