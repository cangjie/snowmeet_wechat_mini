// pages/admin/equip_maintain/on_site/print_label_new.js
const app = getApp()
var tsc = require("../../../../utils/ble_label_printer/tsc.js");
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
    this.data.id = options.id
    var that = this
    app.loginPromiseNew.then(function(resolve) {
      if (app.globalData.role == 'staff') {
        that.data.sessionKey = resolve.sessionKey
        var getInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(resolve.sessionKey) + '&id=' + that.data.id
        wx.request({
          url: getInfoUrl,
          success: (res) => {
            that.data.maintain_in_shop_request = res.data.maintain_in_shop_request
          }
        })
        var showedMsg = that.data.showedMsg
        showedMsg.push('准备获取设备列表')
        that.setData({showedMsg: showedMsg})
        that.getDeviceNameList()
      }
    })
  },
  print: function(e){
    var showedMsg = this.data.showedMsg
    var printType = e.currentTarget.id
    if (this.data.maintain_in_shop_request == undefined) {
      showedMsg.push('未获取到订单信息。')
      this.setData({showedMsg: showedMsg, readyForPrint: false})
      return
    }
    showedMsg.push('开始打印')
    this.setData({showedMsg: showedMsg, readyForPrint: false})
    var brand = this.data.maintain_in_shop_request.confirmed_brand
    var orderNum = this.data.maintain_in_shop_request.task_flow_num
    var name = this.data.maintain_in_shop_request.confirmed_name
    var cell = this.data.maintain_in_shop_request.confirmed_cell
    var maskedCell = ''
    if (cell.length == 11){
      maskedCell = cell.substring(0, 3) + '****' + cell.substring(7, 11)
    }
    var maskedName = ''
    var title = ''
    if (this.data.maintain_in_shop_request.confirmed_gender == '男') {
      title = '先生'
    }
    if (this.data.maintain_in_shop_request.confirmed_gender == '女') {
      title = '女士'
    }
    if (name.length > 0) {
      maskedName = name.substring(0,1) + title
    }
    if (printType=='invoice') {
      maskedName = name
      maskedCell = cell
      this.data.copies = 2
    }
    else{
      this.data.copies = 1
    }
    var edge = this.data.maintain_in_shop_request.confirmed_edge
    var candle = this.data.maintain_in_shop_request.confirmed_candle
    var degree = this.data.maintain_in_shop_request.confirmed_degree
    var type = this.data.maintain_in_shop_request.confirmed_equip_type
    var more = this.data.maintain_in_shop_request.confirmed_more
    var pole = (more.indexOf('杖') >= 0)? '含杖':''
    var orderDate = new Date(this.data.maintain_in_shop_request.create_date)
    var orderDateStr = (orderDate.getMonth() + 1).toString() + '-' + orderDate.getDate().toString()
    var pickDate = new Date(this.data.maintain_in_shop_request.confirmed_pick_date)
    var pickDateStr = (pickDate.getMonth()+1).toString() + '-' + pickDate.getDate().toString()
    var scale = this.data.maintain_in_shop_request.confirmed_scale
    var pickDateTitle = '次日'
    if (pickDate.getDate() == orderDate.getDate()) {
      pickDateTitle = '当日'
    }
    else if (pickDate.getDate() - orderDate.getDate() != 1) {
      pickDateTitle = '多日'
    }
    var command = tsc.jpPrinter.createNew()
    command.setCls()//清除缓冲区，防止下一个没生效
    command.setSize(75, 50)//设置标签大小，单位mm.具体参数请用尺子量一下
    command.setGap(4)//设置两个标签之间的间隙，单位mm.具体参数请用尺子量一下
    command.setCls()//清除缓冲区
    command.setText(20, 20, "TSS24.BF2", 0, 1, 1, orderNum + "   " + maskedName + "   " + maskedCell)
    command.setText(20, 20 + 40, "TSS24.BF2", 0, 1, 1, type + "：" + brand + " 长度：" + scale + "  " + pole)
    if (edge.toString() == '1') {
      command.setText(20, 20 + 40 + 65, "TSS24.BF2", 0, 1, 1, "修刃 " + degree + "：")
    }
    if (more!='') {
      command.setText(320, 20 + 40 + 65, "TSS24.BF2", 0, 1, 1, "其他：" + more)
     }
    if (candle.toString()=='1') {
      command.setText(20, 20 + 40 + 65 + 65, "TSS24.BF2", 0, 1, 1, "打蜡：")
      command.setText(20, 20 + 40 + 65 + 65 + 65, "TSS24.BF2", 0, 1, 1, "刮蜡：")
    }
    command.setQrcode(320, 20 + 40 + 65 + 65, "H", 4, "A", "maintain_in_shop_request_" + this.data.id)
    command.setText(20, 350, "TSS24.BF2", 0, 1, 1, "取板 " + pickDateTitle + " " + pickDateStr)
    command.setText(320, 350, "TSS24.BF2", 0, 1, 1, "订单日期：" + orderDateStr)
    command.setPagePrint()
    this.prepareSend(command.getData())
  },
  prepareSend: function(buff){
    var that = this
    var time = 128
    var looptime = parseInt(buff.length / time);
    var lastData = parseInt(buff.length % time);
    console.log(looptime + "---" + lastData)
    that.setData({
      looptime: looptime + 1,
      lastData: lastData,
      currentTime: 1,
      oneTimeData: time,
      currentPrint: 1
    })
    this.send(buff)
  },
  send: function(buff) {
    var that = this
    var currentTime = that.data.currentTime
    var loopTime = that.data.looptime
    var lastData = that.data.lastData
    var onTimeData = that.data.oneTimeData
    //onTimeData = 1024
    var printNum = that.data.copies
    var currentPrint = that.data.currentPrint
    if (currentPrint > 5) {
      return
    }
    var buf
    var dataView
    if (currentTime < loopTime) {
      buf = new ArrayBuffer(onTimeData)
      dataView = new DataView(buf)
      for (var i = 0; i < onTimeData; ++i) {
        dataView.setUint8(i, buff[(currentTime - 1) * onTimeData + i])
      }
    } else {
      buf = new ArrayBuffer(lastData)
      dataView = new DataView(buf)
      for (var i = 0; i < lastData; ++i) {
        dataView.setUint8(i, buff[(currentTime - 1) * onTimeData + i])
      }
    }
    //console.log("第" + currentTime + "次发送数据大小为：" + buf.byteLength)
    var that = this
    wx.writeBLECharacteristicValue({
      deviceId: this.data.currentDevice.deviceId,
      serviceId: this.data.currentDevice.writeServiceId,
      characteristicId: this.data.currentDevice.writeCharacterUuid,
      value: buf,
      success: function (res) {
        console.log(currentPrint)
        if (currentPrint == printNum) {
          
          wx.showToast({
            title: '已打印第' + currentPrint + '张成功',
          })
          that.setData({nowPrinting: false})
        }
        //console.log(res)
      },
      fail: function (e) {
        wx.showToast({
          title: '打印第' + currentPrint + '张失败',
          icon: 'none',
        })

        //console.log(e)
      },
      complete: function () {
        currentTime++
        console.log(currentTime)
        if (currentTime <= loopTime) {
          that.setData({
            currentTime: currentTime
          })
          that.send(buff)
        } else {
          // wx.showToast({
          //   title: '已打印第' + currentPrint + '张',
          // })`
          console.log(currentPrint)
          if (currentPrint == printNum) {
            that.setData({
              looptime: 0,
              lastData: 0,
              currentTime: 1,
              isLabelSend: false,
              currentPrint: 1,
              readyForPrint: true
            })
            wx.closeBLEConnection({
              deviceId: that.data.currentDevice.deviceId,
              success: (res) => {
                wx.showToast({
                  title: '打印完毕，蓝牙打印机断开。',
                })
              }
            })
          } else {
            currentPrint++
            that.setData({
              currentPrint: currentPrint,
              currentTime: 1,
            })
            that.send(buff)
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