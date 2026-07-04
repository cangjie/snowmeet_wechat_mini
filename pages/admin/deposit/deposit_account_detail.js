// 储值账户详情 — 账户汇总（总储值/已消费/可用）+ 流水列表
// 充值行：类型(biz_type) + 七色米订单号(biz_id) + 备注(memo)；消费行：关联订单号(order.code)
const app = getApp()
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')

function fmtDateTime(s) {
  if (!s) return ''
  var d = new Date(String(s).replace(/-/g, '/').replace('T', ' '))
  if (isNaN(d.getTime())) return String(s).slice(0, 16).replace('T', ' ')
  var p = function (n) { return n < 10 ? '0' + n : '' + n }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

Page({
  data: {
    accountId: 0,
    account: null,
    balances: [],
    loading: true
  },

  onLoad(options) {
    this.setData({ accountId: parseInt(options.accountId) || 0 })
  },
  onShow() {
    if (this.data.accountId) this.getData()
  },

  getData() {
    var that = this
    data.getDepositAccountDetailByStaffPromise(that.data.accountId, app.globalData.sessionKey).then(function (r) {
      if (!r || !r.account) {
        that.setData({ loading: false })
        wx.showToast({ title: '账户不存在', icon: 'none' })
        return
      }
      var a = r.account
      a.avatar = (a.name && a.name.length > 0) ? a.name[0] : '?'
      a.female = a.gender === '女'
      a.typeLabel = (a.type || '储值') + (a.subType ? ' · ' + a.subType : '')
      a.incomeStr = util.showAmount(a.income || 0)
      a.consumeStr = util.showAmount(a.consume || 0)
      a.availableStr = util.showAmount(a.available || 0)
      var balances = (r.balances || []).map(function (b) {
        var abs = Math.abs(b.amount || 0)
        return {
          id: b.id,
          isCharge: !!b.isCharge,
          amountStr: (b.isCharge ? '+' : '-') + util.showAmount(abs),
          bizType: b.bizType || '',
          bizId: b.bizId || '',
          memo: b.memo || '',
          orderLabel: b.isCharge ? '' : (b.orderCode || (b.orderId ? '#' + b.orderId : '')),
          timeStr: fmtDateTime(b.createDate)
        }
      })
      that.setData({ account: a, balances: balances, loading: false })
    }).catch(function () {
      that.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onCallPhone() {
    var a = this.data.account
    if (a && a.phone) wx.makePhoneCall({ phoneNumber: a.phone, fail: function () {} })
  }
})
