// components/care/print_care_label.js
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
var tsc = require("../../utils/ble_label_printer/tsc.js")
Component({

  /**
   * Component properties
   */
  properties: {
    care: Object,
    order: Object,
    type: String
  },

  /**
   * Component initial data
   */
  data: {
    printType: '顾客小票',
    currentDeviceIndex: null
  },
  lifetimes: {
    ready() {
      var that = this
      var type = ''
      switch (that.properties.type) {
        case 'label':
          type = '标签存根'
          break
        case 'invoice':
          type = '顾客小票'
          break
        default:
          break
      }
      console.log('care', that.properties.care)
      that.setData({ order: that.properties.order,printType: type })
      wx.showToast({
        title: '正在连接打印机',
        icon: 'loading'
      })
      data.getPrinterListPromise(that.properties.care.shop).then(function (printers) {
        console.log('get printers', printers)
        for (var i = 0; i < printers.length; i++) {
          var printer = printers[i]
          switch (printer.color) {
            case 'white':
              printer.colorStr = '白'
              break
            case 'yellow':
              printer.colorStr = '黄'
              break
            case 'red':
              printer.colorStr = '红'
              break
            default:
              break
          }
        }
        that.setData({ printers })
        util.getBLEDeviceNameListInRangePromise().then(function (list) {
          var availablePrinters = []
          for (var i = 0; i < printers.length; i++) {
            for (var j = 0; j < list.devices.length; j++) {
              if (list.devices[j].name.indexOf(printers[i].name) >= 0) {
                if (list.devices[j].connectable == true) {
                  var printer = list.devices[j]
                  printer.printer = printers[i]
                  printer.status = '未连接'
                  availablePrinters.push(printer)
                }
              }
            }
          }
          that.setData({ availablePrinters })
          //that.data.availablePrinters = availablePrinters
          //that.data.connectingIndex = 0
          if (availablePrinters.length <= 0) {
            wx.showToast({
              title: '未搜索到打印机',
              icon: 'error'
            })
            return
          }
          that.data.connectingIndex = that.getDefaultPrinterIndex()
          that.connectDevice()
          console.log('get ble list', availablePrinters)
        }).catch(function (exp) {
          console.log('get ble list failed', exp)
        })
      })
    },
    detached() {
      var that = this
      var connectingIndex = that.data.connectingIndex
      if (!isNaN(connectingIndex) && connectingIndex != null) {
        var printers = that.data.availablePrinters
        var printer = printers[connectingIndex]
        wx.closeBLEConnection({
          deviceId: printer.deviceId,
        })
      }
    }

  },

  /**
   * Component methods
   */
  methods: {
    setPrintType(e) {
      var that = this
      that.data.printType = e.detail.value
    },
    getDeviceNameList: function () {
      var that = this
      var task = that.data.maintain_in_shop_request
      var color = that.data.color
      if (color == undefined) {
        color = 'white'
        that.setData({ color: color })
      }
      var getDeviceNameUrl = 'https://' + app.globalData.domainName + '/core/Printer/GetPrinters?shop=' + encodeURIComponent(task.shop) + '&color=' + color + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)

      var deviceName = []
      wx.request({
        url: getDeviceNameUrl,
        success: (res) => {
          if (res.statusCode == 200) {
            if (that.data.color != undefined) {
              for (var i = 0; i < res.data.length; i++) {
                deviceName.push(res.data[i].name)
              }
            }
            that.data.deviceName = deviceName
            this.getDeviceNameListInRange()
          }
        },
        fail: (res) => {
          that.setData({ finish: true })
          console.log(res)
        }
      })
    },
    connectDevice() {
      var that = this
      var connectingIndex = that.data.connectingIndex
      var printerList = that.data.availablePrinters;
      if (connectingIndex >= that.data.availablePrinters.length) {
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        })
        return
      }
      printerList[connectingIndex].status = '连接中'
      that.setData({ availablePrinters: printerList })
      util.connectBLEPromise(printerList[connectingIndex].deviceId).then(function (device) {
        console.log('device connect', device)
        var printers = that.data.availablePrinters
        var printer = printers[that.data.connectingIndex]
        printer.connected = true
        printer.status = '已连接'
        that.setData({ ready: true, currentDevice: device, availablePrinters: printers, ready: true })
      }).catch(function () {
        var printers = that.data.availablePrinters
        var connectingIndex = that.data.connectingIndex
        if (!isNaN(connectingIndex) && connectingIndex != null) {
          var printer = printers[connectingIndex]
          printer.status = '连接失败'
          that.setData({ availablePrinters: printers })
          wx.closeBLEConnection({
            deviceId: printer.deviceId,
          })
        }
        /*
        connectingIndex++
        that.data.connectingIndex = connectingIndex
        that.connectDevice()
        */
      })
    },
    getCommand(labelType) {
      var that = this
      var care = that.properties.care
      var connectingIndex = that.data.connectingIndex
      var printer = that.data.availablePrinters[connectingIndex]
      var font = 'TSS32.BF2'
      if (printer.printer.name.indexOf('Printer_')>=0){
        font = 'TSS24.BF2'
      }
      var brand = care.brand == null ? '未填' : care.brand
      var orderNum = care.task_flow_code
      var name = care.customerName == null ? '' : care.customerName
      var cell = care.customerCell == null ? '' : care.customerCell
      var maskedCell = ''
      if (cell.length == 11) {
        maskedCell = cell.substring(0, 3) + '****' + cell.substring(7, 11)
      }
      var maskedName = ''
      if (name.length > 0) {
        maskedName = name.substring(0, 1) + care.customerName
      }
      if (labelType == '【客户联】' ) {
        maskedName = name
        maskedCell = cell
        that.data.copies = 1
      }
      else {
        that.data.copies = 1
      }
      var edge = care.need_edge
      var candle = care.need_wax
      var degree = care.edge_degree
      var type = care.equipment
      var more = care.repair_more ? care.repair_more : ''
      var memo = care.repair_memo ? care.repair_memo : ''
      var pole = care.with_pole == true ? '含杖' : ''
      var orderDate = new Date(care.create_date)
      var orderDateStr = (orderDate.getMonth() + 1).toString() + '-' + orderDate.getDate().toString()
      var urgent = false
      if (care.urgent == 1) {
        urgent = true
      }
      var pickDate = new Date(orderDate)
      if (care.member_pick_date != null) {
        pickDate = new Date(care.member_pick_date)
      }
      else {
        if (!urgent) {
          pickDate = pickDate.setDate(pickData.getdate() + 1)
        }
      }
      var pickDateStr = (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
      var scale = care.scale ? care.scale : '未填'
      var pickDateTitle = '次日'
      if (pickDate.getDate() == orderDate.getDate()) {
        pickDateTitle = '当日'
      }
      else if (pickDate.getDate() - orderDate.getDate() != 1) {
        pickDateTitle = '多日'
      }
      else {
        pickDateTitle = '次日'
      }
      var command = tsc.jpPrinter.createNew()
      command.setCls()//清除缓冲区，防止下一个没生效
      command.setSize(75, 50)//设置标签大小，单位mm.具体参数请用尺子量一下
      command.setGap(4)//设置两个标签之间的间隙，单位mm.具体参数请用尺子量一下
      command.setCls()//清除缓冲区
      
      
      command.setText(20, 20, font, 0, 1, 1, labelType + ' ' + (urgent ? '(急)' : '') + orderNum)
      command.setText(20, 20 + 40, font, 0, 1, 1, maskedName + " " + maskedCell)
      command.setText(20, 20 + 40 + 40, font, 0, 1, 1, type + "：" + brand + " 长度：" + scale + "  " + pole)
      if (edge.toString() == '1') {
        command.setText(20, 20 + 40 + 40 + 55, font, 0, 1, 1, "修刃 " + degree + "：")
      }
      if (more != '') {
        command.setText(300, 20 + 40 + 40 + 55, font, 0, 1, 1, "其他：" + more)
      }
      if (memo != undefined && memo != '') {
        command.setText(200, 20 + 40 + 40 + 55 + 35, font, 0, 1, 1, "注：" + memo)
      }
      if (candle.toString() == '1') {
        command.setText(20, 20 + 40 + 40 + 55 + 55, font, 0, 1, 1, "热打蜡：")
        command.setText(20, 20 + 40 + 40 + 55 + 55 + 55, font, 0, 1, 1, "刮蜡：")
      }
      else if (care.free_wax == 1){
        command.setText(20, 20 + 40 + 40 + 55 + 55, font, 0, 1, 1, "机打蜡：")
      }
      var orderInfoStr = ''
      var priceStr = ''
      if (care.entertain == true) {
        orderInfoStr = '招待'
      }
      else if (care.warranty == true) {
        orderInfoStr = '质保'
      }
      else {
        orderInfoStr = that.data.order.code
        priceStr = '金额：' + parseFloat(that.data.order.paidAmount).toFixed(2)
      }
      command.setText(290, 20 + 40 + 40 + 55 + 55 + 55 + 50, "TSS24.BF2", 0, 1, 1, orderInfoStr)
      command.setText(20, 20 + 40 + 40 + 55 + 55 + 55 + 50, font, 0, 1, 1, priceStr)
      command.setText(20, 350, font, 0, 1, 1, "取板 " + pickDateTitle + " " + pickDateStr)
      command.setText(300, 350, font, 0, 1, 1, "订单日期：" + orderDateStr)
      var qrCodeText = 'https://mini.snowmeet.top/mapp/admin/care/order_detail?orderId=' + that.data.order.id.toString() + '&careId=' + care.id.toString()
      command.setQrcode(400, 20 + 40 + 65 + 25, "L", 3, "M", qrCodeText)
      command.setPagePrint()
      return command.getData()
    },
    print(e) {
      var that = this
      var buff = null
      if (that.data.printType == '顾客小票') {
        buff = that.getCommand('【客户联】')
      }
      else {
        buff = that.getCommand('【存根】')
      }
      var newBuff = [...buff]
      that.prepareSend(newBuff)
    },
    prepareSend: function (buff) {
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
      that.send(buff)
    },
    send: function (buff) {
      var that = this
      var currentTime = that.data.currentTime
      var loopTime = that.data.looptime
      var lastData = that.data.lastData
      var onTimeData = that.data.oneTimeData
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
      var that = this
      var device = that.data.currentDevice
      wx.writeBLECharacteristicValue({
        deviceId: device.deviceId,
        serviceId: device.writeServiceId,
        characteristicId: device.writeUUID,
        value: buf,
        success: function (res) {
          console.log(currentPrint)
          if (currentPrint == printNum) {
            wx.showToast({
              title: '已打印第' + currentPrint + '张成功',
            })
            that.setData({ nowPrinting: false, finish: true })
           
          }
        },
        fail: function (e) {
          wx.showToast({
            title: '打印第' + currentPrint + '张失败',
            icon: 'none',
          })
          that.setData({ finish: true })
        },
        complete: function () {
          currentTime++
          console.log(currentTime)
          that.setData({ finish: true })
          if (currentTime <= loopTime) {
            that.setData({
              currentTime: currentTime
            })
            that.send(buff)
          } else {
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
              
              var connectingIndex = that.data.connectingIndex
              var printers = that.data.availablePrinters
              var printer = printers[connectingIndex]
              wx.closeBLEConnection({
                deviceId: printer.deviceId,
                complete: () => {
                  var connectingIndex = that.data.connectingIndex
                  var printers = that.data.availablePrinters
                  var printer = printers[connectingIndex]
                  printer.status = '未连接'
                  var connectingIndex = null
                  that.setData({ connectingIndex: null, availablePrinters: printers })
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
    printCustLabel(e) {
      wx.showModal({
        title: '打印确认',
        content: '即将打印【顾客小票】',
        complete: (res) => {
          if (res.cancel) {

          }
          if (res.confirm) {
            var that = this
            that.data.printType = '顾客小票'
            that.print(e)
          }
        }
      })
    },
    printCommonLabel(e) {
      wx.showModal({
        title: '打印确认',
        content: '即将打印【标签存根】',
        complete: (res) => {
          if (res.cancel) {

          }
          if (res.confirm) {
            var that = this
            that.data.printType = '标签存根'
            that.print(e)
          }
        }
      })

    },
    pringLabel(e) {
      var that = this
      switch (that.properties.type) {
        case 'label':
          that.data.printType = '标签存根'
          break
        case 'invoice':
          that.data.printType = '顾客小票'
          break
        default:
          break
      }
      wx.showModal({
        title: '打印确认',
        content: '即将打印【' + that.data.printType + '】',
        complete: (res) => {
          if (res.cancel) {

          }

          if (res.confirm) {
            that.print(e)
          }
        }
      })
    },
    disconnectDevice(e) {
      var that = this
      var id = e.currentTarget.id
      that.data.connectingIndex = parseInt(id)
      var printers = that.data.availablePrinters
      var printer = printers[id]
      wx.closeBLEConnection({
        deviceId: printer.deviceId,
        success: () => {
          var printers = that.data.availablePrinters
          printers[that.data.connectingIndex].status = '未连接'
          that.setData({ connectingIndex: null, availablePrinters: printers })
        }
      })

    },
    connectDeviceManual(e) {
      var that = this
      var id = e.currentTarget.id
      var connectingIndex = that.data.connectingIndex
      if (!isNaN(connectingIndex) && connectingIndex != null) {
        var printers = that.data.availablePrinters
        var printer = printers[id]
        wx.closeBLEConnection({
          deviceId: printer.deviceId,
          success: (res) => {
            console.log('disconnect success', res)
          },
          fail: (res) => {
            console.log('disconnect fail', res)
          },
          complete: () => {
            var printers = that.data.availablePrinters
            printers[that.data.connectingIndex].status = '未连接'
            that.setData({ connectingIndex: null, availablePrinters: printers })
            that.data.connectingIndex = id
            that.connectDevice()
          }
        })
      }
      else {
        that.data.connectingIndex = parseInt(id)
        that.connectDevice()
      }
    },
    getDefaultPrinterIndex() {
      var that = this
      var printers = that.data.availablePrinters
      var care = that.properties.care
      var index = 0
      if (care.free_wax == 1 || care.urgent == 1) {
        for (var i = 0; i < printers.length; i++) {
          var printer = printers[i]
          if (printer.printer.color == 'red') {
            index = i
          }
        }
      }
      else if (care.entertain) {
        for (var i = 0; i < printers.length; i++) {
          var printer = printers[i]
          if (printer.printer.color == 'yellow') {
            index = i
          }
        }
      }
      else {
        index = 0
      }
      return index
    },
    redayToPrint(e){
      var that = this
      var connectingIndex = that.data.connectingIndex
      if (isNaN(connectingIndex) || connectingIndex == null){
        connectingIndex = that.getDefaultPrinterIndex()
        that.data.connectingIndex = connectingIndex
        that.data.ready = false
        that.connectDevice()
        setTimeout(()=>{
          that.print(e)
        }, 5000)
        
      }
      else{
        that.print(e)
      }
      
    }
  }
})