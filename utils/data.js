const util = require('./util')
const app = getApp()
//获取租赁套餐列表
const getPackageListPromise = function () {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentPackageList'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (packages) {
      resolve(packages)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
//获取租赁套餐
const getPackagePromise = function (packageId) {
  var getPackageUrl = app.globalData.requestPrefix + 'Rent/GetRentPackage/' + packageId.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getPackageUrl, null).then(function (result) {
      resolve(result)
    }).catch(function (exp) {
      reject(exp)
    })
  })
  //查询租赁物

}
const searchBarCodePromise = function (code) {
  var searchUrl = app.globalData.requestPrefix + 'Rent/GetRentProductByBarcode/' + code
  return new Promise(function (resolve, reject) {
    util.performWebRequest(searchUrl, null).then(function (product) {
      resolve(product)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
//模糊查询租赁物
const searchBarCodeFuzzyPromise = function (code, categoryId) {
  var searchUrl = app.globalData.requestPrefix + 'Rent/GetRentProductByBarcodeFuzzy/' + code
  if (categoryId != null) {
    searchUrl += '?categoryId=' + categoryId.toString()
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(searchUrl, null).then(function (products) {
      resolve(products)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getAllRentCategoriesPromise = function(){
  var getUrl = app.globalData.requestPrefix + 'Rent/GetAllRentCategories'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getTopCategoriesPromise = function (){
  var getUrl = app.globalData.requestPrefix + 'Rent/GetTopRentCategories'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getSubCategoriesPromise = function (fatherId){
  var getUrl = app.globalData.requestPrefix + 'Rent/GetSubRentCategories/' + fatherId.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentCategoryPromise = function (categoryId){
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentCategory/' + categoryId.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const verifyMemberCellPromise = function(sessionKey, enc, iv){
  var veriUrl = app.globalData.requestPrefix + 'Member/VerifyCell?sessionKey=' + sessionKey + '&encData=' + encodeURIComponent(enc) + '&iv=' + encodeURIComponent(iv)
  return new Promise(function(resolve, reject){
    util.performWebRequest(veriUrl, null).then(function(result){
      resolve(result)
    }).catch(function(exp){
      reject(exp)
    })
  })
  
}

module.exports = {
  getPackageListPromise: getPackageListPromise,
  getPackagePromise: getPackagePromise,
  searchBarCodePromise: searchBarCodePromise,
  searchBarCodeFuzzyPromise: searchBarCodeFuzzyPromise,
  getAllRentCategoriesPromise: getAllRentCategoriesPromise,
  getTopCategoriesPromise: getTopCategoriesPromise,
  getSubCategoriesPromise: getSubCategoriesPromise,
  getRentCategoryPromise: getRentCategoryPromise,
  verifyMemberCellPromise
}