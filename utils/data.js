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
const getPackageListByShopPromise = function (key){
  var getUrl = app.globalData.requestPrefix + 'Rent/GetShopRentPackages' + ((key != null)? '?key=' + key : '')
  return util.performWebRequest(getUrl)
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
const getMemberByNumPromise = function (cell, sessionKey, sessionType) {
  sessionKey = sessionKey || app.globalData.sessionKey || ''
  sessionType = sessionType || 'wechat_mini_openid'
  var getUrl = app.globalData.requestPrefix + 'Member/GetMemberByNum/' + encodeURIComponent(cell)
    + '?sessionKey=' + encodeURIComponent(sessionKey)
    + '&sessionType=' + encodeURIComponent(sessionType)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (member) {
      resolve(member)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 静默版按手机号查会员：匹配上 resolve(member)，查不到 / 无权限 / 网络错都 resolve(null) 且不弹 toast。
// 用于开单入口边输入手机号边匹配会员的场景——非会员是常态，不应每个号码都弹「会员不存在」打扰店员。
const getMemberByNumSilentPromise = function (cell, sessionKey, sessionType) {
  sessionKey = sessionKey || app.globalData.sessionKey || ''
  sessionType = sessionType || 'wechat_mini_openid'
  var getUrl = app.globalData.requestPrefix + 'Member/GetMemberByNum/' + encodeURIComponent(cell)
    + '?sessionKey=' + encodeURIComponent(sessionKey)
    + '&sessionType=' + encodeURIComponent(sessionType)
  return new Promise(function (resolve) {
    wx.request({
      url: getUrl,
      method: 'GET',
      success: function (res) {
        if (res && res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          resolve(null)
        }
      },
      fail: function () {
        resolve(null)
      }
    })
  })
}
// 支付二维码实时状态：供收银端轮询。命中 resolve({ stage, status, paid })，失败 resolve(null) 且不弹 toast（高频轮询不打扰）。
// stage：waiting(等待扫码) / scanned(顾客已扫码) / paying(顾客支付中) / paid(已支付) / cancelled(已取消)
const getPaymentLiveStatusPromise = function (paymentId, sessionKey, sessionType) {
  sessionKey = sessionKey || app.globalData.sessionKey || ''
  sessionType = sessionType || 'wechat_mini_openid'
  var getUrl = app.globalData.requestPrefix + 'Order/GetPaymentLiveStatus/' + encodeURIComponent(paymentId)
    + '?sessionKey=' + encodeURIComponent(sessionKey)
    + '&sessionType=' + encodeURIComponent(sessionType)
  return new Promise(function (resolve) {
    wx.request({
      url: getUrl,
      method: 'GET',
      success: function (res) {
        if (res && res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          resolve(null)
        }
      },
      fail: function () {
        resolve(null)
      }
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
  //var getUrl = app.globalData.requestPrefix + 'Rent/GetReceptingOrders?shop=' + encodeURIComponent(shop) + '&sessionKey=' + sessionKey
  var getUrl = app.globalData.requestPrefix + 'Rent/GetReceptingOrders?sessionKey=' + sessionKey + (shop == null ? '' : '&shop=' + encodeURIComponent(shop) )
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
const getOrdersByStaffPromise = function (orderId, shop, memberId, staffId, type, startDate, endDate, payOption, isTest, isEntertain, isPackage, isOnCredit, haveDiscount, status, sessionKey, cell, haveWarranty, retailType, keyword, isSummerCare, rentCategoryId, rentItemName, useCard, rentStatus) {
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
  if (rentStatus != null) {
    qUrl += '&rentStatus=' + rentStatus
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
  if (isSummerCare != null && isSummerCare != undefined){
    qUrl += '&isSummerCare=' + isSummerCare
  }
  if (rentCategoryId != null){
    qUrl += '&rentCategoryId=' + rentCategoryId
  }
  if (rentItemName != null){
    qUrl += '&rentItemName=' + rentItemName
  }
  if (useCard != null){
    qUrl += '&useCard=' + useCard
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(qUrl, null).then(function (orders) {
      resolve(orders)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
const getRentOrdersByStaffPagedPromise = function (orderId, shop, memberId, staffId, type, startDate, endDate, payOption, isTest, isEntertain, isPackage, isOnCredit, haveDiscount, status, sessionKey, cell, haveWarranty, retailType, keyword, isSummerCare, rentCategoryId, rentItemName, useCard, rentStatus, hasRetail, pageIndex, pageSize) {
  var qUrl = app.globalData.requestPrefix + 'Order/GetOrdersByStaffPaged?sessionKey=' + sessionKey
  if (orderId != null) { qUrl += '&orderId=' + orderId }
  if (shop != null) { qUrl += '&shop=' + encodeURIComponent(shop) }
  if (memberId != null) { qUrl += '&memberId=' + memberId.toString() }
  if (staffId != null) { qUrl += '&staffId=' + staffId.toString() }
  if (type != null) { qUrl += '&type=' + encodeURIComponent(type) }
  if (startDate != null) { qUrl += '&startDate=' + encodeURIComponent(util.formatDate(new Date(startDate))) }
  if (endDate != null) { qUrl += '&endDate=' + encodeURIComponent(util.formatDate(new Date(endDate))) }
  if (payOption != null) { qUrl += '&payOption=' + payOption }
  if (isTest != null) { qUrl += '&isTest=' + isTest }
  if (isEntertain != null) { qUrl += '&isEntertain=' + isEntertain }
  if (isPackage != null) { qUrl += '&isPackage=' + isPackage }
  if (isOnCredit != null) { qUrl += '&isOnCredit=' + isOnCredit }
  if (haveDiscount != null) { qUrl += '&haveDiscount=' + haveDiscount }
  if (rentStatus != null) { qUrl += '&rentStatus=' + rentStatus }
  if (cell != null && cell != '') { qUrl += '&cell=' + cell }
  if (haveWarranty != null) { qUrl += '&haveWarranty=' + haveWarranty }
  if (retailType != null && retailType != undefined) { qUrl += '&retailType=' + retailType }
  if (keyword != null && keyword != undefined) { qUrl += '&keyword=' + keyword }
  if (isSummerCare != null && isSummerCare != undefined) { qUrl += '&isSummerCare=' + isSummerCare }
  if (rentCategoryId != null) { qUrl += '&rentCategoryId=' + rentCategoryId }
  if (rentItemName != null) { qUrl += '&rentItemName=' + rentItemName }
  if (useCard != null) { qUrl += '&useCard=' + useCard }
  if (hasRetail != null) { qUrl += '&hasRetail=' + hasRetail }
  qUrl += '&pageIndex=' + (pageIndex || 1)
  qUrl += '&pageSize=' + (pageSize || 10)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(qUrl, null).then(function (result) {
      resolve(result)
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
// 支付前身份验证 — 只读，返回 CheckPayerIdentityResult
const checkPayerIdentityPromise = function (paymentId, payerType, scannerId, sessionKey) {
  var url = app.globalData.requestPrefix + 'PaymentIdentity/CheckPayerIdentity'
    + '?paymentId=' + paymentId
    + '&payerType=' + encodeURIComponent(payerType || 'wechat')
    + '&scannerId=' + encodeURIComponent(scannerId || '')
    + '&sessionKey=' + encodeURIComponent(sessionKey || '')
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, undefined).then(function (result) {
      resolve(result)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 微信身份核验（纯核验，不涉及支付）：顾客扫码进小程序登录后调用，扫码人==订单会员则后端置 wechat_unverified=1
const verifyWechatIdentityPromise = function (orderId, sessionKey) {
  var url = app.globalData.requestPrefix + 'PaymentIdentity/VerifyWechatIdentity'
    + '?orderId=' + orderId
    + '&sessionKey=' + encodeURIComponent(sessionKey || '')
  return util.performWebRequest(url, undefined)
}
// 店员端轮询：该订单是否已通过微信身份核验（返回 { verified: bool }）
const getWechatVerifyStatusPromise = function (orderId, sessionKey) {
  var url = app.globalData.requestPrefix + 'PaymentIdentity/GetWechatVerifyStatus'
    + '?orderId=' + orderId
    + '&sessionKey=' + encodeURIComponent(sessionKey || '')
  return util.performWebRequest(url, undefined)
}
// 支付前身份验证 — 写入 OrderPayment / Order，返回更新后 CheckPayerIdentityResult
// body: { paymentId, payerType, scannerId, action, choice?, encData?, iv?, phoneMock? }
const confirmPayIdentityPromise = function (body, sessionKey) {
  var url = app.globalData.requestPrefix + 'PaymentIdentity/ConfirmPayIdentity'
    + '?sessionKey=' + encodeURIComponent(sessionKey || '')
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (result) {
      resolve(result)
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
  // 2026-07-09 改回 snowmeet.wanlonghuaxue.com（7-8 曾暂切 mini.snowmeet.top 排查鉴权 400）
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
        // wx.uploadFile 对任何 HTTP 状态码都走 success：非 2xx（如鉴权失败 400）必须 reject，
        // 否则 ProblemDetails 错误体被当成 UploadFile resolve，下游拿 undefined 的 id 继续"假成功"
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.warn('upload failed http ' + res.statusCode, res.data)
          reject(res)
          return
        }
        console.log('upload success', res)
        try {
          resolve(JSON.parse(res.data))
        } catch (e) {
          reject(e)
        }
      },
      fail: (res) => {
        console.warn('upload failed', res)
        reject(res)
      }
    })
  })
}
// 会员养护过的装备列表（按装备类型，brand+scale 去重、按最近养护时间倒序）
const getMemberCaredEquipmentsPromise = function (memberId, equipment, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Care/GetMemberCaredEquipments?memberId=' + memberId
    + '&equipment=' + encodeURIComponent(equipment) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, undefined).then(function (list) {
      resolve(list)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 会员 + 该装备类型的最近一次安全检查数值（身高/体重/脱落值/角度），供新单默认预填；无历史返回 null
const getMemberLatestSafeCheckPromise = function (memberId, equipment, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'Care/GetMemberLatestSafeCheck?memberId=' + memberId
    + '&equipment=' + encodeURIComponent(equipment) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, undefined).then(function (hist) {
      resolve(hist)
    }).catch(function (exp) {
      reject(exp)
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
// 按天一次性修改：当天租金 + 减免 + 超时费（按天 upsert）；waived=true 免除当天全部费用
const updateRentalDayChargesPromise = function (rentalId, rentDetailId, rent, overtime, discount, scene, sessionKey, waived) {
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentalDayChargesByStaff/' + rentalId
    + '?rentDetailId=' + rentDetailId + '&rent=' + rent + '&overtime=' + overtime + '&discount=' + discount
    + '&waived=' + (waived ? 'true' : 'false')
    + '&scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, {}).then(function (rental) {
      resolve(rental)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 设/撤某 rental 的「招待」（招待免该项租金，按现有招待计费规则计费）
const setRentalEntertainPromise = function (rentalId, entertain, scene, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/SetRentalEntertainByStaff/' + rentalId
    + '?entertain=' + (entertain ? 'true' : 'false')
    + '&scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, {}).then(function (rental) {
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
const updateRentItemPromise = function(rentItem, scene, sessionKey){
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentItemByStaff?scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return util.performWebRequest(updateUrl, rentItem)
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
const updateRentalGuarantyPromise = function (rentalId, amount, scene, sessionKey) {
  var updateUrl = app.globalData.requestPrefix + 'Rent/UpdateRentalGuarantyByStaff/' + rentalId
    + '?amount=' + amount + '&scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, {}).then(function (newRental) {
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
const updateCareTaskStatusPromise = function (taskId, status, scene, sessionKey, dealMethod, storeMemo, taskMemo, isCancel, cancelReason) {
  var updateUrl = app.globalData.requestPrefix + 'Care/SetTaskStatus/' + taskId.toString() + '?status=' + encodeURIComponent(status) + '&scene=' + encodeURIComponent(scene) + '&sessionKey=' + sessionKey
  if (dealMethod){
    updateUrl += '&dealMethod=' + encodeURIComponent(dealMethod)
  }
  if (storeMemo!=null && storeMemo!=undefined){
    updateUrl += '&storeMemo=' + encodeURIComponent(storeMemo)
  }
  // taskMemo 显式传入（哪怕空串）时才带上，让后端把它写进 CareTask.memo（覆盖默认的场景字符串行为）；
  // 未传（undefined）的调用方保持旧行为不变
  if (taskMemo!=null && taskMemo!=undefined){
    updateUrl += '&taskMemo=' + encodeURIComponent(taskMemo)
  }
  // 取消发板：isCancel=true 时后端跳过完成赠券、改置 Care.is_cancel/cancel_reason
  if (isCancel){
    updateUrl += '&isCancel=true'
    if (cancelReason!=null && cancelReason!=undefined){
      updateUrl += '&cancelReason=' + encodeURIComponent(cancelReason)
    }
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(updateUrl, null).then(function (newCare) {
      resolve(newCare)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
/* ---------- 养护详情页：发板核销 / 品牌 / 扫码取板（2026-07-12 从旧页内联接口收口） ---------- */
// 发送取板码（公众号模板消息发给会员）
const createCareVerifyCodePromise = function (careId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Care/CreateVerifyCode/' + careId.toString()
    + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}
// 验证取板码并完成发板（60 分钟内有效）；isCancel=true 时按取消处理（跳过完成赠券、记 Care.cancel_reason）
const veriCareFinishCodePromise = function (careId, code, sessionKey, isCancel, cancelReason) {
  var url = app.globalData.requestPrefix + 'Care/VeriCareFinishCode/' + careId.toString()
    + '?code=' + encodeURIComponent(code) + '&sessionKey=' + sessionKey
  if (isCancel){
    url += '&isCancel=true'
    if (cancelReason!=null && cancelReason!=undefined){
      url += '&cancelReason=' + encodeURIComponent(cancelReason)
    }
  }
  return util.performWebRequest(url, undefined)
}
// 绑定取板凭证照片
const setCarePickImagePromise = function (careId, imageId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Care/SetPickImageId/' + careId.toString()
    + '?imageId=' + imageId.toString() + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}
// 新增装备品牌（返回该类型品牌全列表）
const updateCareBrandPromise = function (type, brandName, chineseName, sessionKey) {
  var url = app.globalData.requestPrefix + 'Care/UpdateBrandByStaff?type=' + encodeURIComponent(type)
    + '&brandName=' + encodeURIComponent(brandName)
    + '&chineseName=' + encodeURIComponent(chineseName || '')
    + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}
// 店员生成扫码二维码（顾客扫码核销身份用）
const createScanQrCodeByStaffPromise = function (code, scene, purpose, sessionKey) {
  var url = app.globalData.requestPrefix + 'QrCode/CreateNewScanQrCodeByStaff?code=' + encodeURIComponent(code)
    + '&scene=' + encodeURIComponent(scene) + '&purpose=' + encodeURIComponent(purpose)
    + '&sessionKey=' + encodeURIComponent(sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
  return util.performWebRequest(url, undefined)
}
// 停止扫码轮询（离开/切换核销方式时释放二维码）
const stopScanQrCodePromise = function (qrCodeId, sessionKey) {
  var url = app.globalData.requestPrefix + 'QrCode/StopQeryScan/' + qrCodeId.toString()
    + '?sessionKey=' + sessionKey + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
  return util.performWebRequest(url, undefined)
}
// wxoa 公众号二维码图（返回纯字符串 URL，不走 ApiResult 解包，故不用 performWebRequest）
const getOAQrCodeUrlPromise = function (content) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + content,
      method: 'GET',
      success: (res) => { resolve(res.data) },
      fail: (res) => { reject(res) }
    })
  })
}
// 食材过期提醒·标签打印：全表打印机（不按店过滤，BLE 扫描的物理距离已经是唯一有效的筛选边界）
const getAllPrintersPromise = function () {
  var getUrl = 'https://' + app.globalData.domainName + '/api/Printer/GetAllPrinters'
  return util.performWebRequest(getUrl, null)
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
// 养护核销：微信核验会员本人（wechat_unverified==1）后，核销储值/卡券并使订单生效（EffectCareOrder）
const writeoffCareOrderPromise = function (orderId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Order/WriteoffCareOrder/' + orderId + '?sessionKey=' + encodeURIComponent(sessionKey || '')
  return util.performWebRequest(url, null)
}
// 次卡消费：查询会员租赁次卡 + 本订单含雪板雪鞋租赁商品本次需扣次数
const getRentalPunchCardInfoPromise = function (orderId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/GetRentalPunchCardInfo/' + orderId + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (info) {
      resolve(info)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 次卡核销：用指定卡抵 punch_count 次（body = { card_id, punch_count }）
const useRentalPunchCardPromise = function (orderId, body, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/UseRentalPunchCard/' + orderId + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (order) {
      resolve(order)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 购买次卡：商品目录（会话级，退押金卖卡弹窗 + 顾客自助购买页共用）。bizType 不传时后端默认"租赁"、
// cardType 不传时默认"次卡"，现有调用方（退押金卖卡弹窗）行为不变；顾客自助首页显式传"租赁"/"养护"
// 且 cardType 传空串，拿该业务下 次卡+季卡 的合并列表。
// 返回字段含 name/sale_price/punch_total/shop/bizType/cardType/isSeason/content(富文本)/intro(纯文本摘要)/imageUrl，
// 商品文案和图片一律以这里下发的为准，前端不得再自行拼简介。
const getPunchCardProductsPromise = function (shop, sessionKey, bizType, cardType) {
  var url = app.globalData.requestPrefix + 'Rent/GetPunchCardProducts?sessionKey=' + sessionKey
  if (shop != null) { url += '&shop=' + encodeURIComponent(shop) }
  if (bizType != null) { url += '&bizType=' + encodeURIComponent(bizType) }
  if (cardType != null) { url += '&cardType=' + encodeURIComponent(cardType) }
  return util.performWebRequest(url, null)
}
// 购买次卡：单个商品详情（顾客端详情页用）。只按 id 查，后端自己反查 biz_type/card_type，
// 不需要调用方知道这是租赁卡还是养护卡——分享/扫码直接进详情页也能拿到。
const getPunchCardProductPromise = function (productId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/GetPunchCardProduct/' + productId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 次卡/季卡商品管理（店长/管理员）：不过滤 valid/on_shelves 的全量列表。
// bizType/cardType 都不传时返回 养护/租赁 × 次卡/季卡 4 种组合的合并列表（每行带 bizType/cardType）。
const getAllPunchCardProductsPromise = function (sessionKey, bizType, cardType) {
  var url = app.globalData.requestPrefix + 'Rent/GetAllPunchCardProducts?sessionKey=' + sessionKey
  if (bizType != null) { url += '&bizType=' + encodeURIComponent(bizType) }
  if (cardType != null) { url += '&cardType=' + encodeURIComponent(cardType) }
  return util.performWebRequest(url, null)
}
// 次卡/季卡商品管理页新建时用来回填 category_code（该分类当前稳定的 code 值，找不到会自动创建）
const getPunchCardCategoryCodePromise = function (sessionKey, bizType, cardType) {
  var url = app.globalData.requestPrefix + 'Rent/GetPunchCardCategoryCode?sessionKey=' + sessionKey
  if (bizType != null) { url += '&bizType=' + encodeURIComponent(bizType) }
  if (cardType != null) { url += '&cardType=' + encodeURIComponent(cardType) }
  return util.performWebRequest(url, null)
}
// 次卡/季卡商品管理：新增/编辑，复用通用商品目录的 Category/AddProduct、Category/ModProduct
const addPunchCardProductPromise = function (product, sessionKey) {
  var url = app.globalData.requestPrefix + 'Category/AddProduct?sessionKey=' + sessionKey
  return util.performWebRequest(url, product)
}
const modPunchCardProductPromise = function (product, sessionKey) {
  var url = app.globalData.requestPrefix + 'Category/ModProduct?sessionKey=' + sessionKey
  return util.performWebRequest(url, product)
}
// 门店列表（shop_list 全量）。次卡商品维护页的「限定门店」选择器用；
// 商品的 shop 字段必须与 shop_list.name 一字不差，顾客端门店过滤是精确匹配，所以只能选不能手输
const getShopListPromise = function () {
  var url = app.globalData.requestPrefix + 'Order/GetShops'
  return util.performWebRequest(url, null)
}
// 次卡/季卡商品管理：删除（软删除 valid=0）。已发出的卡不受影响，商品从目录/发卡预设/管理列表消失
const deletePunchCardProductPromise = function (productId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/DeletePunchCardProduct/' + productId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 商品详情（通用商品目录，含 images/properties/category），次卡/季卡商品维护详情页编辑态用来回填
const getProductPromise = function (id, sessionKey) {
  var url = app.globalData.requestPrefix + 'Category/GetProduct/' + id + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 购买次卡：我的次卡列表（顾客自助会话，member_id 由服务端从 sessionKey 解析）
const getMyPunchCardsPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/GetMyPunchCards?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 顾客自助购买次卡·前置校验：本人有没有验证过手机号。
// 必须在点购买之前问，因为 getPhoneNumber 只能由 button 直接触发，不能等下单报错再补
const checkMyPunchCardPurchasePromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/CheckMyPunchCardPurchase?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 微信授权手机号后落库（沿用雪票预定页那条现成链路，走 /core 旧路由）
const bindWechatCellPromise = function (encData, iv, sessionKey) {
  var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateWechatMemberCell?sessionKey='
    + encodeURIComponent(sessionKey) + '&encData=' + encodeURIComponent(encData) + '&iv=' + encodeURIComponent(iv)
  // 该接口直接返回 Member 对象（不是 ApiResult 信封），所以不能用 performWebRequest
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url, method: 'GET',
      success: function (res) {
        if (res.statusCode != 200 || !res.data) { reject(res.statusCode); return }
        resolve(res.data)
      },
      fail: function (err) { reject(err) }
    })
  })
}
// 顾客自助购买次卡·下单。不能用 Order/PlaceOrder——它是 if/else 分流的，
// 下单人本身是店员时只写 staff_id、member_id 留空，订单就没有归属会员，
// 后续"这单是不是我的"全判不了（表现为确认页「订单不存在」）。
const placeMyPunchCardOrderPromise = function (productId, quantity, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/PlaceMyPunchCardOrder/' + productId
    + '?quantity=' + quantity + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 顾客自助购买次卡·确认页数据（商品/数量/金额/使用规则，服务端现算金额并校验订单归属本人）
const getMyPunchCardOrderPromise = function (orderId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/GetMyPunchCardOrder/' + orderId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 顾客自助购买次卡·发起微信支付：建待支付单返回 paymentId，
// 接着调 Order/WechatPayByOrderPayment 换预支付参数再 wx.requestPayment。
// 不能用店员的 Order/GetWepayPayment（内部取 staff.id，顾客会话会 NRE）
const startMyPunchCardPaymentPromise = function (orderId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/StartMyPunchCardPayment/' + orderId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 次卡使用明细（店员侧，会员详情页用）：按 staff 权限放行，不校验"卡是我的"，且不下发退款判定。
// 展示口径与顾客侧同源（服务端 BuildPunchCardUsageView）
const getPunchCardUsagesByStaffPromise = function (cardId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/GetPunchCardUsagesByStaff?cardId=' + cardId + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 我的次卡·使用明细：某张卡被哪些订单核销过、每单核销几次（服务端按 order_id 汇总并校验卡归属本人）。
// 同时返回 refund 判定（能不能自助退款、退多少、不能退的原因），前端不自己拼这套规则。
const getMyPunchCardUsagesPromise = function (cardId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/GetMyPunchCardUsages?cardId=' + cardId + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 我的次卡·自助退款：一次未核销过的卡原路退回微信/支付宝，成功后服务端置 punch_card.is_refund=1。
// 金额和可退性全部由服务端判定（与 GetMyPunchCardUsages 返回的 refund 同一份口径），前端只管发起。
// 传 {} 是为了走 POST（这个接口不读 body，退款这种有副作用的动作不该用 GET）
const refundMyPunchCardPromise = function (cardId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/RefundMyPunchCard/' + cardId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, {})
}
// 购买次卡·试算（只读，不写库）
const preparePunchCardSalePromise = function (orderId, productId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/PreparePunchCardSale/' + orderId + '?productId=' + productId + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, null)
}
// 购买次卡·发起扫码补差价：创建 pending(valid=0) 零售行，返回 { retailId, priceDiff }
const startPunchCardSaleQrPromise = function (orderId, productId, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/StartPunchCardSaleQr/' + orderId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, { productId: productId })
}
// 购买次卡·确认落地：settlement = { method: 'refund'|'cash'|'deposit'|'qr', retailId?, qrPaymentId?, payMethodLabel? }
const finalizePunchCardSalePromise = function (orderId, productId, settlement, sessionKey) {
  var url = app.globalData.requestPrefix + 'Rent/FinalizePunchCardSale/' + orderId + '?sessionKey=' + sessionKey
  return util.performWebRequest(url, { productId: productId, settlement: settlement })
}
// ───── 会员管理（MemberAdmin，店长/管理员 title_level≥200） ─────
// 列表搜索（分页）。filter = {name, cell, gender, bizTypes(逗号拼), tags(逗号拼)}
const searchMembersByStaffPromise = function (filter, pageIndex, pageSize, sessionKey) {
  var f = filter || {}
  var url = app.globalData.requestPrefix + 'MemberAdmin/SearchMembersByStaff?sessionKey=' + sessionKey
    + '&pageIndex=' + (pageIndex || 1) + '&pageSize=' + (pageSize || 20)
  if (f.name) { url += '&name=' + encodeURIComponent(f.name) }
  if (f.cell) { url += '&cell=' + encodeURIComponent(f.cell) }
  if (f.gender) { url += '&gender=' + encodeURIComponent(f.gender) }
  if (f.bizTypes) { url += '&bizTypes=' + encodeURIComponent(f.bizTypes) }
  if (f.tags) { url += '&tags=' + encodeURIComponent(f.tags) }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 标签库（预设标签字典，从 DB 读）
const getTagLibraryPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetTagLibrary?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 标签库维护：库标签 + 用量
const getTagLibraryStatsPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetTagLibraryWithStats?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const mergeTagPresetPromise = function (from, to, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/MergeTagPreset?sessionKey=' + sessionKey
    + '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const deleteTagPresetPromise = function (tag, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/DeleteTagPreset?sessionKey=' + sessionKey
    + '&tag=' + encodeURIComponent(tag)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const addTagPresetPromise = function (tag, groupName, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/AddTagPreset?sessionKey=' + sessionKey
    + '&tag=' + encodeURIComponent(tag)
  if (groupName) { url += '&groupName=' + encodeURIComponent(groupName) }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 修改会员资料（姓名/性别/手机号）。body = { memberId, realName, gender, cell }
const updateMemberProfilePromise = function (body, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/UpdateMemberProfile?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const getMemberDetailByStaffPromise = function (memberId, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetMemberDetailByStaff/' + memberId + '?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const addMemberTagPromise = function (memberId, tag, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/AddMemberTag?sessionKey=' + sessionKey
    + '&memberId=' + memberId + '&tag=' + encodeURIComponent(tag)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const removeMemberTagPromise = function (memberId, tag, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/RemoveMemberTag?sessionKey=' + sessionKey
    + '&memberId=' + memberId + '&tag=' + encodeURIComponent(tag)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 手机号注册会员。body = { cell, realName, gender }；返回 { exists, id, name, ... }
const registerMemberByPhonePromise = function (body, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/RegisterMemberByPhone?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 充值储值。body = { memberId, depositType('C'), amount }
const chargeMemberDepositPromise = function (body, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/ChargeMemberDeposit?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 发次卡。body = { memberId, bizType, cardName, total }
const grantPunchCardPromise = function (body, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GrantPunchCard?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const getPunchCardPresetsPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetPunchCardPresets?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 发券。body = { memberId, templateId, count }
const grantCouponPromise = function (body, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GrantCoupon?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, body).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
const getCouponTemplatesPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetCouponTemplates?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 储值账户管理列表：按手机号搜会员分组返回名下储值账户 { items, total }
const searchDepositAccountsByStaffPromise = function (cell, pageIndex, pageSize, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/SearchDepositAccountsByStaff?sessionKey=' + sessionKey
    + '&pageIndex=' + pageIndex + '&pageSize=' + pageSize
  if (cell) url += '&cell=' + cell
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 储值账户详情：{ account, balances }（充值行带 bizType/bizId/memo，消费行带 orderCode）
const getDepositAccountDetailByStaffPromise = function (accountId, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetDepositAccountDetailByStaff?sessionKey=' + sessionKey
    + '&accountId=' + accountId
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 会员资产速览（开单页会员条）：{ depositTotal, points, punchRemaining }，店员级 100 可读
const getMemberAssetsByStaffPromise = function (memberId, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/GetMemberAssetsByStaff?sessionKey=' + sessionKey
    + '&memberId=' + memberId
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
}
// 会员合并：source 的订单/储值/龙珠/次卡/优惠券 全部迁到 target，source 失效（is_merge=1）
const mergeMemberByStaffPromise = function (sourceMemberId, targetMemberId, sessionKey) {
  var url = app.globalData.requestPrefix + 'MemberAdmin/MergeMemberByStaff?sessionKey=' + sessionKey
    + '&sourceMemberId=' + sourceMemberId + '&targetMemberId=' + targetMemberId
  return new Promise(function (resolve, reject) {
    util.performWebRequest(url, null).then(function (r) { resolve(r) }).catch(function (e) { reject(e) })
  })
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
// 养护服务费服务端计算（真理之源，与 PlaceCareOrder 同一套定价）。
// req 为当前界面全量状态：{ shop, memberId, deriveServices, changedField, care }
// （care 含装备信息/服务项/券码/use_card/card_id/card_name/附加费/减免——
//   卡选择跟着单件装备走、只在 care 内；每次界面操作都整包提交；
//   changedField=本次改动字段名，服务联动（如开热蜡带刮蜡）由服务端按它判定）
// 返回 { commonCharge, ticketDiscount, care }：care 是联动/推导后的完整对象，前端以它回填
const calcCareChargePromise = function (req, sessionKey) {
  var postUrl = app.globalData.requestPrefix + 'Care/CalcCareCharge?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    util.performWebRequest(postUrl, req).then(function (res) {
      resolve(res)
    }).catch(function (exp) {
      reject(exp)
    })
  })
}
// 会员名下各类卡（次卡/季卡），staff≥100；bizType（养护/租赁）按业务线过滤，不传返回全部
const getMemberCardsPromise = function (memberId, bizType, sessionKey) {
  var getUrl = app.globalData.requestPrefix + 'MemberAdmin/GetMemberCardsByStaff?memberId=' + memberId + '&sessionKey=' + sessionKey
  if (bizType != null) {
    getUrl += '&bizType=' + bizType
  }
  return new Promise(function (resolve, reject) {
    util.performWebRequest(getUrl, null).then(function (cards) {
      resolve(cards)
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
// 养护已生效订单中所有"未发板"的装备（顾客送来养护、还没取走），一件装备一条，服务端内存分页
const getUnpickedCareItemsByStaffPromise = function (shop, equipment, brand, cell, isTest, isSummerCare, sortOrder, sessionKey, pageIndex, pageSize) {
  var qUrl = app.globalData.requestPrefix + 'Care/GetUnpickedCareItemsByStaff?sessionKey=' + sessionKey
  if (shop != null) { qUrl += '&shop=' + encodeURIComponent(shop) }
  if (equipment != null) { qUrl += '&equipment=' + encodeURIComponent(equipment) }
  if (brand != null && brand != '') { qUrl += '&brand=' + encodeURIComponent(brand) }
  if (cell != null && cell != '') { qUrl += '&cell=' + cell }
  if (isTest != null) { qUrl += '&isTest=' + isTest }
  if (isSummerCare != null) { qUrl += '&isSummerCare=' + isSummerCare }
  if (sortOrder != null) { qUrl += '&sortOrder=' + encodeURIComponent(sortOrder) }
  qUrl += '&pageIndex=' + (pageIndex || 1) + '&pageSize=' + (pageSize || 10)
  return new Promise(function (resolve, reject) {
    util.performWebRequest(qUrl, null).then(function (result) {
      resolve(result)
    }).catch(function (exp) {
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
const getUnipayOrderPromise = function(startDate, endDate, sessionKey){
  return new Promise(function (resolve, reject){
    var totalOrders = []
    getOrdersByStaffPromise(null, null, null, null, '聚合', startDate, endDate, null, null, null, null, null, null, '支付成功', sessionKey, null, null, null, null).then(function (commonOrders){
      for(var i = 0; i < commonOrders.length; i++){
        totalOrders.push(commonOrders[i])
      }
      getOrdersByStaffPromise(null, null, null, null, '聚合', startDate, endDate, null, null, null, null, null, null, '部分退款', sessionKey, null, null, null, null).then(function (refundOrders){
        for(var i = 0; i < refundOrders.length; i++){
          totalOrders.push(refundOrders[i])
        }
        getOrdersByStaffPromise(null, null, null, null, '聚合', startDate, endDate, null, null, null, null, null, null, '全额退款', sessionKey, null, null, null, null).then(function (totalRefundOrders){
          for(var i = 0; i < totalRefundOrders.length; i++){
          totalOrders.push(totalRefundOrders[i])
          }
          totalOrders.sort((a, b)=>b.id - a.id)
          resolve(totalOrders)
        })
      })
    })
  })
  //return getOrdersByStaffPromise(null, null, null, null, '聚合', startDate, endDate, null, null, null, null, null, null, '支付成功', sessionKey, null, null, null, null)
}
// ====== 食材过期提醒（mat_expire，FnbMaterialController）======
// 鉴权：小程序自身 sessionKey（后端 _requireStaff 已支持 wechat_mini_openid 会话回退）

// GET GetBatches — 全量有效批次 + 服务器今日日期字符串（状态派生必须用这个 today，不能用设备本地日期）
const getMatExpireBatchesPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/GetBatches?sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}

// POST SaveBatch — 新增(batch.id===0)/编辑(batch.id>0)。字段名须与后端属性名一致（下划线，非驼峰）：
// name/batch_no/produce_date/shelf_life_value/shelf_life_unit/expire_date/warn_days/image_ids
const saveMatExpireBatchPromise = function (batch, sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/SaveBatch?sessionKey=' + sessionKey
  return util.performWebRequest(url, batch)
}

// GET DisposeBatch — action='用完'|'报废'，幂等（已处置直接返回当前行）
const disposeMatExpireBatchPromise = function (id, action, sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/DisposeBatch?id=' + id
    + '&action=' + encodeURIComponent(action) + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}

// GET DeleteBatch — 软删（valid=false），无恢复入口，调用前必须先二次确认
const deleteMatExpireBatchPromise = function (id, sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/DeleteBatch?id=' + id + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}

// GET GenBatchNo — 生成参考批次号 B{yyMMdd}-{当日已发数+1}，仅参考不保证并发唯一
const genMatExpireBatchNoPromise = function (sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/GenBatchNo?sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}

// GET GetImages — 按逗号分隔的 upload_file.id 列表批量取图片路径，编辑页回显 image_ids 用
const getMatExpireImagesPromise = function (ids, sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/GetImages?ids=' + encodeURIComponent(ids)
    + '&sessionKey=' + sessionKey
  return util.performWebRequest(url, undefined)
}

// POST OcrScanName — imageBase64 为 JPEG base64（不带 data: 前缀；wx.getFileSystemManager()
// .readFileSync(path,'base64') 的返回值本身不带前缀，直接传即可）。一次响应覆盖四种扫描用途：
// { candidates:[{text,height}], dates:[...], expireDates:[...], shelfLives:[{value,unit}] }
const ocrScanMatExpirePromise = function (imageBase64, sessionKey) {
  var url = app.globalData.requestPrefix + 'FnbMaterial/OcrScanName?sessionKey=' + sessionKey
  return util.performWebRequest(url, { image: imageBase64 })
}

// POST UploadPhoto (multipart) — 现场照片直传 FnbMaterial/UploadPhoto（不是通用 UploadFile/
// UploadFileWithThumb！本功能专属接口，落库 purpose="食材批次"，直接返 {id,file_path_name} 可用于
// image_ids，无需二段缩略图上传）。
// ⚠️ 返回体是标准 ApiResult 信封（有 code/message/data），必须先判 code 再取 .data，不能照抄
// uploadFilePromise 直接把 JSON.parse 结果当裸对象用。wx.uploadFile 对任意 HTTP 状态码都会触发
// success 回调，必须手动判断 res.statusCode 落在 [200,300) 才算成功（本仓库已有过因漏判导致假成功的教训）
const uploadMatExpirePhotoPromise = function (filePath, sessionKey) {
  // 2026-07-21 改为与 uploadFilePromise（养护开单）一致，硬编码 snowmeet.wanlonghuaxue.com，
  // 不再走 requestPrefix（mini.snowmeet.top）——图片统一落到 wanlonghuaxue 那台服务器磁盘
  var uploadUrl = 'https://snowmeet.wanlonghuaxue.com/api/FnbMaterial/UploadPhoto?sessionKey=' + sessionKey
  return new Promise(function (resolve, reject) {
    wx.uploadFile({
      filePath: filePath,
      name: 'file',
      url: uploadUrl,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.warn('mat_expire upload failed http ' + res.statusCode, res.data)
          reject(res)
          return
        }
        try {
          var body = JSON.parse(res.data)
          if (body.code !== 0) {
            reject(body.message || '上传失败')
            return
          }
          resolve(body.data)
        } catch (e) {
          reject(e)
        }
      },
      fail: (res) => {
        reject(res)
      },
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
  verifyMemberCellPromise,
  getMemberPromise,
  getMemberByNumPromise,
  getMemberByNumSilentPromise,
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
  getRentOrdersByStaffPagedPromise,
  getOrderByStaffPromise,
  GetUnCommonPayMethodPromise,
  updateOrderPromise,
  cancelPayingPromise,
  getOrderFromPaymentByCustomer,
  getPaymentLiveStatusPromise,
  checkPayerIdentityPromise,
  verifyWechatIdentityPromise,
  getWechatVerifyStatusPromise,
  confirmPayIdentityPromise,
  updateOrderWithDetailPromise,
  getEquipBrandsPromise,
  uploadFilePromise,
  getCareOthersServicePromise,
  getMemberCaredEquipmentsPromise,
  getMemberLatestSafeCheckPromise,
  getCareProductPromise,
  getRentalPromise,
  setRentItemStatsPromise,
  updateRentalDetailsPromise,
  updateRentalDayChargesPromise,
  setRentalEntertainPromise,
  refundPromise,
  updateRentalPromise,
  updateRentalGuarantyPromise,
  getRentTypePromise,
  getRentPriceByIdPromise,
  updateCarePromise,
  updateCareTaskStatusPromise,
  createCareVerifyCodePromise,
  veriCareFinishCodePromise,
  setCarePickImagePromise,
  updateCareBrandPromise,
  createScanQrCodeByStaffPromise,
  stopScanQrCodePromise,
  getOAQrCodeUrlPromise,
  getPrinterListPromise,
  getAllPrintersPromise,
  getMyInfo,
  payWithDepositPromise,
  writeoffCareOrderPromise,
  getRentalPunchCardInfoPromise,
  useRentalPunchCardPromise,
  getPunchCardProductsPromise,
  getPunchCardProductPromise,
  getAllPunchCardProductsPromise,
  getPunchCardCategoryCodePromise,
  addPunchCardProductPromise,
  modPunchCardProductPromise,
  deletePunchCardProductPromise,
  getShopListPromise,
  getProductPromise,
  getMyPunchCardsPromise,
  getMyPunchCardUsagesPromise,
  getPunchCardUsagesByStaffPromise,
  refundMyPunchCardPromise,
  checkMyPunchCardPurchasePromise,
  bindWechatCellPromise,
  placeMyPunchCardOrderPromise,
  getMyPunchCardOrderPromise,
  startMyPunchCardPaymentPromise,
  preparePunchCardSalePromise,
  startPunchCardSaleQrPromise,
  finalizePunchCardSalePromise,
  searchMembersByStaffPromise,
  getMemberDetailByStaffPromise,
  updateMemberProfilePromise,
  getTagLibraryPromise,
  getTagLibraryStatsPromise,
  mergeTagPresetPromise,
  deleteTagPresetPromise,
  addTagPresetPromise,
  addMemberTagPromise,
  removeMemberTagPromise,
  registerMemberByPhonePromise,
  chargeMemberDepositPromise,
  grantPunchCardPromise,
  getPunchCardPresetsPromise,
  grantCouponPromise,
  getCouponTemplatesPromise,
  mergeMemberByStaffPromise,
  getMemberAssetsByStaffPromise,
  searchDepositAccountsByStaffPromise,
  getDepositAccountDetailByStaffPromise,
  getMemberTicketsPromise,
  getMemberCardsPromise,
  calcCareChargePromise,
  getUnreturnedRentItemPromise,
  getUnpickedCareItemsByStaffPromise,
  queryRentItemChangeCompatibleCategory,
  getOrderBalancePromise,
  updateRentPackageCategoryPromise,
  getPackageListByShopPromise,
  getUnipayOrderPromise,
  updateRentItemPromise,
  getMatExpireBatchesPromise,
  saveMatExpireBatchPromise,
  disposeMatExpireBatchPromise,
  deleteMatExpireBatchPromise,
  genMatExpireBatchNoPromise,
  getMatExpireImagesPromise,
  ocrScanMatExpirePromise,
  uploadMatExpirePhotoPromise
}