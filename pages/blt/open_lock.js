// pages/blt/open_lock.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    deviceId:0,
    haveRight: false,
    userPointsSummary: 0,
    findDevice: false,
    serviceId:'',
    charId:''
  },

  bltOpen: function(e){
    var that = this
    that.openBltAdapter()
  },

  openBltAdapter: function(){
    var that = this
    console.log('尝试打开蓝牙适配器。')
    wx.openBluetoothAdapter({
      success:(res)=>{
        console.log('打开蓝牙适配器成功', res)
        console.log('尝试获取蓝牙适配器状态')
        wx.getBluetoothAdapterState({
          success: (res) => {
            console.log('获取蓝牙适配器状态成功', res)
            if (res.available){
              if (res.discovering){
                console.log('尝试停止蓝牙适配器设备扫描')
                wx.stopBluetoothDevicesDiscovery({
                  success: (res) => {
                    console.log('蓝牙适配器设备扫描已经停止', res)
                    console.log('蓝牙适配器已经准备好')
                    //resolve({})
                    that.connectDevice()
                  },
                })
              }
              else{
                console.log('蓝牙适配器已经准备好')
                //resolve({})
                that.connectDevice()
              }
            }
          },
          fail:(res)=>{
            console.log('获取蓝牙适配器状态失败', res)
          }
        })
      },
      fail:(res)=>{
        console.log('打开蓝牙适配器失败', res)
      }
    })
  },

  connectDevice: function(){
    var that = this
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success:(res)=>{
        setTimeout(() => {
          wx.getBluetoothDevices({
            success: (res) => {
              console.log('getBluetoothDevices', res)
              for(var i = 0; i < res.devices.length; i++){
                if (that.data.deviceInfo.device_name.toLowerCase() == res.devices[i].name.toLowerCase() 
                || that.data.deviceInfo.device_name_2.toLowerCase() == res.devices[i].name.toLowerCase()){
                  that.data.findDevice = true
                  that.data.currentDevice = res.devices[i]
                  console.log('Device found')
                  that.getDevice()
                  break;
                }
              }
              
            },
          })
        }, 1000);
      }
    })
  },

  getDevice: function(){
    var that = this
    var deviceId = that.data.currentDevice.deviceId
    wx.createBLEConnection({
      deviceId: deviceId,
      success:(res)=>{
        wx.getBLEDeviceServices({
          deviceId: deviceId,
          success:(res)=>{
            var serviceId = ''
            for(var i = 0; i < res.services.length; i++){
              var serviceId = res.services[i].uuid
              that.getChar(deviceId, serviceId)
            }
            
          },
          fail:(res)=>{
            console.log(res)
          }
        })
      }
    })
  },

  getChar:function(deviceId, serviceId){
    var that = this
    wx.getBLEDeviceCharacteristics({
      deviceId: deviceId,
      serviceId: serviceId,
      success:(res)=>{
        if (that.data.serviceId == '' && that.data.charId == ''){
          for(var i = 0; i < res.characteristics.length; i++){
            var char = res.characteristics[i]
            if (char.properties.write){
              that.data.serviceId = serviceId
              that.data.charId = char.uuid
              var ab = new ArrayBuffer(6)
              var intAb = new Uint8Array(ab)
              intAb[0] = 0x4F
              intAb[1] = 0x50
              intAb[2] = 0x45
              intAb[3] = 0x4E
              intAb[4] = 0x0A
              intAb[5] = 0x0D
              console.log('ab', ab)
              wx.writeBLECharacteristicValue({
                characteristicId: char.uuid,
                deviceId: deviceId,
                serviceId: serviceId,
                value: ab,
                success:(res)=>{
                  console.log('write', res)
                  wx.closeBLEConnection({
                    deviceId: deviceId,
                  })
                  that.data.currentDevice.deviceId = ''
                  that.data.serviceId = ''
                  that.data.charId = ''
                  var chargePointUrl = 'https://' + app.globalData.domainName + '/core/Point/SetPoint?points=' 
                  + encodeURIComponent('-' + that.data.deviceInfo.need_points) + '&sessionKey=' 
                  + encodeURIComponent(app.globalData.sessionKey) + '&memo=' + encodeURIComponent('连接设备' + that.data.currentDevice.name)
                  wx.request({
                    url: chargePointUrl,
                    method: 'GET',
                    success:(res)=>{
                      wx.showToast({
                        title: '连接成功',
                        success: (res) => {
                          console.log(that.data.userPointsSummary)
                          var sum = that.data.userPointsSummary
                          console.log(that.data.deviceInfo)
                          var needPoints = that.data.deviceInfo.need_points
                          
                          that.setData({userPointsSummary: sum - needPoints})
                        },
                        fail: (res) => {},
                        complete: (res) => {},
                      })
                    }
                  })
                }
              })
            }
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
    if (options.id != undefined && options.id != null){
      that.data.deviceId = options.id
      app.loginPromiseNew.then(function(resolve) {
        console.log(app.globalData)
        var getDeviceInfoUrl = 'https://' + app.globalData.domainName + '/core/BltDevice/GetBltDevice/' + that.data.deviceId
        wx.request({
          url: getDeviceInfoUrl,
          success:(res)=>{
            that.setData({deviceInfo: res.data})
            console.log(res.data)
            if (res.data.admin_only == 1 && app.globalData.role != 'staff'){
              that.setData({haveRight: false})
            }
            else {
              that.setData({haveRight: true})
            }
            if (that.data.haveRight){
              var getPointsSumUrl = 'https://' + app.globalData.domainName + '/core/Point/GetMyPointsSummary?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
              wx.request({
                url: getPointsSumUrl,
                success:(res)=>{
                  that.setData({userPointsSummary: parseInt(res.data)})

                }
              })
            }
          }
        })
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