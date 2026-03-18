const getMemberInfo = (member, infoType) => {
  var num = ''
  for (var i = 0; i < member.memberSocialAccounts.length; i++) {
    var msa = member.memberSocialAccounts[i]
    if (msa.type == infoType && msa.valid == 1) {
      num = msa.num
      break
    }
  }
  return num
}
const isWeekend = (date) => {
  if (date.getDay() == 0 || date.getDay() == 6) {
    return true
  }
  else {
    return false
  }
}
const formatDateTime = date => {

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  return [year, month, day].map(formatNumber).join('-') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatTimeStr = date => {
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  return [hour, minute, second].map(formatNumber).join(':')
}

const formatDate = date => {
  var monthStr = (date.getMonth() + 1).toString()
  var dayStr = date.getDate().toString()
  return date.getFullYear().toString() + '-' + '00'.substr(0, 2 - monthStr.length) + monthStr + '-' + '00'.substr(0, 2 - dayStr.length) + dayStr
}

const formatDateString = dateString => {
  //dateString = dateString.replace(' ', 'T')
  var dateTime = new Date(dateString)
  var monthStr = dateTime.getMonth() < 9 ? ('0' + (dateTime.getMonth() + 1).toString()) : (dateTime.getMonth() + 1).toString()
  var dateStr = dateTime.getDate() < 10 ? '0' + dateTime.getDate().toString() : dateTime.getDate().toString()
  var hourStr = dateTime.getHours() < 10 ? '0' + dateTime.getHours().toString() : dateTime.getHours().toString()
  var minStr = dateTime.getMinutes() < 10 ? '0' + dateTime.getMinutes().toString() : dateTime.getMinutes().toString()
  dateString = dateTime.getFullYear().toString() + '-' + monthStr + '-' + dateStr + 'T' + hourStr + ':' + minStr + ':00.000Z'
  return dateString
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : '0' + n
}

const showAmount = n => {
  var amount = parseFloat(n)
  amount = Math.round(amount * 100) / 100
  var amountStrArr = amount.toString().split('.')
  return '¥' + amountStrArr[0] + '.' + (amountStrArr.length == 2 ? (amountStrArr[1].length == 1 ? amountStrArr[1] + '0' : amountStrArr[1]) : '00')

}
const exists = n => {
  if (n != null && n != undefined) {
    return true
  }
  else {
    return false
  }
}

const isBlank = str => {
  if (str == undefined || str == null || str == '') {
    return true
  }
  else {
    return false
  }
}

const getDisplayedCode = code => {
  var displayedCode = ''
  for (var i = 0; i < code.length; i = i + 2) {
    if (i == 0) {
      displayedCode = code.substr(i, 2)
    }
    else {
      displayedCode = displayedCode + '-' + code.substr(i, 2)
    }

  }
  return displayedCode
}

const skiPassDescNanashanRent = '<ul><li>出票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00前可使用</li><li>下午加夜场时间：限当日14:30后使用</li></ul>'

const skiPassDescNanashanRentAll = '<ul><li>出票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00前可使用</li><li>下午加夜场时间：限当日14:30后使用</li><li>购买当日全天含装备 雪票则包含南山装备（一套雪服、头盔、雪镜、手套租费）</li></ul>'

const skiPassDescNanashanCommon = '<ul><li>票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间 18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00均前可使用</li><li>下午加夜场时间：限当日14:30后使用</li></ul>'


const performWebRequest = function (url, data) {
  return new Promise(function (resolve, reject) {
    var method = data == undefined ? 'GET' : 'POST'
    wx.request({
      url: url,
      data: data,
      method: method,
      success: (res) => {
        console.log('web request', res)
        if (res.statusCode != 200) {
          wx.showToast({
            title: res.statusCode.toString(),
            icon: 'error'
          })
          return
        }
        if (res.data.code != 0) {
          if (res.data.message != '') {
            wx.showToast({
              title: res.data.message,
              icon: 'none'
            })
          }
          reject(res.data.message)
        }
        else {
          resolve(res.data.data)
        }
      },
      fail: (res) => {
        wx.showToast({
          title: '网络不通',
          icon: 'error'
        })
        reject({})
      }
    })
  })
}
const createRentalDetail = function (rental, startDate, endDate) {
  startDate = new Date(formatDate(startDate))
  endDate = new Date(formatDate(endDate))
  var presets = rental.pricePresets
  var details = []
  var totalAmount = 0
  var i = new Date(formatDate(startDate))
  for (; i <= endDate; i.setDate(i.getDate() + 1)) {
    var rentType = '日场'
    if (formatDate(new Date(startDate)) == formatDate(new Date(endDate))
      && formatDate(new Date(startDate)) == formatDate(new Date())) {
      var currentDate = new Date()
      if (currentDate.getHours() >= 16) {
        rentType = '夜场'
      }
      else if (currentDate.getHours() >= 13) {
        rentType = '下午场'
      }
    }
    var price = getRentPrice(rental.priceList, i, rentType)
    if (price != null) {
      var discount = 0
      var rentDate = formatDate(i)
      for (var k = 0; presets && k < presets.length; k++) {
        if (formatDate(new Date(presets[k].rent_date)) == rentDate) {
          discount = presets[k].discount
        }
      }
      var detail = {
        rent_date: rentDate,
        day_type: price.day_type,
        rent_type: price.rent_type,
        scene: price.scene,
        price: price.price,
        discount: discount,
        priceStr: showAmount(price.price),
        summary: price.price - discount,
        summaryStr: showAmount(price.price - discount)
      }
      totalAmount += price.price
      details.push(detail)
    }
  }
  rental.totalAmount = totalAmount
  rental.totalAmountStr = showAmount(totalAmount)
  if (details && details.length > 0 && (rental.pricePresets == null || rental.pricePresets.length == 0)){
    rental.pricePresets = details
  }
  
  return details
}
const getRentPrice = function (priceList, date, rentType) {
  var weekend = isWeekend(date)
  var commonPrice = null
  for (var i = 0; i < priceList.length; i++) {
    var price = priceList[i]
    if (price.rent_type == rentType
      && ((weekend && price.day_type == '周末') || (!weekend && price.day_type == '平日'))) {
      return price
    }
    if (price.rent_type == '日场'
      && ((weekend && price.day_type == '周末') || (!weekend && price.day_type == '平日'))) {
      commonPrice = price
    }
  }
  return commonPrice
}
const checkRentalsWellForm = function (rentals) {
  if (!rentals) {
    return false
  }
  var well = true
  for (var i = 0; i < rentals.length; i++) {
    var rental = rentals[i]
    var rentalWell = true
    if (rental.noGuaranty != true && !rental.guaranty) {
      well = false
      rentalWell = false
      break
    }
    if (rental.rentItems.length <= 0) {
      well = false
      rentalWell = false
      break
    }
    for (var j = 0; j < rental.rentItems.length; j++) {
      var itemWell = true
      var item = rental.rentItems[j]
      if (item.pick_type == null){
        well = false
        itemWell = false
        rentalWell = false
      }
      if (item.noNeed) {
        item.wellFormed = true
        continue
      }
      if (!item.category) {
        well = false
        itemWell = false
        rentalWell = false
      }
      if (item.noNeed != true) {
        if (item.noCode == true) {
          if (!item.name || item.name == '') {
            well = false
            itemWell = false
            rentalWell = false
          }
        }
        else {
          if (!item.code || item.code == '' || !item.name || item.name == '') {
            well = false
            itemWell = false
            rentalWell = false
          }
        }
      }
      item.wellFormed = itemWell
    }
    rental.wellFormed = rentalWell
  }
  return well
}
const orderPaid = function (order) {
  if (order.paidAmount > 0) {
    return true
  }
  else {
    return false
  }
}
const getCareWellFormMessage = function (care) {
  var that = this
  if (!care.equipment || care.equipment == '') {
    return '必须选择类型'
  }
  if ((!care.careImages || care.careImages.length == 0)
    && (!care.brand || care.brand == '' || !care.scale || care.scale == '')) {
    return '图片和品牌长度必填其一'
  }
  var isSummer = false
  if (care.ticket && (care.ticket.template_id == 17 || care.ticket.template_id == 18) ){
    isSummer = true
  }
  if (!care.product && (!care.repair_charge || care.repair_charge == 0) && care.free_wax == 0 && isSummer == false ) {
    return '必须选择业务'
  }
  return ''
}
const getRentalIndexFromOder = function (rentalId, order) {
  var index = null
  for (var i = 0; order.rentals && i < order.rentals.length; i++) {
    if (order.rentals[i].id == rentalId) {
      index = i
      break
    }
  }
  return index
}
const getRentItemIndexFromRental = function (rentItemId, rental) {
  var index = null
  var rentItems = rental.rentItems
  for (var j = 0; rental && rentItems && j < rentItems.length; j++) {
    if (rentItems[j].id == rentItemId) {
      index = j
      break
    }
  }
  return index
}
const getRentalDetailIndexFromRental = function (detailId, rental) {
  var index = null
  for (var i = 0; rental && rental.details && i < rental.details.length; i++) {
    if (rental.details[i].id == detailId) {
      index = i;
    }
  }
  return index
}
const canRenderNumber = function (number) {
  if (!number) {
    return false
  }
  if (number.indexOf('.') >= 0 && number[number.length - 1] == '0') {
    return false
  }
  else {
    return true
  }
}
const getBLEDeviceNameListInRangePromise = function () {
  return new Promise(function (resolve, reject) {
    wx.openBluetoothAdapter({
      success: (res) => {
        wx.getBluetoothAdapterState({
          success: (res) => {
            if (res.available) {
              if (res.discovering) {
                wx.stopBluetoothDevicesDiscovery({
                  success: (res) => {
                    //searchInRangedBluetoothDevices()
                    console.log('discovery finished', res)
                    wx.startBluetoothDevicesDiscovery({
                      success: (res) => {
                        console.log(res)
                        setTimeout(() => {
                          wx.getBluetoothDevices({
                            success: (res) => {
                              console.log('get device', res)
                              resolve(res)
                            }
                          })
                        }, 2000)
                      }
                    })
                  },
                  fail: (res) => {
                    reject('手机蓝牙无法停止搜索其他设备。')
                  }
                })
              }
              else {
                wx.startBluetoothDevicesDiscovery({
                  success: (res) => {
                    console.log(res)
                    setTimeout(() => {
                      wx.getBluetoothDevices({
                        success: (res) => {
                          console.log('get device', res)
                          resolve(res)
                        }
                      })
                    }, 2000)
                  }
                })
              }
            }
            else {
              reject('手机蓝牙设备不可用。')
            }
          },
          fail: (res) => {
            reject('获取蓝牙设备状态失败。')
          }
        })
      },
      fail: (res) => {
        reject('请打开蓝牙，返回后重试。')
      }
    })
  })
}
/*
const connectBLEDevicePromise = function (deviceId) {
  return new Promise(function (resolve, reject) {
    wx.createBLEConnection({
      deviceId: deviceId,
      success: (res) => {
        resolve(res)
      },
      fail: () => {
        reject('设备连接失败')
      }
    })
  })
}
*/
const connectBLEPromise = function (deviceId) {
  return new Promise(function (resolve, reject) {
    wx.createBLEConnection({
      deviceId: deviceId,
      success: (res) => {
        console.log('connect ble device', res)
        var device = res
        device.deviceId = deviceId
        wx.getBLEDeviceServices({
          deviceId: deviceId,
          success: (res) => {
            console.log('get services', res)
            device.services = res.services
            device.correctServiceIndex = 0
            getPrinterCharacteristicsPromise(device).then(function (device) {
              console.log('find service', device)
              resolve(device)
            })
          },
          fail: () => {
            reject()
          }
        })
        //resolve(res)
      },
      fail: () => {
        reject('链接失败')
      }
    })
  })
}
const getPrinterCharacteristicsPromise = function (device) {
  var index = device.correctServiceIndex
  return new Promise(function (resolve, reject) {
    if (index > device.services.length) {
      reject('未找到服务')
    }
    else {
      var service = device.services[index]
      wx.getBLEDeviceCharacteristics({
        deviceId: device.deviceId,
        serviceId: service.uuid,
        success: (res) => {
          console.log('get character', res)
          var cArr = res.characteristics
          for (var i = 0; i < cArr.length; i++) {
            var c = cArr[i]
            var p = c.properties
            if (!device.notifyUUID && p.notify) {
              device.notifyServiceId = service.uuid
              device.notifyUUID = c.uuid
            }
            if (!device.readUUID && p.read) {
              device.readServiceId = service.uuid
              device.readUUID = c.uuid
            }
            if (!device.writeUUID && p.write) {
              device.writeServiceId = service.uuid
              device.writeUUID = c.uuid
            }
          }
          if (device.notifyUUID && device.readUUID && device.writeUUID) {
            resolve(device)
          }
          else {
            device.correctServiceIndex++
            getPrinterCharacteristicsPromise(device).then(function (device) {
              resolve(device)
            }).catch(function () {
              reject()
            })
          }
        }
      })
    }
  })



  if (index >= device.services.length) {

  }
  var service = device.services[device.correctServiceIndex]

  return new Promise(function (resolve, reject) {
    wx.getBLEDeviceCharacteristics({
      deviceId: device.deviceId,
      serviceId: service.uuid,
      success: (res) => {
        console.log('get characters', res)
      },
      fail: () => {
        reject()
      }
    })
  })
}
const parseQuery = function (url, para) {
  var v = null
  url = decodeURIComponent(url)
  if (url.indexOf('?') < 0) {
    return null
  }
  var query = url.split('?')[1]
  var queryArr = query.split('&')
  for (var i = 0; i < queryArr.length; i++) {
    var pairArr = queryArr[i].split('=')
    if (pairArr[0] == para) {
      if (pairArr.length > 1) {
        v = pairArr[1]
      }
    }
  }
  return v
}
const renderUnipayOrders = function (orders) {
  for(var i = 0; i < orders.length; i++){
    renderUnipayOrder(orders[i])
  }
}
const renderUnipayOrder = function (order) {
  order.paidAmountStr = showAmount(order.paidAmount)
  order.refundAmountStr = showAmount(order.refundAmount)
  order.remainAmount = order.paidAmount - order.refundAmount
  order.remainAmountStr = showAmount(order.remainAmount)
  order.payMethod = order.availablePayments[0].pay_method
  var bizDate = new Date(order.biz_date)
  var dateStrArr = formatDate(bizDate).split('-')
  order.biz_dateStr = dateStrArr[1] + '-' + dateStrArr[2]
  order.biz_dateFullStr = formatDate(bizDate)
  order.biz_timeStr = formatTimeStr(bizDate)
}


module.exports = {
  formatDateTime: formatDateTime,
  formatDate: formatDate,
  formatTimeStr: formatTimeStr,
  showAmount: showAmount,
  formatDateString: formatDateString,
  exists: exists,
  skiPassDescNanashanRent: skiPassDescNanashanRent,
  skiPassDescNanashanRentAll: skiPassDescNanashanRentAll,
  skiPassDescNanashanCommon: skiPassDescNanashanCommon,
  isBlank: isBlank,
  getDisplayedCode: getDisplayedCode,
  getMemberInfo: getMemberInfo,
  performWebRequest: performWebRequest,
  isWeekend,
  createRentalDetail,
  getRentPrice,
  checkRentalsWellForm,
  orderPaid,
  getCareWellFormMessage,
  getRentalIndexFromOder,
  getRentItemIndexFromRental,
  getRentalDetailIndexFromRental,
  canRenderNumber,
  getBLEDeviceNameListInRangePromise,
  connectBLEPromise,
  getPrinterCharacteristicsPromise,
  parseQuery,
  renderUnipayOrders,
  renderUnipayOrder
}
