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
    printType: '顾客小票'
  },
  lifetimes:{
    ready(){
      var that = this
      var type = ''
      switch(that.properties.type){
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
      that.setData({order: that.properties.order, type})
      wx.showToast({
        title: '正在连接打印机',
        icon: 'loading'
      })
      data.getPrinterListPromise(that.properties.care.shop).then(function(printers){
        console.log('get printers', printers)
        for(var i = 0; i < printers.length; i++){
          var printer = printers[i]
          switch(printer.color){
            case 'white':
              printer.colorStr = '白'
              break
            case 'yellow':
              printer.colorStr = '黄'
              break
            default:
              break
          }
        }
        that.setData({printers})
        //that.data.printers = printers
        //that.setData({deviceName: printers})
        util.getBLEDeviceNameListInRangePromise().then(function (list){
          var availablePrinters = []
          for(var i = 0; i < list.devices.length; i++){
            for(var j = 0; j < printers.length; j++){
              if (list.devices[i].name.indexOf(printers[j])>=0){
                if (list.devices[i].connectable == true){
                  availablePrinters.push(list.devices[i])
                }
              }
            }
          }
          that.data.availablePrinters = availablePrinters
          that.data.connectingIndex = 0   
          if (availablePrinters.length <= 0){
            wx.showToast({
              title: '未搜索到打印机',
              icon: 'error'
            })
            return
          }
          that.connectDevice()
          console.log('get ble list', availablePrinters)
        }).catch(function (exp){
          console.log('get ble list failed', exp)
        })
      })
    },
    detached(){
      var that = this
      wx.closeBLEConnection({
        deviceId: that.data.currentDevice.deviceId,
      })
    }
  },

  /**
   * Component methods
   */
  methods: {
    setPrintType(e){
      var that = this
      that.data.printType = e.detail.value
    },
    getDeviceNameList: function() {
      var that = this
      var task = that.data.maintain_in_shop_request
      var color = that.data.color
      if (color == undefined){
        color = 'white'
        that.setData({color: color})
      }
      var getDeviceNameUrl = 'https://' + app.globalData.domainName + '/core/Printer/GetPrinters?shop=' + encodeURIComponent(task.shop) + '&color=' + color + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      
      var deviceName = []
      wx.request({
        url: getDeviceNameUrl,
        success: (res) => {
          if (res.statusCode == 200) {
            if (that.data.color != undefined){
              for(var i = 0; i < res.data.length; i++) {
                deviceName.push(res.data[i].name)
              }
            }
            that.data.deviceName = deviceName
            this.getDeviceNameListInRange()
          }
        },
        fail: (res)=>{
          that.setData({finish: true})
          console.log(res)
        }
      })
    },
    connectDevice(){
      var that = this
      var connectingIndex = that.data.connectingIndex
      var printerList = that.data.availablePrinters;
      if (connectingIndex >= that.data.availablePrinters.length){
        wx.showToast({
          title: '连接失败',
          icon: 'error'
        })
        return
      }
      util.connectBLEPromise(printerList[connectingIndex].deviceId).then(function (device){
        console.log('device connect', device)
        var printer = that.data.availablePrinters[that.data.connectingIndex]
        printer.connected = true
        that.setData({ready: true, currentDevice: device})

      }).catch(function(){
        connectingIndex++
        that.data.connectingIndex = connectingIndex
        that.connectDevice()
      })
    },
    getCommand(labelType){
      var that = this
      var care = that.properties.care

      var brand = care.brand == null? '未填' : care.brand
      var orderNum = care.task_flow_code
      var name = care.customerName==null? '':care.customerName
      var cell = care.customerCell==null?'':care.customerCell
      var maskedCell = ''
      if (cell.length == 11){
        maskedCell = cell.substring(0, 3) + '****' + cell.substring(7, 11)
      }
      var maskedName = ''
      
      if (name.length > 0) {
        maskedName = name.substring(0,1) + care.customerName
      }
      if (labelType == '【客户联】' || labelType == '【存根】' ) {
        maskedName = name
        maskedCell = cell
        that.data.copies = 1
      }
      else{
        that.data.copies = 1
      }
      var edge = care.need_edge
      var candle = care.need_wax
      var degree = care.edge_degree
      var type = care.equipment
      var more = care.repair_more? care.repair_more : ''
      var memo = care.repair_memo? care.repair_memo: ''
      var pole = care.with_pole == true ? '含杖' : ''
      var orderDate = new Date(care.create_date)
      
      var orderDateStr = (orderDate.getMonth() + 1).toString() + '-' + orderDate.getDate().toString()
      var urgent = false
      if (care.urgent == 1){
        urgent = true
      }
      var pickDate = new Date(orderDate)
      if (care.member_pick_date != null){
        pickDate = new Date(care.member_pick_date)
      }
      else{
        if (!urgent){
          pickDate = pickDate.setDate(pickData.getdate() + 1)
        }
      }
      var pickDateStr = (pickDate.getMonth()+1).toString() + '-' + pickDate.getDate().toString()
      var scale = care.scale? care.scale: '未填'
      var pickDateTitle = '次日'
      if (pickDate.getDate() == orderDate.getDate()) {
        pickDateTitle = '当日'
      }
      else if (pickDate.getDate() - orderDate.getDate() != 1) {
        pickDateTitle = '多日'
      }
      else{
        pickDateTitle = '次日'
      }
      var command = tsc.jpPrinter.createNew()
      command.setCls()//清除缓冲区，防止下一个没生效
      command.setSize(75, 50)//设置标签大小，单位mm.具体参数请用尺子量一下
      command.setGap(4)//设置两个标签之间的间隙，单位mm.具体参数请用尺子量一下
      command.setCls()//清除缓冲区
      command.setText(20, 20, "TSS32.BF2", 0, 1, 1, labelType + ' ' + (urgent?'(急)':'') + orderNum )
      command.setText(20, 20 + 40, "TSS32.BF2", 0, 1, 1,  maskedName + " " + maskedCell )
      command.setText(20, 20 + 40 + 40, "TSS32.BF2", 0, 1, 1, type + "：" + brand + " 长度：" + scale + "  " + pole)
      if (edge.toString() == '1') {
        command.setText(20, 20 + 40 + 40 + 55, "TSS32.BF2", 0, 1, 1, "修刃 " + degree + "：")
      }
      if (more!='') {
        command.setText(300, 20 + 40 + 40 + 55, "TSS32.BF2", 0, 1, 1, "其他：" + more)
      }
      if (memo != undefined && memo != ''){
        command.setText(200, 20 + 40 + 40 + 55 + 35, "TSS32.BF2", 0, 1, 1, "注：" + memo)
      }
      if (candle.toString()=='1') {
        command.setText(20, 20 + 40 + 40 + 55 + 55, "TSS32.BF2", 0, 1, 1, "打蜡：")
        command.setText(20, 20 + 40 + 40 + 55 + 55 + 55, "TSS32.BF2", 0, 1, 1, "刮蜡：")
      }
      var orderInfoStr = ''
      var priceStr = ''
      if (care.entertain == true){
        orderInfoStr = '招待'
      }
      else if (care.warranty == true){
        orderInfoStr = '质保'
      }
      else{
        orderInfoStr =  that.data.order.code
        priceStr = '金额：' + parseFloat(that.data.order.paidAmount).toFixed(2)
      }
      var qrCodeText = 'https://mini.snowmeet.top/mapp/admin/care/order_detail?orderId=' + that.data.order.id.toString() + '&careId=' + care.id.toString() 
      command.setText(290, 20 + 40 + 40 + 55 + 55 + 55 + 50, "TSS24.BF2", 0, 1, 1, orderInfoStr)
      command.setText(20,  20 + 40 + 40 + 55 + 55 + 55 + 50 , "TSS32.BF2", 0, 1, 1, priceStr)
      command.setQrcode(400, 20 + 40 + 65 + 25, "L", 3, "M", qrCodeText)
      command.setText(20, 350, "TSS32.BF2", 0, 1, 1, "取板 " + pickDateTitle + " " + pickDateStr)
      command.setText(300, 350, "TSS32.BF2", 0, 1, 1, "订单日期：" + orderDateStr)
      command.setPagePrint()
      return command.getData()
    },
    print(e){
      var that = this
      var buff = null
      if (that.data.printType == '顾客小票'){
        buff = that.getCommand('【客户联】')
      }
      else{
        buff = that.getCommand('【存根】')
      }
      var newBuff = [...buff]
      that.prepareSend(newBuff)
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
      that.send(buff)
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
            that.setData({nowPrinting: false, finish: true})
          }
          //console.log(res)
        },
        fail: function (e) {
          wx.showToast({
            title: '打印第' + currentPrint + '张失败',
            icon: 'none',
          })
          that.setData({finish: true})
          //console.log(e)
        },
        complete: function () {
          currentTime++
          console.log(currentTime)
          that.setData({finish: true})
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
    printCustLabel(e){
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
      
      //that.data.
    },
    printCommonLabel(e){
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
    pringLabel(e){
      var that = this
      switch(that.properties.type){
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
    }
  },
  
})