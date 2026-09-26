// 欠料而且缺的是整包没开封：确认后开封最早到期的那一件（出餐建单、半成品制作共用）
// stock：GetDeductStock 的一项 { openBatchId, openBatchNo, openPackSize, packUnitName }；开好 resolve(true)，取消或失败 resolve(false)
const api = require('./api.js')
const base = require('./page-base.js')
const units = require('./units.js')

function openOne(page, name, baseUnit, stock) {
  const packName = stock.packUnitName || '件'
  return new Promise(resolve => {
    wx.showModal({
      title: '开封 1 ' + packName + name,
      content: '批次 ' + (stock.openBatchNo || '') + '，放出 ' + units.formatQty(stock.openPackSize, baseUnit) + '，之后按开封后保质期计算。',
      confirmText: '开封',
      success: r => {
        if (!r.confirm) { resolve(false); return }
        const key = 'open:' + stock.openBatchId
        api.post(page.ctx, 'FnbInventory/PostOpen', { requestId: page.keeper.get(key), parentBatchId: stock.openBatchId, packCount: 1 })
          .then(() => {
            page.keeper.done(key)
            wx.showToast({ title: '已开封 1 ' + packName, icon: 'success' })
            resolve(true)
          })
          .catch(err => { if (!err.retryable) page.keeper.done(key); base.fail(err); resolve(false) })
      },
      fail: () => resolve(false)
    })
  })
}

module.exports = { openOne }
