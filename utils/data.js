const util = require('./util.js')
const app = getApp()
//获取租赁套餐列表
const getPackageListPromise = function (shop) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentPackageList' + (shop ? ('?shop=' + encodeURIComponent(shop)) : '')
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
const searchBarCodeFuzzyPromise = function (key, categoryId) {
  var searchUrl = app.globalData.requestPrefix + 'Rent/GetRentProductFuzzy?key=' + key
  if (categoryId != null) {
    searchUrl += '&categoryId=' + categoryId.toString()
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(searchUrl, null).then(function (products) {
      resolve(products)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getAllRentCategoriesPromise = function () {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetAllCategories'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getTopCategoriesPromise = function () {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetTopRentCategories'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getSubCategoriesPromise = function (fatherId) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetSubRentCategories/' + fatherId.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentCategoryPromise = function (categoryId) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentCategory/' + categoryId.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (categories) {
      resolve(categories)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const verifyMemberCellPromise = function (sessionKey, enc, iv) {
  var veriUrl = app.globalData.requestPrefix + 'Member/VerifyCell?sessionKey=' + sessionKey + '&encData=' + encodeURIComponent(enc) + '&iv=' + encodeURIComponent(iv)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(veriUrl, null).then(function (result) {
      resolve(result)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getMemberPromise = function (memberId, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Member/GetMember/' + memberId.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (member) {
      resolve(member)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const placeBlankOrderPromise = function (isPackage, type, shop, memberId, cell, name, gender, sessionKey) {
  var placeUrl = app.globalData.requestPrefix + 'Order/PlaceBlankOrder/' + isPackage + '?type=' + encodeURIComponent(type) + '&shop=' + encodeURIComponent(shop)
    + memberId ? '&memberId=' + memberId.toString() : ''
      + cell ? '&cell=' + cell : ''
        + name ? '&name=' + encodeURIComponent(name) : ''
          + gender ? '&gender=' + encodeURIComponent(gender) : ''
          + '&sessonKey=' + sessionKey
  return new Promose(function (resolve, reject) {
    util.performWebRequest(placeUrl, null).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getEnumListPromise = function (type) {
  var getUrl = app.globalData.requestPrefix
  switch (type) {
    case 'RentType':
      getUrl += 'Rent/GetRentType'
      break
    case 'GetDayType':
      getUrl += 'Rent/GetDayType'
      break
    case 'RentSceneType':
      getUrl += 'Rent/GetSceneType'
      break
    default:
      break
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (list) {
      resolve(list)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentPriceListPromise = function (shopId, type, id, scene) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentPriceList/' + shopId + '?type=' + encodeURIComponent(type) + '&id=' + id.toString() + '&scene=' + encodeURIComponent(scene)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (list) {
      resolve(list)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateRentPricePromise = function (priceList, shopId, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentPrice/' + shopId.toString() + '?sessionKey=' + app.globalData.sessionKey
  return new Promise(function (resovle, reject) {
    util.performWebRequest(updateUrl, priceList).then(function (list) {
      resovle(list)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getShopByNamePromise = function (shopName) {
  var getUrl = app.globalData.requestPrefix + 'Shop/GetShopByName?shopName=' + encodeURIComponent(shopName)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (shop) {
      resolve(shop)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getMyTickets = function (used, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Ticket/GetMyTickets/' + used.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (tickets) {
      resolve(tickets)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getTicket = function (code) {
  var getUrl = app.globalData.requestPrefix + 'Ticket/GetTicket/' + code
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (ticket) {
      resolve(ticket)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateRentCategoryPromise = function (code, name, guaranty, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateCategory/' + code + '?name=' + encodeURIComponent(name) + '&guaranty=' + guaranty + '&scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, null).then(function (category) {
      resolve(category)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateRentPackagePromise = function (id, name, description, guaranty, sessionKey, shop) {
  var saveUrl = app.globalData.requestPrefix + 'Rent/UpdateRentPackageBaseInfo/'
    + id.toString() + '?name=' + encodeURIComponent(name)
    + '&description=' + encodeURIComponent(description)
    + '&deposit=' + encodeURIComponent(guaranty.toString())
    + '&sessionKey=' + encodeURIComponent(sessionKey)
    + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    + '&shop=' + encodeURIComponent(shop)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(saveUrl, null).then(function (rentPackage) {
      resolve(rentPackage)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const modRentPackageCategory = function (packageId, categoryId, action, sessionKey) {
  var setUrl = app.globalData.requestPrefix + 'Rent/RentPackageCategory'
    + action + '/' + packageId.toString() + '?categoryId=' + categoryId.toString()
    + '&sessionKey=' + sessionKey + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
  return new Promise(function (resolve, reject) {
    util.performWebRequest(setUrl, null).then(function (category) {
      resolve(category)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentCategoryProductsPromise = function (categoryId) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentProductByCategory/' + categoryId.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (products) {
      resolve(products)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const deleteRentPackagePromise = function (packageId, sessionKey) {
  var delUrl = app.globalData.requestPrefix + 'Rent/DeleteRentPackage/' + packageId.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(delUrl, null).then(function (rentPackage) {
      resolve(rentPackage)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentReceptingOrdersPromise = function (shop, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetReceptingOrders?shop=' + encodeURIComponent(shop) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (orders) {
      resolve(orders)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentReceptingOrderPromise = function (id, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetReceptingOrder/' + id.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRetailOrderByMi7CodePromise = function (code, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Retail/GetOrdersByMi7Code/' + code + '?sessionKey=' + encodeURIComponent(sessionKey)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (orders) {
      resolve(orders)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getOrdersByStaffPromise = function (orderId, shop, memberId, staffId, type, startDate, endDate, payOption, isTest, isEntertain, isPackage, isOnCredit, haveDiscount, status, sessionKey, cell, haveWarranty, retailType, keyword) {
  var qUrl = app.globalData.requestPrefix + 'Order/GetOrdersByStaff?sessionKey=' + sessionKey
  if (orderId != null) {
    qUrl += '&orderId=' + orderId
  }
  if (shop != null) {
    qUrl += '&shop=' + encodeURIComponent(shop)
  }
  if (memberId != null) {
    qUrl += '&memberId=' + memberId.toString()
  }
  if (staffId != null) {
    qUrl += '&staffId=' + staffId.toString()
  }
  if (type != null) {
    qUrl += '&type=' + encodeURIComponent(type)
  }
  if (startDate != null) {
    qUrl += '&startDate=' + encodeURIComponent(util.formatDate(new Date(startDate)))
  }
  if (endDate != null) {
    qUrl += '&endDate=' + encodeURIComponent(util.formatDate(new Date(endDate)))
  }
  if (payOption != null) {
    qUrl += '&payOption=' + payOption
  }
  if (isTest != null) {
    qUrl += '&isTest=' + isTest
  }
  if (isEntertain != null) {
    qUrl += '&isEntertain=' + isEntertain
  }
  if (isPackage != null) {
    qUrl += '&isPackage=' + isPackage
  }
  if (isOnCredit != null) {
    qUrl += '&isOnCredit=' + isOnCredit
  }
  if (haveDiscount != null) {
    qUrl += '&haveDiscount=' + haveDiscount
  }
  if (status != null) {
    qUrl += '&status=' + status
  }
  if (cell != null && cell != '') {
    qUrl += '&cell=' + cell
  }
  if (haveWarranty != null) {
    qUrl += '&haveWarranty=' + haveWarranty
  }
  if (retailType != null && retailType != undefined){
    qUrl += '&retailType=' + retailType
  }
  if (keyword != null && keyword != undefined){
    qUrl += '&keyword=' + keyword
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(qUrl, null).then(function (orders) {
      resolve(orders)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getOrderByStaffPromise = function (orderId, sessionKey) {
  var qUrl = app.globalData.requestPrefix + 'Order/GetOrderByStaff/' + orderId.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(qUrl, null).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const GetUnCommonPayMethodPromise = function () {
  var getPayMethodUrl = app.globalData.requestPrefix + 'Order/GetUnCommonPayMethod'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getPayMethodUrl, null).then(function (subPayMethods) {
      var inputedPayMethodList = subPayMethods
      var othersPayMethods = ['京东收银', 'POS机刷卡', '现金']
      for (var i = 0; i < inputedPayMethodList.length; i++) {
        othersPayMethods.push(inputedPayMethodList[i])
      }
      othersPayMethods.push('手工填写')
      resolve(othersPayMethods)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateOrderPromise = function (updatedOrder, scene, sessionKey) {
  return new Promise(function (resolve, reject) {
    var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
    util.performWebRequest(updateUrl, updatedOrder).then(function (order) {
      console.log('pay method changed', order)
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const cancelPayingPromise = function (orderId, sessionKey) {
  return new Promise(function (resolve, reject) {
    var cancelUrl = app.globalData.requestPrefix + 'Order/CancelPaying/' + orderId.toString() + '?sessionKey=' + sessionKey
    util.performWebRequest(cancelUrl, null).then(function (resovle) {
      if (resolve == null) {
        reject()
      }
      else {
        resolve(resolve)
      }
    }).catch(function (reject) {
      reject(reject)
    })
  })
}
const getOrderFromPaymentByCustomer = function (paymentId, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Order/GetOrderFromPaymentByCustomer/' + paymentId.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateOrderWithDetailPromise = function (order, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Order/UpdateOrderWithDetailByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, order).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getEquipBrandsPromise = function (type) {
  var getUrl = app.globalData.requestPrefix + 'Care/GetBrands?type=' + encodeURIComponent(type)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (brandList) {
      resolve(brandList)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const uploadFilePromise = function (mainId, filePath, purpose, type, sessionKey) {
  var uploadUrl = 'https://snowmeet.wanlonghuaxue.com/api/UploadFile/UploadFileWithThumb?sessionKey=' + sessionKey
  //+ '&purpose=' + encodeURIComponent(purpose) + '&fileType=' + encodeURIComponent(type)
  if (mainId) {
    uploadUrl += ('&mainId=' + mainId.toString())
  }
  else {
    if (purpose) {
      uploadUrl += '&purpose=' + encodeURIComponent(purpose)
    }
    if (type) {
      uploadUrl += '&fileType=' + encodeURIComponent(type)
    }
  }
  return new Promise(function (resolve, reject) {
    wx.uploadFile({
      filePath: filePath,
      name: 'file',
      url: uploadUrl,
      success: (res) => {
        console.log('upload success', res)
        resolve(JSON.parse(res.data))

      },
      fail: (res) => {
        console.log('upload failed', res)
        reject(JSON.parse(res))
      }
    })
  })
}
const getCareOthersServicePromise = function (type) {
  var getUrl = app.globalData.requestPrefix + 'Care/GetOthersService?type=' + encodeURIComponent(type)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (list) {
      resolve(list)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getCareProductPromise = function (shop, service, urgent) {
  var getUrl = app.globalData.requestPrefix + 'Care/GetProducts?shop=' + encodeURIComponent(shop)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (productList) {
      if (shop == '万龙服务中心') {
        for (var i = 0; i < productList.length; i++) {
          if (productList[i].name.indexOf('修刃打蜡') >= 0 && service == '双项') {
            if (productList[i].name.indexOf('次日') >= 0 && urgent != 1) {
              resolve(productList[i])
            }
            else if (urgent == 1 && productList[i].name.indexOf('立等') >= 0) {
              resolve(productList[i])
            }
          }
          if (service != '双项' && productList[i].name.indexOf(service) >= 0 && productList[i].name.indexOf('修刃打蜡') < 0) {
            if (productList[i].name.indexOf('次日') >= 0 && urgent != 1) {
              resolve(productList[i])
            }
            else if (urgent == 1 && productList[i].name.indexOf('立等') >= 0) {
              resolve(productList[i])
            }
          }
        }
        if (service != '双项' && productList[i].name.indexOf(service) >= 0 
          && productList[i].name.indexOf('修刃打蜡') < 0) {
          if (productList[i].name.indexOf('次日') >= 0 && urgent != 1) {
            resolve(productList[i])
          }
          else if (productList[i].name.indexOf(service) >= 0 && productList[i].name.indexOf('修刃打蜡') < 0) {
            resolve(productList[i])
          }
        }
      }
      else{
        for (var i = 0; i < productList.length; i++) {
          if (productList[i].name.indexOf('修刃打蜡') >= 0 && service == '双项') {
            resolve(productList[i])
          }
          if (service != '双项' && productList[i].name.indexOf(service) >= 0 && productList[i].name.indexOf('修刃打蜡') < 0) {
            resolve(productList[i])
          }
        }
        if (service != '双项' && productList[i].name.indexOf(service) >= 0 
          && productList[i].name.indexOf('修刃打蜡') < 0) {
          resolve(productList[i])
        }
      }
      resolve(null)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentalPromise = function (rentalId, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentalByStaff/' + rentalId + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (rental) {
      resolve(rental)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const setRentItemStatsPromise = function (rentItemId, status, sessionKey) {
  var setUrl = app.globalData.requestPrefix + 'Rent/SetRentItemStatus/' + rentItemId.toString() + '?status=' + encodeURIComponent(status) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(setUrl, null).then(function (rental) {
      resolve(rental)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateRentalDetailsPromise = function (details, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentalDetails?scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, details).then(function (rental) {
      resolve(rental)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const refundPromise = function (orderId, refunds, sessionKey) {
  var refundUrl = app.globalData.requestPrefix + 'Order/Refund/' + orderId.toString() + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(refundUrl, refunds).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateRentalPromise = function (rental, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentalByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, rental).then(function (newRental) {
      resolve(newRental)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentTypePromise = function () {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentType'
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (typeList) {
      resolve(typeList)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentPriceByIdPromise = function (id) {
  var getUrl = app.globalData.requestPrefix + 'Rent/GetRentPriceById/' + id.toString()
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (price) {
      resolve(price)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateCarePromise = function (care, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Care/UpdateCareByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, care).then(function (newCare) {
      resolve(newCare)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const updateCareTaskStatusPromise = function (taskId, status, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Care/SetTaskStatus/' + taskId.toString() + '?status=' + encodeURIComponent(status) + '&scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, null).then(function (newCare) {
      resolve(newCare)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getPrinterListPromise = function (shop) {
  var getDeviceNameUrl = 'https://' + app.globalData.domainName + '/api/Printer/GetPrinterByScene?shop=' + encodeURIComponent(shop) 
  return util.performWebRequest(getDeviceNameUrl, null)
  /*
  return new Promise(function (resolve, reject) {
    wx.request({
      url: getDeviceNameUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode == 200) {
          var deviceName = []
          for (var i = 0; i < res.data.length; i++) {
            deviceName.push(res.data[i].name)
          }
          resolve(deviceName)
        }
        else {
          reject()
        }
      }
    })
  })
  */
}
const getMyInfo = function (sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Member/GetMyInfo?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (info) {
      resolve(info)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const payWithDepositPromise = function (orderId, sessionKey) {
  var payUrl = app.globalData.requestPrefix + 'Order/PayWithDeposit/' + orderId + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(payUrl, null).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
  //util.performWebRequest(payUrl, null).then(function(order){

  //})
}
const getMemberTicketsPromise = function (memberId, bizType, canUse, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Ticket/GetMemberTicketsByStaff/' + memberId + '?sessionKey=' + sessionKey
  if (bizType != null) {
    getUrl += '&bizType=' + bizType
  }
  if (canUse != null) {
    getUrl += '&canUse=' + canUse
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (tickets) {
      resolve(tickets)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getUnreturnedRentItemPromise = function (shop, sessionKey){

  var getUrl = app.globalData.requestPrefix + 'Rent/GetUnReturnedRentItemsByStaff?sessionKey=' + sessionKey
  if (shop!=null){
    getUrl = app.globalData.requestPrefix + 'Rent/GetUnReturnedRentItemsByStaff?shop=' + encodeURIComponent(shop) + '&sessionKey=' + sessionKey
  }
  return new Promise(function (resolve, reject){
    util.performWebRequest(getUrl, null).then(function (rentItems){
      resolve(rentItems)
    }).catch(function (exp){
      reject(exp)
    })
  })
}
const queryRentItemChangeCompatibleCategory = function (categoryId){
  var getUrl = app.globalData.requestPrefix + 'Rent/QueryChangeCompatibleCategory/' + categoryId.toString()
  return util.performWebRequest(getUrl, null)
}
const getOrderBalancePromise = function (orderId, sessionKey){
  var bUrl = app.globalData.requestPrefix + 'Order/GetOrderBalance/' + orderId.toString() + '?sessionKey=' + sessionKey
  return util.performWebRequest(bUrl, null)
}
const updateRentPackageCategoryPromise = function(packageId, packageCategories, sessionKey){
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdatePackageRentItemCategories/' + packageId.toString() + '?sessionKey=' + sessionKey
  return util.performWebRequest(updateUrl, packageCategories)
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
  verifyMemberCellPromise,
  getMemberPromise,
  placeBlankOrderPromise,
  getEnumListPromise,
  getRentPriceListPromise,
  updateRentPricePromise,
  getShopByNamePromise,
  getMyTickets,
  getTicket,
  updateRentCategoryPromise,
  updateRentPackagePromise,
  modRentPackageCategory,
  getRentCategoryProductsPromise,
  deleteRentPackagePromise,
  getRentReceptingOrdersPromise,
  getRentReceptingOrderPromise,
  getRetailOrderByMi7CodePromise,
  getOrdersByStaffPromise,
  getOrderByStaffPromise,
  GetUnCommonPayMethodPromise,
  updateOrderPromise,
  cancelPayingPromise,
  getOrderFromPaymentByCustomer,
  updateOrderWithDetailPromise,
  getEquipBrandsPromise,
  uploadFilePromise,
  getCareOthersServicePromise,
  getCareProductPromise,
  getRentalPromise,
  setRentItemStatsPromise,
  updateRentalDetailsPromise,
  refundPromise,
  updateRentalPromise,
  getRentTypePromise,
  getRentPriceByIdPromise,
  updateCarePromise,
  updateCareTaskStatusPromise,
  getPrinterListPromise,
  getMyInfo,
  payWithDepositPromise,
  getMemberTicketsPromise,
  getUnreturnedRentItemPromise,
  queryRentItemChangeCompatibleCategory,
  getOrderBalancePromise,
  updateRentPackageCategoryPromise
}