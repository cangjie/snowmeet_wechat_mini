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

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
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

module.exports = {
  formatTime: formatTime,
  formatDate: formatDate,
  formatTimeStr: formatTimeStr,
  showAmount: showAmount,
  formatDateString: formatDateString,
  exists: exists
}
