const formatTime = date => {

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
  
}

const formatTimeStr = date => {

  /*
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  */

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

const skiPassDescNanashanRent =  '<ul><li>出票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00前可使用</li><li>下午加夜场时间：限当日14:30后使用</li><li>购买当日全天含装备 雪票则包含南山装备（一套雪服、头盔、雪镜、手套租费）</li></ul>'

const skiPassDescNanashanCommon = '<ul><li>票前可申请免费退换</li><li>出票当日自动出票</li><li style="color:red" >出票后不支持退换！</li><li>日场营业时间 9:00-17:00</li><li>夜场营业时间 18:00-22:00(除夕、初一仅开放日场）</li><li>上午场时间：当日13:00均前可使用</li><li>下午加夜场时间：限当日14:30后使用</li></ul>'


module.exports = {
  formatTime: formatTime,
  formatDate: formatDate,
  formatTimeStr: formatTimeStr,
  showAmount: showAmount,
  formatDateString: formatDateString,
  exists: exists,
  skiPassDescNanashanRent: skiPassDescNanashanRent,
  skiPassDescNanashanCommon: skiPassDescNanashanCommon
}
