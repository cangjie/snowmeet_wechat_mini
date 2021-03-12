// pages/admin/equip_maintain/on_site/print_label_new.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    deviceScene: 'maintain_on_site_label_print',
    deviceName: [],
    deviceInRange: [],
    readyForPrint: false,
    currentDevice: {
      deviceId: '', services: [],
      readServiceId: '', readCharacterUuid: '', 
      writeServiceId: '', writeCharacterUuid: '', 
      notifyServiceId:'', notifyCharacterUuid: ''},
    currentDeviceIndex: 0,
    currentServiceIndex: 0,
    showedMsg: []
  },
  getDeviceNameList: function() {
    var getDeviceNameUrl = 'https://' + app.globalData.domainName + '/api/blt_device_list.aspx'
    var that = this
    var deviceName = []
    wx.request({
      url: getDeviceNameUrl,
      success: (res) => {
        if (res.data.status == 0) {
          for(var i = 0; i < res.data.blt_devices.length; i++) {
            if (res.data.blt_devices[i].scene == that.data.deviceScene) {
              deviceName.push(res.data.blt_devices[i].device_name)
            }
          }
          that.data.deviceName = deviceName
          this.getDeviceNameListInRange()
        }
      }
    })
  },
  getDeviceNameListInRange: function() {
    var that = this
    wx.openBluetoothAdapter({
      success: (res) => {
        wx.getBluetoothAdapterState({
          success: (res) => {
            if (res.available) {
              if (res.discovering) {
                wx.stopBluetoothDevicesDiscovery({
                  success: (res) => {
                    that.searchInRangedBluetoothDevices()
                  },
                  fail: (res) => {
                    var showedMsg = that.data.showedMsg
                    showedMsg.push('手机蓝牙无法停止搜索其他设备。')
                    that.setData({showedMsg: showedMsg})
                  }
                })
              }
              else {
                that.searchInRangedBluetoothDevices()
              }
            }
            else {
              var showedMsg = that.data.showedMsg
              showedMsg.push('手机蓝牙设备不可用。')
              that.setData({showedMsg: showedMsg})
            }
          },
          fail: (res) => {
            var showedMsg = that.data.showedMsg
            showedMsg.push('获取蓝牙设备状态失败。')
            that.setData({showedMsg: showedMsg})
          }
        })
      },
      fail: (res) => {
        var showedMsg = that.data.showedMsg
        showedMsg.push('请打开蓝牙，返回后重试。')
        that.setData({showedMsg: showedMsg})
      }
    })
  },
  
  searchInRangedBluetoothDevices: function() {
    var showedMsg = this.data.showedMsg
    showedMsg.push('开始扫描蓝牙设备。')
    this.setData({showedMsg: showedMsg})
    wx.startBluetoothDevicesDiscovery({
      success: (res) => {
        setTimeout(() => {
          wx.getBluetoothDevices({
            success: (res) => {
              for (var i = 0; i < res.devices.length; i++) {
                for(var j = 0; j < this.data.deviceName.length; j++) {
                  //if (this.data.deviceName[j] == res.devices[i].name) {
                  if (res.devices[i].name.indexOf(this.data.deviceName[j])>=0) {
                    var list = this.data.deviceInRange
                    list.push(res.devices[i])
                  }
                }
              }
              if (this.data.deviceInRange.length > 0) {
                showedMsg.push('获取到' + this.data.deviceInRange.length.toString() + '设备。')
                this.setData({showedMsg: showedMsg})
                this.tryConnectDevice()
              }
              else {
                showedMsg.push('获取在线设备失败。')
                this.setData({showedMsg: showedMsg})
              }
              
            },
            fail: (res) => { 
              showedMsg.push('获取设备在线列表失败。')
              this.setData({showedMsg: showedMsg})
            }
          })
        }, 5000);
      },
      fail: (res) => {
        showedMsg = that.data.showedMsg
        showedMsg.push('扫描设备列表失败。')
        this.setData({showedMsg: showedMsg})
      }
    })
  },
  tryConnectDevice: function() {
    if (!this.data.readyForPrint) {
      if (this.data.currentDeviceIndex < this.data.deviceInRange.length) {
        var showedMsg = this.data.showedMsg
        showedMsg.push('开始尝试连接第' + (this.data.currentDeviceIndex + 1).toString() + '台设备。')
        this.setData({showedMsg: showedMsg})
        this.connectOneDevice()
      }
      else {
        var showedMsg = this.data.showedMsg
        showedMsg.push('所有设备连接失败。')
        this.setData({showedMsg: showedMsg})
      }
    }
  },
  connectOneDevice: function() {
    var deviceId = this.data.deviceInRange[this.data.currentDeviceIndex].deviceId
    var showedMsg = this.data.showedMsg
    showedMsg.push('开始连接，设备ID：'+deviceId)
    this.setData({showedMsg: showedMsg})
    wx.createBLEConnection({
      deviceId: deviceId,
      success: (res) => {
        showedMsg.push('连接成功，开始获取设备服务列表。')
        this.setData({showedMsg: showedMsg})
        wx.getBLEDeviceServices({
          deviceId: deviceId,
          success: (res) => {
            showedMsg.push('设备服务列表获取成功。')
            this.setData({showedMsg: showedMsg})
            this.data.currentDevice.deviceId = deviceId
            this.data.currentDevice.services = res.services
            this.data.currentDevice.readCharacterUuid = ''
            this.data.currentDevice.readServiceId = ''
            this.data.currentDevice.writeCharacterUuid = ''
            this.data.currentDevice.writeServiceId = ''
            this.data.currentDevice.notifyCharacterUuid = ''
            this.data.currentDevice.notifyServiceId = ''
            this.data.currentServiceIndex = 0
            this.getCharacteristics()
          },
          fail: (res) => {
            showedMsg.push('服务列表获取失败。')
            this.setData({showedMsg: showedMsg})
            this.data.currentDeviceIndex++
            this.tryConnectDevice()
          }
        })
      },
      fail: (res) => {
        showedMsg.push('设备' + this.data.currentDeviceIndex + '连接失败。')
        this.setData({showedMsg: showedMsg})
        this.data.currentDeviceIndex++
        this.tryConnectDevice()
      }
    })
  },
  getCharacteristics: function() {
    var showedMsg = this.data.showedMsg
    showedMsg.push('开始获取特性列表。')
    this.setData({showedMsg: showedMsg})
    var canWrite = false
    var canRead = false
    var canNotify = false
    if (this.data.currentDevice.writeServiceId != '') {
      canWrite = true
    }
    if (this.data.currentDevice.readServiceId != '') {
      canRead = true
    }
    if (this.data.currentDevice.notifyServiceId != '') {
      canNotify = true
    }
    wx.getBLEDeviceCharacteristics({
      deviceId: this.data.currentDevice.deviceId,
      serviceId: this.data.currentDevice.services[this.data.currentServiceIndex].uuid,
      success: (res) => {
        for(var i = 0; i < res.characteristics.length; i++) {
          var properties = res.characteristics[i].properties
          var item = res.characteristics[i].uuid
          if (!canNotify) {
            if (properties.notify) {
              canNotify = true
              this.data.currentDevice.notifyServiceId = this.data.currentDevice.services[this.data.currentServiceIndex].uuid
              this.data.currentDevice.notifyCharacterUuid = item
            }
          }
          if (!canRead) {
            if (properties.read) {
              canRead = true
              this.data.currentDevice.readServiceId = this.data.currentDevice.services[this.data.currentServiceIndex].uuid
              this.data.currentDevice.readCharacterUuid = item
            }
          }
          if (!canWrite) {
            if (properties.write) {
              canWrite = true
              this.data.currentDevice.writeServiceId = this.data.currentDevice.services[this.data.currentServiceIndex].uuid
              this.data.currentDevice.writeCharacterUuid = item
            }
          }

        }
        if (!canNotify || !canRead || !canWrite) {
          this.data.currentServiceIndex++
          if (this.data.currentServiceIndex >= this.data.currentDevice.services.length) {
            showedMsg.push('特征值不全。')
            this.setData({showedMsg: showedMsg})
            this.data.currentDeviceIndex++
            this.tryConnectDevice()
          }
          else{
            this.getCharacteristics()
          }

        }
        else{
          showedMsg.push('连接成功')
          this.setData({showedMsg: showedMsg, readyForPrint: true})
        }

      },
      fail: (res) => {
        showedMsg.push('开始获取特性列表失败。')
        this.setData({showedMsg: showedMsg})
        this.data.currentDeviceIndex++
        this.tryConnectDevice()
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    if (options.devicescene != undefined && options.devicescene != '') {
      this.data.deviceScene = options.devicescene
    }
    
    var that = this
    app.loginPromiseNew.then(function(resolve) {
      if (app.globalData.role == 'staff') {
        var showedMsg = that.data.showedMsg
        showedMsg.push('准备获取设备列表')
        that.setData({showedMsg: showedMsg})
        that.getDeviceNameList()
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