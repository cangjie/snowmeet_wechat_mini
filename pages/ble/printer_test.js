// pages/ble/printer_test.js
<<<<<<< HEAD
var tsc = require('../../utils/ble_printer/tsc.js')
var encode = require('../../utils/ble_printer/encoding.js')
=======
var app = getApp();
var tsc = require("../../utils/ble_label_printer/tsc.js");
var encode = require("../../utils/ble_label_printer/encoding.js");
>>>>>>> 506546922c3a6441816cf12e7dfcb2b107e11fce
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
    currentServiceIndex: 0,
    currentPrint: 1,
    printerNum: 1
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

    var command = tsc.jpPrinter.createNew()
    command.setCls()//清除缓冲区，防止下一个没生效
    command.setSize(75, 50)//设置标签大小，单位mm.具体参数请用尺子量一下
    command.setGap(4)//设置两个标签之间的间隙，单位mm.具体参数请用尺子量一下
    command.setCls()//清除缓冲区
    command.setText(20, 20, "TSS24.BF2", 0, 1, 1, "订单号：210301-0123   苍先生   135xxxx7897")
    command.setText(20, 20 + 40, "TSS24.BF2", 0, 1, 1, "双板：Fischer 长度：178  含杖")
    command.setText(20, 20 + 40 + 65, "TSS24.BF2", 0, 1, 1, "修刃89：")
    command.setText(320, 20 + 40 + 65, "TSS24.BF2", 0, 1, 1, "其他：")
    command.setText(20, 20 + 40 + 65 + 65, "TSS24.BF2", 0, 1, 1, "打蜡：")
    command.setText(20, 20 + 40 + 65 + 65 + 65, "TSS24.BF2", 0, 1, 1, "刮蜡：")
    command.setText(20, 350, "TSS24.BF2", 0, 1, 1, "取板 次日 03-01")
    command.setText(320, 350, "TSS24.BF2", 0, 1, 1, "订单日期：02-28")
    //command.setText(20, 20 + 40 + 40, "TSS24.BF2", 0, 1, 1, "用户：苍先生  手机：135****7897")
    //command.setText(20, 20 + 40 + 40 + 40, "TSS24.BF2", 0, 1, 1, "取板：次日 2021-3-1")
    //command.setText(20, 20 + 40 + 40 + 40 + 40, "TSS24.BF2", 0, 1, 1, "项目：")
    /*
    command.setText(20, 20 + 40 + 40 + 40 + 40, "TSS24.BF2", 0, 1, 1, "修刃________")
    command.setText(20, 20 + 40 + 40 + 40 + 40 + 50, "TSS24.BF2", 0, 1, 1, "打蜡 ________")
    command.setText(20, 20 + 40 + 40 + 40 + 40 + 50 + 50, "TSS24.BF2", 0, 1, 1, "刮蜡 ________")
    command.setText(20, 20 + 40 + 40 + 40 + 40 + 50 + 50 + 50, "TSS24.BF2", 0, 1, 1, "其他维修 ________")
    */
    /*
    command.setBox(10, 10, 464, 230, 5)//绘制一个边框
    command.setBar(10, 75, 455, 5);//绘制一条黑线
    command.setText(150, 20, "TSS24.BF2", 0, 2, 2, "棒棒糖")//绘制文字
    command.setText(340, 20, "TSS24.BF2", 0, 2, 2, "8 元")//绘制文字
    command.setText(360, 40, "TSS24.BF2", 0, 1, 1, ".8")//绘制文字
    command.setText(50, 100, "TSS24.BF2", 0, 1, 1, "单位：______")//绘制文字
    command.setText(140, 90, "TSS24.BF2", 0, 1, 1, "包")//绘制文字
    command.setText(50, 140, "TSS24.BF2", 0, 1, 1, "重量：______")//绘制文字
    command.setText(140, 130, "TSS24.BF2", 0, 1, 1, "500g")//绘制文字
    command.setText(50, 170, "TSS24.BF2", 0, 1, 1, "条码:")//绘制文字
    command.setBarCode(120, 170, "128", 48, 0, 0, 2, 2, "12345678")//绘制
    */
    command.setPagePrint()
    this.prepareSend(command.getData())
  },
  prepareSend: function(buff) {
    console.log(buff)
    var that = this
    var time = 1024
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
          that.Send(buff)
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
            that.Send(buff)
          }
        }
      }
    })
  }
})