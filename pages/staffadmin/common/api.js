// 员工账号管理的数据接口，页面只调这里。原型阶段全部走 mock.js 的内存演示数据；
// 服务器阶段只替换本文件的实现（改为请求 /api/StaffAdmin/*），函数名、参数和返回结构保持不变
const mock = require('./mock.js')

const PROTOTYPE = true

function call(fn) {
  const args = Array.prototype.slice.call(arguments, 1)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(JSON.parse(JSON.stringify(fn.apply(null, args)))) } catch (e) { reject(e) }
    }, 0)
  })
}

module.exports = {
  PROTOTYPE,
  listShops: () => call(mock.listShops),
  listStaff: () => call(mock.listStaff),
  getStaff: id => call(mock.getStaff, id),
  listPhones: () => call(mock.listPhones),
  onboard: form => call(mock.onboard, form),
  updateStaff: form => call(mock.updateStaff, form),
  changePhone: (staffId, accountId) => call(mock.changePhone, { staff_id: staffId, account_id: accountId }),
  rebind: staffId => call(mock.rebind, staffId),
  offboard: (staffIds, date) => call(mock.offboard, { staff_ids: staffIds, date }),
  approve: (staffId, titleLevel, shopId) => call(mock.approve, { staff_id: staffId, title_level: titleLevel, base_shop_id: shopId }),
  reject: staffId => call(mock.reject, staffId),
  reclaimPhone: accountId => call(mock.reclaimPhone, accountId),
  addJobPhone: cell => call(mock.addJobPhone, cell),
  bindJobPhone: accountId => call(mock.bindJobPhone, accountId),
  getCode: token => call(mock.getCode, token),
  confirmBind: (token, cell) => call(mock.confirmBind, { token, cell }),
  selfRegister: form => call(mock.selfRegister, form)
}
