// pages/printer/gprinter/ticket.js
const app = getApp()
var tsc = require("../../../../utils/ble_label_printer/tsc.js")
Page({

  /**
   * Page initial data
   */
  data: {
    deviceScene: 'maintain_on_site_label_print',
    tickets:[],
    currentTicketIndex: 0,
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
      //that.drawTickets()
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
                    that.connectDevice()
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

  connectDevice: function(){
    var currentDeviceIndex = this.data.currentDeviceIndex
    var deviceList = this.data.deviceList
    
    var that = this
    if (currentDeviceIndex < deviceList.length) {
      var deviceId = deviceList[currentDeviceIndex].deviceId
      wx.createBLEConnection({
        deviceId: deviceId,
        success:(res)=>{
          console.log('蓝牙连接成功', res)
          var msg = that.data.msg
          msg.push('设备' + currentDeviceIndex.toString() + '连接成功。')
          this.setData({msg:msg, deviceId: deviceId})
          wx.getBLEDeviceServices({
            deviceId: deviceId,
            success:(res)=>{
              var services = res.services
              console.log('获取蓝牙设备服务成功', res)
              var msg = that.data.msg
              msg.push('设备' + currentDeviceIndex.toString() + '获取到' + services.length.toString() + '个服务。')
              that.setData({msg:msg, currentServiceIndex:0, serviceList: services, readServiceId:'', readCharacterId:'', writeServiceId:'', writeCharacterId:'', notifyServiceId:'', notifyCharacterId:''})
              that.getCharacters()
            },
            fail:(res)=>{
              console.log('获取蓝牙设备服务失败', res)
              var msg = that.data.msg
              msg.push('设备' + currentDeviceIndex.toString() + '获取服务失败。')
              that.setData({msg:msg, currentDeviceIndex: currentDeviceIndex+1})
              that.connectDevice()
            }
          })
        },
        fail:(res)=>{
          console.log('蓝牙连接失败', res)
          var msg = that.data.msg
          msg.push('设备' + currentDeviceIndex.toString() + '连接失败，尝试下一个。')
          this.setData({msg:msg, currentDeviceIndex: currentDeviceIndex+1})
          that.connectDevice()
        }
      })
    }
    else {
      var msg = that.data.msg
      msg.push('所有蓝牙设备，均连接失败。')
      that.setData({msg:msg})
    }
    
  },

  getCharacters: function(){
    var that = this
    var writeServiceId = this.data.writeServiceId
    var writeCharacterId = this.data.writeCharacterId
    var readServiceId = this.data.readServiceId
    var readCharacterId = this.data.readCharacterId
    var notifyServiceId = this.data.notifyServiceId
    var notifyCharacterId = this.data.notifyServiceId
    var serviceList = this.data.serviceList
    var currentServiceIndex = this.data.currentServiceIndex
    var serviceId = this.data.serviceList[currentServiceIndex].uuid
    var deviceId = this.data.deviceId
    if (currentServiceIndex >= serviceList.length){
      if (writeCharacterId == '' || writeServiceId == '' || readCharacterId == '' || readServiceId == '' || notifyCharacterId == '' || notifyServiceId == '') {
        console.log('特征值不全')
        var msg = this.data.msg
        msg.push('所有蓝牙设备，均连接失败。')
        this.setData({msg:msg})
        return
      }
      
    }
    else{
      wx.getBLEDeviceCharacteristics({
        deviceId: deviceId,
        serviceId: serviceId,
        success:(res)=>{
          var characterList = res.characteristics
          var msg = that.data.msg
          for(var i = 0; i < characterList.length; i++){
            if (characterList[i].properties.notify && (notifyServiceId == '' || notifyCharacterId == '')){
              
              notifyCharacterId = characterList[i].uuid
              notifyServiceId = serviceId
              msg.push('Notify 服务:' + notifyServiceId + ' 特征值:' + notifyCharacterId)
              that.setData({msg: msg, notifyCharacterId: notifyCharacterId, notifyServiceId: notifyServiceId})
            }
            if (characterList[i].properties.write && (writeServiceId == '' || writeCharacterId == '')) {
              writeCharacterId = characterList[i].uuid
              writeServiceId = serviceId
              msg.push('Write 服务:' + writeServiceId + ' 特征值:' + writeCharacterId)
              that.setData({msg: msg, writeCharacterId: writeCharacterId, writeServiceId: writeServiceId})
            }
            if (characterList[i].properties.read && (readCharacterId == '' || readServiceId == '' )) {
              readServiceId = serviceId
              readCharacterId = characterList[i].uuid
              msg.push('Read 服务:' + readServiceId + ' 特征值:' + readCharacterId)
              that.setData({msg: msg, readCharacterId: readCharacterId, readServiceId: readServiceId})
            }
          }
          if (writeCharacterId != '' && writeCharacterId != '' && readCharacterId != '' && readServiceId != '' && notifyServiceId != '' && notifyCharacterId != '') {
            msg.push('特征值获取完毕')
            that.setData({msg: msg})
            ////next step
            that.drawTickets()
          }
          else{
            currentServiceIndex++
            msg.push('进入第' + currentServiceIndex  + '个服务继续获取特征值')
            that.setData({msg: msg, currentServiceIndex: currentServiceIndex})
            that.getCharacters()
          }
        },
        fail:(res)=>{
          console.log('获取特征值列表失败', res)
          var msg = this.data.msg
          msg.push('所有蓝牙设备，均连接失败。')
          currentServiceIndex++
          that.setData({msg:msg, currentDeviceIndex: currentDeviceIndex})
          that.getCharacters()
        }
      })
    }
  },
  drawTickets: function(){
    var that = this
    var currentTicketsIndex = this.data.currentTicketIndex
    var tickets = this.data.tickets
    var ticket = tickets[currentTicketsIndex]
    if (currentTicketsIndex < tickets.length){
      var msg = this.data.msg
      msg.push('打印第' + currentTicketsIndex+'张。')
      this.setData({msg: msg})
      var context = wx.createCanvasContext('img', this)
      context.fillStyle = '#FFFFFF'
      context.fillRect(0,0,570,380)
      var qrCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=oper_ticket_id_' + ticket.code
      wx.getImageInfo({
        src: qrCodeUrl,
        success:(res)=>{
          context.drawImage(res.path, 350, 110, 200, 200)
          wx.getImageInfo({
            src: 'https://mini.snowmeet.top/images/logo.png',
            success:(res)=>{
              context.drawImage(res.path, 0, 0, 400, 85)
              context.fillStyle = '#000000'
              
              var txtArr = ticket.memo.split(';')
              context.setFontSize(19)
              for(var i = 0; i < txtArr.length; i++){
                context.fillText('*' + txtArr[i], 10, 150 + (i*30))
              }
              var nowDate = new Date()
              context.setFontSize(16)
              context.fillText('请在' + nowDate.getFullYear() + '年' + (nowDate.getMonth() + 1).toString() + '月' + nowDate.getDate().toString() + '日前，', 360, 320)
              context.fillText("通过微信扫一扫，在您个", 360, 340)
              context.fillText("人账户中绑定此二维码。", 360, 360)
              context.fillText(ticket.code, 410, 110)
              context.setFontSize(35)
              context.strokeText(ticket.name,420, 40)
              context.draw()
              wx.canvasGetImageData({
                canvasId: 'img',
                height: 370,
                width: 560,
                x: 0,
                y: 0,
                success:(res)=>{
                  var command = tsc.jpPrinter.createNew()
                  command.setCls()//清除缓冲区，防止下一个没生效
                  command.setSize(75, 50)//设置标签大小，单位mm.具体参数请用尺子量一下
                  command.setGap(4)//设置两个标签之间的间隙，单位mm.具体参数请用尺子量一下
                  command.setCls()//清除缓冲区
                  command.setBitmap(0, 0, 0, res)
                  command.setPrint(1)
                  that.prepareSend(command.getData())
                }
              })
            }
          })
        }
      })
    }
  },
  prepareSend: function(buff){
    var that = this
    var oneTimeData= 51200
    var loopTime = parseInt(buff.length / oneTimeData);
    var lastData = parseInt(buff.length % oneTimeData);
    console.log(loopTime + "---" + lastData)
    that.data.sendLoopTime = loopTime
    that.data.sendLastData = lastData
    that.data.sendCurrentTime = 0
    that.data.sendOneTimeData = oneTimeData
    var msg = this.data.msg
    msg.push('总字节数：'+buff.length.toString() + ', 每次发送:' + oneTimeData.toString() + '，发送' + loopTime.toString() + '次，余'+lastData.toString()+'次')
    that.send(buff)
  },
  
  send: function(buff){
    var that = this
    var buf
    var dataView
    if (this.data.sendCurrentTime < this.data.sendLoopTime){
      buf = new ArrayBuffer(this.data.sendOneTimeData)
      dataView = new DataView(buf)
      for (var i = 0; i < this.data.sendOneTimeData; ++i) {
        var index = this.data.sendCurrentTime  * this.data.sendOneTimeData + i
        dataView.setUint8(i, buff[index])
      }
    }
    else{
      buf = new ArrayBuffer(this.data.sendLastData)
      dataView = new DataView(buf)
      for (var i = 0; i < this.data.sendLastData; ++i) {
        var index = this.data.sendCurrentTime * this.data.sendOneTimeData + i
        dataView.setUint8(i, buff[index])
      }
    }
    console.log(buf)
    wx.writeBLECharacteristicValue({
      characteristicId: this.data.writeCharacterId,
      //characteristicId: '49535343-8841-43F4-A8D4-ECBE34729BB3',
      deviceId: this.data.deviceId,
      serviceId: this.data.writeServiceId,
      //serviceId: '49535343-FE7D-4AE5-8FA9-9FAFD205E455',
      value: buf,
      success:(res)=>{
        console.log('蓝牙发送成功', res)
        var msg = that.data.msg
        msg.push('第'+that.data.sendCurrentTime.toString()+'次发送成功')
        //that.setData({msg: msg})
        that.data.sendCurrentTime++
        if (that.data.sendCurrentTime <= that.data.sendLoopTime && that.data.sendLastData > 0){
          msg.push('准备下一次发送')
          that.setData({msg: msg})
          that.send(buff)
        }
        else{
          msg.push('发送完成')
          that.setData({msg: msg})
          //set finish print
          var code = that.data.tickets[that.data.currentTicketIndex].code
          var setPrintedUrl = 'https://' + app.globalData.domainName + '/core/ticket/SetPrinted/' + code + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: setPrintedUrl
          })
          that.data.currentTicketIndex++
          that.drawTickets()
        }
      }
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