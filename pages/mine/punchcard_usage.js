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
    // 季卡绑定装备编辑（仅店员模式，季卡才显示）。录入方式与养护开单的装备信息一致：
    // 类型双选按钮 + 品牌 picker（末项「＋ 新增品牌」）+ 长度数字输入
    equipType: '',
    equipBrand: '',
    equipScale: '',
    skiBrandList: [],      // 双板品牌字典（Care/GetBrands）
    boardBrandList: [],    // 单板品牌字典
    brandListView: [],     // 当前类型的 picker 选项（末项固定是「＋ 新增品牌」）
    brandIndex: 0,
    addBrand: { show: false, name: '', chineseName: '' },
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
      if (isStaff) {
        that.loadBrandLists()   // 只有店员模式才有装备编辑，顾客侧不必拉字典
      }
    })
  },

  // 品牌字典按装备类型分两份（与养护开单同源 Care/GetBrands）。
  // 拉取失败不阻断页面：品牌 picker 空着，其余信息照常显示
  loadBrandLists() {
    var that = this
    Promise.all([
      data.getEquipBrandsPromise('双板'),
      data.getEquipBrandsPromise('单板')
    ]).then(function (res) {
      that.setData({ skiBrandList: res[0] || [], boardBrandList: res[1] || [] })
      that.refreshBrandView()
    }).catch(function () { })
  },

  brandListFor(equipType) {
    if (equipType == '单板') return this.data.boardBrandList
    if (equipType == '双板') return this.data.skiBrandList
    return []
  },

  // 派生 picker 选项 + 选中下标。末项固定「＋ 新增品牌」，选中它走新增流程
  refreshBrandView() {
    var list = this.brandListFor(this.data.equipType)
    var names = []
    var index = 0
    for (var i = 0; i < list.length; i++) {
      names.push(list[i].displayedName)
      if (list[i].displayedName == this.data.equipBrand) { index = i }
    }
    names.push('＋ 新增品牌')
    this.setData({ brandListView: names, brandIndex: index })
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
      // 店员模式（管理后台卡销售明细）多带顾客信息；季卡还可以改绑定装备的类型/品牌/长度
      var member = res.member || null
      if (member) {
        member.displayName = (member.name || '（未填姓名）') + (member.gender ? '·' + member.gender : '')
      }
      that.setData({
        card: card,
        member: member,
        equipType: (card && card.equip_type) || '',
        equipBrand: (card && card.equip_brand) || '',
        equipScale: (card && card.equip_scale) || '',
        usages: res.usages || [],
        usedTotal: res.usedTotal || 0,
        refund: refund,
        // showAmount 返回值自带 ¥ 前缀，拼文案时别再加
        refundAmountStr: (refund && refund.refundAmount > 0) ? util.showAmount(refund.refundAmount) : '',
        loading: false
      })
      that.refreshBrandView()   // 品牌选中下标跟着新拉到的绑定值走
      if (card) {
        wx.setNavigationBarTitle({ title: card.card_name || '次卡使用明细' })
      }
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  /* ---------- 季卡绑定装备（仅店员模式） ---------- */

  // 换装备类型：品牌字典是按类型分的，原品牌在新类型里没有就作废
  // （同名品牌两边都有的情况保留，免得只是点错类型还要重选一遍）
  onEquipTypeTap(e) {
    var equipType = e.currentTarget.dataset.equip
    if (equipType == this.data.equipType) return
    var list = this.brandListFor(equipType)
    var keep = ''
    for (var i = 0; i < list.length; i++) {
      if (list[i].displayedName == this.data.equipBrand) { keep = this.data.equipBrand; break }
    }
    this.setData({ equipType: equipType, equipBrand: keep })
    this.refreshBrandView()
  },

  onBrandChange(e) {
    var idx = Number(e.detail.value)
    var list = this.brandListFor(this.data.equipType)
    if (idx >= list.length) {
      // 末项「＋ 新增品牌」
      this.setData({ addBrand: { show: true, name: '', chineseName: '' } })
      return
    }
    this.setData({ equipBrand: list[idx].displayedName, brandIndex: idx })
  },

  onAddBrandInput(e) {
    this.setData({ ['addBrand.' + e.currentTarget.dataset.field]: e.detail.value })
  },
  onAddBrandCancel() { this.setData({ 'addBrand.show': false }) },

  // 新增品牌：服务端返回该类型的品牌全列表，直接替换本地字典并选中刚加的这个
  onAddBrandConfirm() {
    var that = this
    var name = that.data.addBrand.name
    var chineseName = that.data.addBrand.chineseName
    if (!name) {
      wx.showToast({ title: '必须填写英文名称', icon: 'none' })
      return
    }
    if (!that.data.equipType) {
      wx.showToast({ title: '请先选择装备类型', icon: 'none' })
      return
    }
    data.updateCareBrandPromise(that.data.equipType, name, chineseName,
      app.globalData.sessionKey).then(function (brandList) {
      brandList = brandList || []
      var patch = that.data.equipType == '单板'
        ? { boardBrandList: brandList } : { skiBrandList: brandList }
      var added = null
      for (var i = 0; i < brandList.length; i++) {
        if (brandList[i].brand_name == name) { added = brandList[i]; break }
      }
      patch['addBrand.show'] = false
      patch.equipBrand = added ? added.displayedName : (name + '/' + (chineseName || ''))
      that.setData(patch)
      that.refreshBrandView()
    }).catch(function () {
      wx.showToast({ title: '新增品牌失败', icon: 'none' })
    })
  },

  onEquipScaleInput(e) { this.setData({ equipScale: e.detail.value }) },

  // 三项要么全填、要么全空：缺一项就是残缺绑定，这张季卡以后再也匹配不上任何装备。
  // 服务端同样会拒（那才是底线），这里先拦一道是为了给出更明白的提示
  onSaveEquip() {
    var that = this
    if (that.data.savingEquip) return
    var filled = (that.data.equipType ? 1 : 0)
      + ((that.data.equipBrand || '').trim() ? 1 : 0)
      + ((String(that.data.equipScale || '')).trim() ? 1 : 0)
    if (filled != 0 && filled != 3) {
      wx.showToast({ title: '类型、品牌、长度要填就要填全', icon: 'none' })
      return
    }
    that.setData({ savingEquip: true })
    wx.showLoading({ title: '保存中', mask: true })
    data.updatePunchCardEquipByStaffPromise(that.data.cardId, that.data.equipType,
      that.data.equipBrand, that.data.equipScale, app.globalData.sessionKey).then(function () {
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
