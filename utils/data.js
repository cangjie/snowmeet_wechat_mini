const util = require('./util')
const app = getApp()
//获取租赁套餐列表
const getPackageListPromise = function() {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentPackageList'
  return new Promise(function(resolve, reject){
    util.performWebRequest(getUrl, null).then(function (packages) {
      resolve(packages)
    }).catch(function (exp){
      reject(exp)
    })
  })
}
//获取租赁套餐
const getPackagePromise = function(packageId){
  var getPackageUrl = app.globalData.requestPrefix + 'Rent/GetRentPackage/' + packageId.toString()
  return new Promise(function(resolve, reject){
    util.performWebRequest(getPackageUrl, null).then(function (result) {
      resolve(result)
    }).catch(function (exp){
      reject(exp)
    })
  })
}
module.exports = {
  getPackageListPromise: getPackageListPromise,
  getPackagePromise: getPackagePromise
}