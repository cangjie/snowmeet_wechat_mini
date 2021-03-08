// pages/admin/equip_maintain/on_site/print_label.js
const app = getApp()
var tsc = require("../../../../utils/ble_label_printer/tsc.js");
var encode = require("../../../../utils/ble_label_printer/encoding.js");
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 'maintain_on_site_lable_print',
    deviceId: '',
    canRead: false,
    readServiceId: '',
    readUuid: '',
    canWrite: false,
    writeServiceId: '',
    writeUuid: '',
    canNotify: false,
    notifyServiceId: '',
    notifyUuid: '',
    tryNum: 0,
    nowPrinting: false,
    currentPrint: 1,
    printerNum: 1
  },
  connectDevice: function(){
    this.data.deviceId = "DC:0D:30:92:10:48"
    var deviceId = this.data.deviceId

    wx.openBluetoothAdapter({
      success: (res) => {
        wx.createBLEConnection({
          deviceId: deviceId,
          success: (res) => {
            console.log(res)
            wx.getBLEDeviceServices({
              deviceId: this.data.deviceId,
              success: (res) => {
                console.log(res)
                this.setData({services: res.services, currentServiceIndex: 0})
                this.getCharacteristics()
                
              }
            })
          },
          fail: (res) => {
            console.log(res)
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
              this.setData({canRead: true, readServiceId: currentServiceId, readUuid: res.characteristics[i].uuid})
            }
          }
          if (!this.data.canWrite){
            if (res.characteristics[i].properties.write){
              this.setData({canWrite: true, writeServiceId: currentServiceId, writeUuid: res.characteristics[i].uuid})
            }
          }
          if (!this.data.canNotify) {
            if (res.characteristics[i].properties.notify) {
              this.setData({canNotify: true, notifyServiceId: currentServiceId, notifyUuid: res.characteristics[i].uuid})
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
  print: function(e) {
    console.log(e)
    var printType = e.currentTarget.id
    if ((this.data.maintain_in_shop_request == undefined || !this.data.canRead || !this.data.canWrite || !this.data.canNotify)
      && this.data.tryNum < 10) {
      this.data.tryNum++
      setTimeout(()=>{
        this.print()
      }, 1000)
    }
    else {
      console.log('start print.')
      this.setData({nowPrinting: true})
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
        //this.data.printerNum = 2
        this.setData({printerNum: 2})
      }
      else{
        this.setData({printerNum: 1})
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
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.id
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.data.sessionKey = resolve.sessionKey
      var getInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(resolve.sessionKey) + '&id=' + that.data.id
      wx.request({
        url: getInfoUrl,
        success: (res) => {
          console.log(res)
          that.data.maintain_in_shop_request = res.data.maintain_in_shop_request
        }
      })
    })
    var getDeviceUrl = 'https://' + app.globalData.domainName + '/api/blt_device_list.aspx'
    wx.request({
      url: getDeviceUrl,
      success:(res) => {
        if (res.data.status == 0) {
          var deviceList = res.data.blt_devices
          for(var i = 0; i < deviceList.length; i++) {
            if (deviceList[i].scene == this.data.scene) {
              this.setData({deviceId: deviceList[i].device_id})
              this.connectDevice()
              //this.print()
            }
          }
        }
      }
    })
  },

  prepareSend: function(buff) {
    console.log(buff)
    var that = this
    var time = 128
    var looptime = parseInt(buff.length / time);
    var lastData = parseInt(buff.length % time);
    console.log(looptime + "---" + lastData)
    that.setData({
      looptime: looptime + 1,
      lastData: lastData,
      currentTime: 1,
      oneTimeData: time
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
    var printNum = that.data.printerNum
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
      deviceId: this.data.deviceId,
      serviceId: this.data.writeServiceId,
      characteristicId: this.data.writeUuid,
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
              currentPrint: 1
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