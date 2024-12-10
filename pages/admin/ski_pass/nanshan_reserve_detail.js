// pages/admin/ski_pass/nanshan_reserve_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
var tsc = require("../../../utils/ble_label_printer/tsc.js")
Page({

  /**
   * Page initial data
   */
  data: {
    showCard: false,
    imgUrl:'',

    deviceName: [],
    deviceInRange: [],
    readyForPrint: false,
    finish: true,
    currentDevice: {
      deviceId: '', services: [],
      readServiceId: '', readCharacterUuid: '', 
      writeServiceId: '', writeCharacterUuid: '', 
      notifyServiceId:'', notifyCharacterUuid: ''},
    currentDeviceIndex: 0,
    currentServiceIndex: 0,
    showedMsg: [],
    reConnecting: false,
    reConnectTimes: 0,
    copies: 1
  },

  getSkiPass(id){
    var that = this
    var productReserveList = that.data.productReserveList
    var memberList = productReserveList.memberList
    var skipass = undefined
    for(var i = 0; i < memberList.length; i++){
      var skiPasses = memberList[i].skiPasses
      for (var j = 0; j < skiPasses.length; j++){
        if (skiPasses[j].id == id){
          skipass = skiPasses[j]
          break
        }
      }
      if (skipass != undefined){
        break
      }
    }
    return skipass
  },

  setEdit(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    if (!skipass){
      return
    }
    skipass.status = 'edit'
    var productReserveList = that.data.productReserveList
    that.setData({productReserveList})
  },

  setCardNo(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    if (!skipass.card_no_filled){
      skipass.status = ''
      var productReserveList = that.data.productReserveList
      that.setData({productReserveList})
    }
    else{
      wx.showModal({
        title: '确认修改雪票卡号？',
        content: '新卡号：' + skipass.card_no_filled,
        complete: (res) => {
          if (res.cancel) {
            skipass.card_no_filled = undefined
            skipass.status = ''
          }
      
          if (res.confirm) {
            skipass.card_no = skipass.card_no_filled
            skipass.card_no_filled = undefined
            that.updateSkipass(skipass)
            
            
          }
        }
      })
      
    }
    
  },

  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/GetReserveProductDetail/' + that.data.productId + '?reserveDate=' + that.data.date + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var productReserveList = res.data
        productReserveList.reserveDateStr = util.formatDate(new Date(productReserveList.reserveDate))
        console.log('productReserveList', productReserveList)
        that.setData({productReserveList})
      }
    })
  },

  uploadCard(id, filePath){
    var that = this
    var skipass = that.getSkiPass(id)
    var purpose = skipass.contant_name + '_' + util.formatDate(new Date(skipass.reserve_date)) + '_' + skipass.product_name
    purpose = encodeURIComponent(purpose)
    var uploadUrl = 'https://' + app.globalData.uploadDomain + '/core/UploadFile/SnowmeetFileUpload?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '?purpose=' + encodeURIComponent(purpose) 
    wx.uploadFile({
      filePath: filePath,
      name: 'file',
      url: uploadUrl,
      success: (res)=>{
        console.log('upload card image', res)
        if (res.statusCode != 200){
          return
        }
        var fileName = res.data
        if (!fileName){
          wx.showToast({
            icon: 'error',
            title: '图片上传失败'
          })
          return
        }
        skipass.card_image_url = fileName
        that.updateSkipass(skipass)
        //var updateUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/'

      }
    })
  },

  updateSkipass(skipass){
    var that = this
    var modUrl = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/UpdateSkiPass?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: modUrl,
      method: 'POST',
      data: skipass,
      success:(res)=>{
        if (res.statusCode != 200){
          if (res.statusCode == 204){
            wx.showToast({
              title: '卡号重复',
              icon: 'error',
            })
            return
          }
          wx.showToast({
            title: '更新失败',
            icon: 'error',
          })
          return
        }
        skipass.status = undefined
        var productReserveList = that.data.productReserveList
        that.setData({productReserveList})
        console.log('ski pass updated', res)
      }
    })
  },

  ocrCard(id, filePath){
    var that = this
    var skipass = that.getSkiPass(id)
    var fs = wx.getFileSystemManager()
    //var path = res.tempImagePath
    fs.readFile({
      filePath: filePath,
      encoding: 'base64',
      success:(res)=>{
        console.log('read file', res)
        var base64Content = res.data
        if (!base64Content)
        {
          return
        }
        var ocrUrl = 'https://' + app.globalData.domainName + '/core/Ocr/GeneralBasicOcr?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: ocrUrl,
          method: 'POST',
          data: base64Content,
          success:(res)=>{
            console.log('ocr result', res)
            var cardNo = undefined
            var ocrArr = res.data
            for(var i = 0; i < ocrArr.length; i++){
              var str = ocrArr[i].trim()
              if (str.indexOf('N') == 0){
                str = str.replace('。','.')
                try{
                  cardNo = str.split('.')[1].trim()
                }
                catch{

                }
              }
            }
            if (!cardNo){
              return
            }
            skipass.card_no_filled = cardNo
            var productReserveList = that.data.productReserveList
            that.setData({productReserveList})
          }
        })
      }
    })
  },

  ocr(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType:['camera'],
      camera: ['back'],
      sizeType:['original'],
      success:(res)=>{
        console.log('take photo', res)
        var path = res.tempFiles[0].tempFilePath
        that.uploadCard(id, path)
        that.ocrCard(id, path)
        skipass.status = 'edit'
        var productReserveList = that.data.productReserveList
        that.setData({productReserveList})
      }
    })
    
  },
  inputCardNo(e){
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.value
    var skipass = that.getSkiPass(id)
    skipass.card_no_filled = value
    var productReserveList = that.data.productReserveList
    that.setData({productReserveList}) 

  },
  showCard(e){
    var that = this
    var id = e.currentTarget.id
    var skipass = that.getSkiPass(id)
    if (skipass.card_image_url){
      var img = 'https://' + app.globalData.uploadDomain + skipass.card_image_url
      that.setData({showCard: true, imgUrl: img})
    }
  },
  print: function(){
    var that = this
    if (!that.data.readyForPrint) {
      if (!that.data.reConnecting){
        //this.setData({readyForPrint: true})
        //this.getDeviceNameListInRange()
        that.getDeviceNameList()
        that.data.reConnecting = true
      }
      if (that.data.reConnectTimes < 100)
      {
        that.data.reConnectTimes++
        setTimeout(() => {
          that.print()
        }, 1000)
      }
      return
    }
    that.data.reConnectTimes = 0
    that.data.reConnecting = false
    
    console.log('开始打印')
    var readyForPrint = that.data.readyForPrint
    if (readyForPrint){
      that.setData({readyForPrint: false})
      var buff1 = that.getCommand(that.data.productReserveList, that.data.currentIndex)
      //var buff2 = this.getCommand('【雪板标签】')
      //var buff3 = this.getCommand('【存根】')
      //var newBuff = [...buff1, ...buff2, ...buff3]
      var newBuff = [...buff1]
      console.log('buff', newBuff)
      that.prepareSend(newBuff)
      
    }

  },
  

  preparePrint(e){
    var that = this
    var productReserveList = that.data.productReserveList
    var id = e.currentTarget.id
    var member = productReserveList.memberList[parseInt(id)]
    var content = (id+1).toString() + '.【姓名：' + member.name + '】 【电话：' + member.cell + '】【张数：' + member.skiPasses.length + '】'
    wx.showModal({
      title: '是否开始打印当前雪票？',
      content: content,
      complete: (res) => {
        if (res.cancel) {
          
        }
    
        if (res.confirm) {
          that.setData({currentIndex: id})
          that.print()
        }
      }
    })
  },
  getDeviceNameList: function() {
    var that = this
    var task = that.data.maintain_in_shop_request
    var color = that.data.color
    if (color == undefined){
      color = 'white'
      that.setData({color: color})
    }
    var getDeviceNameUrl = 'https://' + app.globalData.domainName + '/core/Printer/GetPrinters?shop=' + encodeURIComponent('南山') + '&color=' + color + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    
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
          that.getDeviceNameListInRange()
        }
      },
      fail: (res)=>{
        that.setData({finish: true})
        console.log(res)
      }
    })
  },

  getDeviceNameListInRange: function() {
    var that = this
    that.data.currentDeviceIndex = 0
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
                    that.setData({finish: true})
                    console.log('手机蓝牙无法停止搜索其他设备。')
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
              console.log('手机蓝牙设备不可用。')
              that.setData({showedMsg: showedMsg})
              that.setData({finish: true, reConnecting: false})
            }
          },
          fail: (res) => {
            var showedMsg = that.data.showedMsg
            console.log('获取蓝牙设备状态失败。')
            that.setData({showedMsg: showedMsg})
            that.setData({finish: true, reConnecting: false})
          }
        })
      },
      fail: (res) => {
        var showedMsg = that.data.showedMsg
        that.setData({finish: true})
        console.log('请打开蓝牙，返回后重试。')
        that.setData({showedMsg: showedMsg})
        
      }
    })
  },
  searchInRangedBluetoothDevices: function() {
    var that = this
    var showedMsg = this.data.showedMsg
    console.log('开始扫描蓝牙设备。')
    that.setData({showedMsg: showedMsg, deviceInRange: []})
    wx.startBluetoothDevicesDiscovery({
      success: (res) => {
        setTimeout(() => {
          wx.getBluetoothDevices({
            success: (res) => {
              for (var i = 0; i < res.devices.length; i++) {
                for(var j = 0; j < this.data.deviceName.length; j++) {
                  //if (this.data.deviceName[j] == res.devices[i].name) {
                  if (res.devices[i].name.indexOf(that.data.deviceName[j])>=0) {
                    var list = that.data.deviceInRange
                    list.push(res.devices[i])
                  }
                }
              }
              if (that.data.deviceInRange.length > 0) {
                console.log('获取到' + this.data.deviceInRange.length.toString() + '设备。')
                that.setData({showedMsg: showedMsg})
                that.tryConnectDevice()
              }
              else {
                console.log('获取在线设备失败。')
                that.setData({showedMsg: showedMsg})
                that.setData({finish: true, reConnecting: false})
              }
              
            },
            fail: (res) => { 
              console.log('获取设备在线列表失败。')
              that.setData({showedMsg: showedMsg})
              that.setData({finish: true, reConnecting: false})
            }
          })
        }, 5000);
      },
      fail: (res) => {
        showedMsg = that.data.showedMsg
        that.setData({finish: true, reConnecting: false})
        console.log('扫描设备列表失败。')
        that.setData({showedMsg: showedMsg})
        that.setData({finish: true})
      }
    })
  },
  tryConnectDevice: function() {
    var that = this
    if (!that.data.readyForPrint) {
      if (that.data.currentDeviceIndex < this.data.deviceInRange.length) {
        var showedMsg = that.data.showedMsg
        console.log('开始尝试连接第' + (this.data.currentDeviceIndex + 1).toString() + '台设备。')
        that.setData({showedMsg: showedMsg})
        that.connectOneDevice()
      }
      else {
        var showedMsg = that.data.showedMsg
        console.log('所有设备连接失败。')
        that.setData({showedMsg: showedMsg})
        that.setData({finish: true, reConnecting: false})
      }
    }
  },
  connectOneDevice: function() {
    var deviceId = this.data.deviceInRange[this.data.currentDeviceIndex].deviceId
    var showedMsg = this.data.showedMsg
    console.log('开始连接，设备ID：'+deviceId)
    this.setData({showedMsg: showedMsg})
    wx.createBLEConnection({
      deviceId: deviceId,
      success: (res) => {
        console.log('连接成功，开始获取设备服务列表。')
        this.setData({showedMsg: showedMsg})
        wx.getBLEDeviceServices({
          deviceId: deviceId,
          success: (res) => {
            console.log('设备服务列表获取成功。')
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
            console.log('服务列表获取失败。')
            this.setData({showedMsg: showedMsg})
            this.data.currentDeviceIndex++
            this.tryConnectDevice()
          }
        })
      },
      fail: (res) => {
        console.log('设备' + this.data.currentDeviceIndex + '连接失败。')
        this.setData({finish: true})
        this.setData({showedMsg: showedMsg})
        this.data.currentDeviceIndex++
        this.tryConnectDevice()
      }
    })
  },
  getCharacteristics: function() {
    var showedMsg = this.data.showedMsg
    console.log('开始获取特性列表。')
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
            console.log('特征值不全。')
            this.setData({showedMsg: showedMsg})
            this.data.currentDeviceIndex++
            this.tryConnectDevice()
          }
          else{
            this.getCharacteristics()
          }

        }
        else{
          console.log('连接成功')
          this.setData({showedMsg: showedMsg, readyForPrint: true})
        }

      },
      fail: (res) => {
        console.log('开始获取特性列表失败。')
        that.setData({finish: true})
        this.setData({showedMsg: showedMsg})
        this.data.currentDeviceIndex++
        this.tryConnectDevice()
      }
    })
  },

  getCommand(productReserveList, index){
    
    var member = productReserveList.memberList[index]
    var dateStr = "日期：" + productReserveList.reserveDateStr
    var pNameStr = "名称：" + productReserveList.product_name
    var nameStr = "姓名：" + member.name
    var cellStr = "电话：" + member.cell
    var countStr = "张数：" + productReserveList.skiPassCount
    
    var pNameStr1 = pNameStr.substr(0, 10)
    var pNameStr2 = pNameStr.substr(10, pNameStr.length - 10)
   
    
    var command = tsc.jpPrinter.createNew()
    command.setCls()//清除缓冲区，防止下一个没生效
    command.setSize(75, 50)//设置标签大小，单位mm.具体参数请用尺子量一下
    command.setGap(4)//设置两个标签之间的间隙，单位mm.具体参数请用尺子量一下
    command.setCls()//清除缓冲区


    var lineWidth = 55

    command.setText(50, 20, "TSS48.BF2", 0, 1, 1, dateStr)
    command.setText(50, 20 + lineWidth , "TSS48.BF2", 0, 1, 1, pNameStr1)
    command.setText(50, 20 + lineWidth * 2, "TSS48.BF2", 0, 1, 1, pNameStr2)
    command.setText(50, 20 + lineWidth * 3 , "TSS48.BF2", 0, 1, 1, nameStr)
    command.setText(50, 20 + lineWidth * 4, "TSS48.BF2", 0, 1, 1, cellStr)
    command.setText(50, 20 + lineWidth * 5, "TSS48.BF2", 0, 1, 1, countStr)


    command.setPagePrint()
    return command.getData()
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
            wx.closeBLEConnection({
              deviceId: that.data.currentDevice.deviceId,
              success: (res) => {
                wx.showToast({
                  title: '打印完毕，蓝牙打印机断开。',
                })
                //that.data.readyForPrint = false
                that.setData({readyForPrint: false})
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
  prepareSend: function(buff){
    var that = this
    var time = 1024
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

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    console.log('options', options)
    var that = this
    var productId = options.productId
    var date = decodeURIComponent(options.date)
    that.setData({productId, date})
    app.loginPromiseNew.then(function(resolve){
      that.getData()
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    //var that = this
    //that.getData()
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  }
})