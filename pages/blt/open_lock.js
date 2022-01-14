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
    findDevice: false
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
                  //that.setData({findDevice: true, currentDevice: res.devices[i]})
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
            var charId = ''
            var found = false
            for(var i = 0; i < res.services.length && !found ; i++){
              var serviceId = res.services[i].uuid
              wx.getBLEDeviceCharacteristics({
                deviceId: that.data.currentDevice.deviceId,
                serviceId: serviceId,
                success:(res)=>{
                  for(var j = 0; j < res.characteristics.length && !found; j++){
                    if (res.characteristics[j].properties.write){
                      found = true
                      console.log('char found!')
                      break
                    }
                  }
                }
              })
            }
            
          },
          fail:(res)=>{
            console.log(res)
          }
        })
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