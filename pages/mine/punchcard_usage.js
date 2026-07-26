// pages/mine/punchcard_usage.js
// 我的次卡·使用明细：从「我的次卡」点某张卡进来，列出这张卡被哪些订单核销过
// （订单号 / 订单业务日期时间 / 该订单核销的次数）。
// 数据全部来自 Rent/GetMyPunchCardUsages，服务端按 order_id 汇总 punch_card_used
// （该表是"每条 rental / 每件 care 一行"的粒度，同一订单可能有多行）并校验卡属于本人。
//
// 一次都没核销过的卡还能在这里自助退款：能不能退、退多少、不能退的原因，全部由服务端
// 随上面那个接口一起下发（refund 字段），本页不自己判规则——判断口径必须和真正执行退款时
// 完全一致，否则会出现"页面给了按钮、点下去被拒"。
//
// 本页同时服务店员：会员详情页点某张卡也进这里，带 ?staff=1。区别只有两点——
// ① 数据走 Rent/GetPunchCardUsagesByStaff（按 staff 权限放行，不校验"卡是我的"）
// ② 服务端不下发 refund，所以顾客自助退款入口自然不显示（店员替顾客退款走店员自己的流程）
// 展示口径两边完全一致，由服务端同一个 BuildPunchCardUsageView 组装。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

Page({
  data: {
    cardId: 0,
    isStaff: false,        // 店员模式（从会员详情进来）：换数据源 + 不显示顾客自助退款入口
    card: null,
    usages: [],
    usedTotal: 0,
    refund: null,          // 服务端退款判定 { isRefund, canRefund, contactStaff, blockReason, refundAmount }
    refundAmountStr: '',
    refunding: false,
    member: null,          // 仅店员模式下发：{ id, name, gender, cell, displayName }
    equipBrand: '',        // 季卡绑定装备编辑框（仅店员模式，季卡才显示）
    equipScale: '',
    savingEquip: false,
    loading: true
  },

  onLoad(options) {
    var cardId = parseInt(options.cardId, 10) || 0
    var isStaff = options.staff == '1'
    this.setData({ cardId: cardId, isStaff: isStaff })
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    })
  },

  getData() {
    var that = this
    if (!that.data.cardId) {
      that.setData({ loading: false })
      return
    }
    that.setData({ loading: true })
    var promise = that.data.isStaff
      ? data.getPunchCardUsagesByStaffPromise(that.data.cardId, app.globalData.sessionKey)
      : data.getMyPunchCardUsagesPromise(that.data.cardId, app.globalData.sessionKey)
    promise.then(function (res) {
      res = res || {}
      var card = res.card || null
      if (card) {
        card.remainingStr = card.isSeason ? '不限次数' : ('剩余 ' + card.remaining + ' 次')
      }
      var refund = res.refund || null
      // 店员模式（管理后台卡销售明细）多带顾客信息；季卡还可以改绑定装备的品牌/长度
      var member = res.member || null
      if (member) {
        member.displayName = (member.name || '（未填姓名）') + (member.gender ? '·' + member.gender : '')
      }
      that.setData({
        card: card,
        member: member,
        equipBrand: (card && card.equip_brand) || '',
        equipScale: (card && card.equip_scale) || '',
        usages: res.usages || [],
        usedTotal: res.usedTotal || 0,
        refund: refund,
        // showAmount 返回值自带 ¥ 前缀，拼文案时别再加
        refundAmountStr: (refund && refund.refundAmount > 0) ? util.showAmount(refund.refundAmount) : '',
        loading: false
      })
      if (card) {
        wx.setNavigationBarTitle({ title: card.card_name || '次卡使用明细' })
      }
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  /* ---------- 季卡绑定装备（仅店员模式） ---------- */
  onEquipBrandInput(e) { this.setData({ equipBrand: e.detail.value }) },
  onEquipScaleInput(e) { this.setData({ equipScale: e.detail.value }) },

  // 只开放品牌和长度：装备类型换了等于换一块板，属于"换卡"不是"改信息"，服务端也不接受
  onSaveEquip() {
    var that = this
    if (that.data.savingEquip) return
    that.setData({ savingEquip: true })
    wx.showLoading({ title: '保存中', mask: true })
    data.updatePunchCardEquipByStaffPromise(that.data.cardId, that.data.equipBrand,
      that.data.equipScale, app.globalData.sessionKey).then(function () {
      wx.hideLoading()
      that.setData({ savingEquip: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      that.getData()   // 重新拉，确保界面与库里一致
    }).catch(function () {
      // performWebRequest 已把服务端拒绝原因 toast 出来了，这里只复位状态
      wx.hideLoading()
      that.setData({ savingEquip: false })
    })
  },

  // 自助退款：二次确认后发起。退多少钱由服务端重新算（不把前端显示的金额传回去），
  // 这里只负责把后果说清楚再让顾客点确认。
  onRefundTap() {
    var that = this
    var refund = that.data.refund
    if (!refund || !refund.canRefund || that.data.refunding) return
    wx.showModal({
      title: '确认退款',
      content: '将退回 ' + that.data.refundAmountStr + ' 到原支付账户。退款后这张卡不能再使用，且无法撤销。',
      confirmText: '确认退款',
      confirmColor: '#E64340',
      success(r) {
        if (!r.confirm) return
        that.setData({ refunding: true })
        wx.showLoading({ title: '退款中…', mask: true })
        data.refundMyPunchCardPromise(that.data.cardId, app.globalData.sessionKey).then(function () {
          wx.hideLoading()
          that.setData({ refunding: false })
          wx.showToast({ title: '退款已提交', icon: 'success' })
          that.getData()   // 重新拉一次，卡片切到「已退款」置灰态
        }).catch(function () {
          // performWebRequest 已经把服务端返回的拒绝原因 toast 出来了，这里只复位状态
          wx.hideLoading()
          that.setData({ refunding: false })
        })
      }
    })
  }
})
