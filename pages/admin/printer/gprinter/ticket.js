// pages/printer/gprinter/ticket.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    deviceScene: 'maintain_on_site_label_print',
    tickets:[],
    msg:[],
    deviceId:'',
    deviceConnectState: false

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.role != 'staff'){
        return
      }
      that.setData({tickets: JSON.parse(options.tickets)})
      console.log('Get tickets:', that.data.tickets)
      var msg = that.data.msg
      msg.push('获取到' + that.data.tickets.length + '张优惠券。')
      that.setData({msg: msg})
      that.getDeviceNameListPromise.then(function(resolve){
        var onlineDeviceList = resolve
        var msg = that.data.msg
        msg.push('在线获取到'+resolve.length+'台设备名称。')
        msg.push('尝试打开蓝牙适配器。')
        that.setData({msg:msg})
        that.prepareBLEAdapterPromise.then(function(resolve){
          msg = that.data.msg
          msg.push('蓝牙适配器已经打开。')
          msg.push('准备扫描蓝牙设备。')
          that.setData({msg:msg})
          wx.startBluetoothDevicesDiscovery({
            success:(res)=>{
              msg = that.data.msg
              msg.push('开始扫描蓝牙设备，等待3秒。')
              that.setData({msg:msg})
              setTimeout(() => {
                wx.getBluetoothDevices({
                  success: (res) => {
                    msg = that.data.msg
                    msg.push('共有' + res.devices.length.toString() + '台设备在蓝牙范围内。')
                    that.setData({msg:msg})
                    var deviceList = []
                    for(var i = 0; i < onlineDeviceList.length; i++){
                      for(var j = 0; j < res.devices.length; j++){
                        if (res.devices[j].name.indexOf(onlineDeviceList[i])>=0){
                          deviceList.push(res.devices[j])
                        }
                      }
                    }
                    msg = that.data.msg
                    msg.push('其中有' + deviceList.length.toString() + '台设备可尝试连接。')
                    that.setData({currentDeviceIndex:0, deviceList: deviceList, msg:msg})
                  },
                })
              }, 3000);
            },
            fail:(res)=>{
              msg = that.data.msg
              msg.push('扫描蓝牙设备失败。')
              that.setData({msg:msg})
            }
          })
        })
      })
    })
  },

  prepareBLEAdapterPromise: new Promise(function(resolve){
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
                    resolve({})
                  },
                })
              }
              else{
                console.log('蓝牙适配器已经准备好')
                resolve({})
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
  }),

  getDeviceNameListPromise: new Promise(function(resolve){
    var deviceScene = 'maintain_on_site_label_print'
    var getDeviceNameUrl = 'https://' + app.globalData.domainName + '/api/blt_device_list_new.aspx'
    
    wx.request({
      url: getDeviceNameUrl,
      method: 'GET',
      success:(res)=>{
        if (res.data.status == 0) {
          var deviceNameArr = []
          for(var i = 0; i < res.data.blt_devices.length; i++) {
            if (res.data.blt_devices[i].scene == deviceScene) {
              deviceNameArr.push(res.data.blt_devices[i].device_name)
            }
          }
          console.log('Get device name list:', deviceNameArr)
          
          resolve(deviceNameArr)
        }
      }
    })
  }),
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