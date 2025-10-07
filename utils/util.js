const getMemberInfo = (member, infoType) =>{
    var num = ''
    for(var i = 0; i < member.memberSocialAccounts.length; i++){
      var msa = member.memberSocialAccounts[i]
      if (msa.type == infoType && msa.valid == 1){
        num = msa.num
        break
      }
    }
    return num
}
const isWeekend = (date) => {
  if (date.getDay() == 0 || date.getDay() == 6){
    return true
  }
  else{
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
  return date.getFullYear().toString() + '-' + '00'.substr(0, 2-monthStr.length) + monthStr + '-' + '00'.substr(0, 2 - dayStr.length) + dayStr
}

const formatDateString = dateString =>{
  //dateString = dateString.replace(' ', 'T')
  var dateTime = new Date(dateString)
  var monthStr = dateTime.getMonth()<9 ? ('0' + (dateTime.getMonth() + 1).toString()):(dateTime.getMonth() + 1).toString()
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
  amount = Math.round(amount * 100)/100
  var amountStrArr = amount.toString().split('.')
  return '¥' + amountStrArr[0] + '.' + (amountStrArr.length == 2 ? (amountStrArr[1].length == 1 ? amountStrArr[1] + '0' : amountStrArr[1] ) : '00' )

}
const exists = n => {
  if (n != null && n != undefined){
    return true
  }
  else{
    return false
  }
}

const isBlank = str => {
  if (str == undefined || str == null || str == ''){
    return true
  }
  else{
    return false
  }
}

const getDisplayedCode = code =>{
  var displayedCode = ''
  for(var i = 0; i < code.length; i = i + 2){
    if (i == 0){
      displayedCode = code.substr(i, 2)
    }
    else{
      displayedCode = displayedCode + '-' + code.substr(i, 2)
    }
    
  }
  return displayedCode
}

const skiPassDescNanashanRent =  '<ul><li>出票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00前可使用</li><li>下午加夜场时间：限当日14:30后使用</li></ul>'

const skiPassDescNanashanRentAll =  '<ul><li>出票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00前可使用</li><li>下午加夜场时间：限当日14:30后使用</li><li>购买当日全天含装备 雪票则包含南山装备（一套雪服、头盔、雪镜、手套租费）</li></ul>'

const skiPassDescNanashanCommon = '<ul><li>票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间 18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00均前可使用</li><li>下午加夜场时间：限当日14:30后使用</li></ul>'


const performWebRequest = function (url, data){
  return new Promise(function (resolve, reject){
    var method = data == undefined? 'GET': 'POST'
    wx.request({
      url: url,
      data: data,
      method: method,
      success:(res)=>{
        console.log('web request', res)
        if (res.statusCode != 200){
          wx.showToast({
            title: res.statusCode.toString(),
            icon:'error'
          })
          return
        }
        if (res.data.code != 0){
          if (res.data.message != ''){
            wx.showToast({
              title: res.data.message,
              icon: 'none'
            })
          }
          reject(res.data.message)
        }
        else{
          resolve(res.data.data)
        }
      },
      fail:(res)=>{
        wx.showToast({
          title: '网络不通',
          icon:'error'
        })
        reject({})
      }
    })
  })
}
const createRentalDetail = function(rental, startDate, endDate){
  startDate = new Date(formatDate(startDate))
  endDate = new Date(formatDate(endDate))
  var presets = rental.pricePresets
  var details = []
  var totalAmount = 0
  var i = new Date(formatDate(startDate))
  for( ; i <= endDate; i.setDate(i.getDate() + 1)){
    var rentType = '日场'
    if (formatDate(new Date(startDate)) == formatDate(new Date(endDate)) 
      && formatDate(new Date(startDate)) == formatDate(new Date()) ){
      var currentDate = new Date()
      if (currentDate.getHours() >= 16){
        rentType = '夜场'
      }
      else if (currentDate.getHours() >= 13) {
        rentType = '下午场'
      }
    }
    var price = getRentPrice(rental.priceList, i, rentType)
    if (price != null){
      var discount = 0
      var rentDate = formatDate(i)
      for(var k = 0; presets && k < presets.length; k++){
        if (formatDate(new Date(presets[k].rent_date)) == rentDate){
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
  rental.pricePresets = details
  return details
}
const getRentPrice = function(priceList, date, rentType){
  //var currentDate = new Date()
  //var rentType = '日场'
  /*
  if (formatDate(date) == formatDate(currentDate)){
    var hour = currentDate.getHours()
    if (hour >= 13 && hour < 16){
      rentType = '下午场'
    }
    else if (hour >= 16){
      rentType = '夜场'
    }
  }
  */
  var weekend = isWeekend(date)
  var commonPrice = null
  for(var i = 0; i < priceList.length; i++){
    var price = priceList[i]
    if (price.rent_type == rentType 
      && ((weekend && price.day_type == '周末') || (!weekend && price.day_type == '平日') ) ){
      return price
    }
    if (price.rent_type == '日场'
    && ((weekend && price.day_type == '周末') || (!weekend && price.day_type == '平日') )){
      commonPrice = price
    }
  }
  return commonPrice
}
const checkRentalsWellForm = function(rentals){
  
  if (!rentals){
    return false
  }
  var well = true
  for(var i = 0; i < rentals.length; i++){
    var rental = rentals[i]
    if (!rental.totalAmount){
      well = false
      break
    }
    if (rental.noGuaranty != true && !rental.deposit){
      well = false
      break
    }
    if (rental.rentItems.length <= 0){
      well = false
      break
    }
    for(var j = 0; j < rental.rentItems.length ; j++){
      var item = rental.rentItems[j]
      if (!item.category){
        well = false
        break
      }
      if (item.noNeed != true){
        if (item.noCode == true){
          if (!item.name || item.name == ''){
            well = false
            break
          }
        }
        else{
          if (!item.code || item.code == '' || !item.name || item.name == ''){
            well = false
            break
          }
        }
      }
    }
  }
  return well
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
  checkRentalsWellForm
}
