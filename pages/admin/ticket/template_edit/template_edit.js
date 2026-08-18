// pages/admin/ticket/template_edit/template_edit.js
// 优惠券模板维护 —— 编辑（管理后台 staff≥200）
//
// 两组互斥关系是这个页面的全部难点，都用 radio 在 UI 层做成不可能违反：
//   有效期：按天数 / 按固定日期 / 永久有效  → 三选一，切档位就把另一个字段置空
//   商品优惠：一口价 / 折扣率 / 立减金额     → 三选一，同一条规则只留一个值
// 服务端（ValidateTemplate + SaveTemplateByStaff 的 validityMode 分支）还会再兜一道，
// 因为这两个约束一旦破了，发出去的券要么永不过期、要么一落库就过期。
var app = getApp()
var data = require('../../../../utils/data.js')

var BIZ_OPTIONS = [
  { key: '养护', name: '养护' },
  { key: '租赁', name: '租赁' },
  { key: '', name: '不参与开单' }
]
var VALIDITY_OPTIONS = [
  { key: 'days', name: '按天数' },
  { key: 'date', name: '按固定日期' },
  { key: 'forever', name: '永久有效' }
]
var MODE_OPTIONS = [
  { key: 'fixed', name: '一口价' },
  { key: 'rate', name: '折扣率' },
  { key: 'amount', name: '立减金额' }
]
var MODE_HINT = {
  fixed: '直接把服务费定成这个数。填 0 就是免费。',
  rate: '打几折的小数：0.8 = 8 折。要免费请改用一口价 0。',
  amount: '在原价基础上减掉这个金额，减到 0 为止。'
}

Page({
  data: {
    id: 0,
    isNew: true,
    loading: false,
    saving: false,

    // ── 基础信息
    name: '',
    type: '',
    memo: '',
    miniappReceptPath: '',
    hide: 0,
    valid: 1,

    bizOptions: BIZ_OPTIONS,
    bizType: '',

    validityOptions: VALIDITY_OPTIONS,
    validityMode: 'forever',
    availableDays: '',
    expireDate: '',

    // ── 商品优惠规则
    rules: [],

    // ── 规则编辑面板：'' 关闭 | 'form' 填规则 | 'product' 选商品
    rulePanel: '',
    modeOptions: MODE_OPTIONS,
    modeHint: '',
    editRuleId: 0,
    editProductId: 0,
    editProductName: '',
    editMode: 'fixed',
    editValue: '',

    productKeyword: '',
    productOptions: [],
    productLoading: false
  },

  onLoad(options) {
    var id = parseInt((options && options.id) || '0', 10) || 0
    this.setData({ id: id, isNew: id <= 0 })
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      var staff = app.globalData.staff
      if (!staff || staff.title_level < 200) {
        wx.showToast({ title: '没有权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      if (that.data.id > 0) { that.getData() }
    })
  },

  getData() {
    var that = this
    that.setData({ loading: true })
    data.getTicketTemplateDetailPromise(that.data.id, app.globalData.sessionKey).then(function (d) {
      d = d || {}
      that.setData({
        name: d.name || '',
        type: d.type || '',
        memo: d.memo || '',
        miniappReceptPath: d.miniappReceptPath || '',
        hide: d.hide || 0,
        valid: d.valid == null ? 1 : d.valid,
        bizType: d.bizType || '',
        validityMode: d.validityMode || 'forever',
        availableDays: d.availableDays == null ? '' : String(d.availableDays),
        expireDate: d.expireDate || '',
        rules: that._decorate(d.rules || []),
        loading: false
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  // WXML 不支持方法调用，行上要用的判断一律在这里派生好
  _decorate(rules) {
    return rules.map(function (r) {
      return Object.assign({}, r, {
        priceText: r.productId === 0 ? '' : ('原价 ¥' + r.salePrice),
        isWildcard: r.productId === 0
      })
    })
  },

  // ── 基础信息 ──────────────────────────────────────────────────

  onInput(e) {
    var patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },

  onSwitch(e) {
    var patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value ? 1 : 0
    this.setData(patch)
  },

  onBizTap(e) {
    this.setData({ bizType: e.currentTarget.dataset.key })
  },

  // 切档位就把不属于该档位的字段清空——互斥在这里就落地，不留给保存时再补救
  onValidityTap(e) {
    var mode = e.currentTarget.dataset.key
    var patch = { validityMode: mode }
    if (mode !== 'days') { patch.availableDays = '' }
    if (mode !== 'date') { patch.expireDate = '' }
    this.setData(patch)
  },

  onExpireDateChange(e) {
    this.setData({ expireDate: e.detail.value })
  },

  onSave() {
    var that = this
    if (that.data.saving) { return }
    if (!that.data.name.trim()) {
      wx.showToast({ title: '请填写模板名称', icon: 'none' })
      return
    }
    if (!that.data.type.trim()) {
      wx.showToast({ title: '请填写模板类型', icon: 'none' })
      return
    }
    if (that.data.validityMode === 'days' && !(parseInt(that.data.availableDays, 10) > 0)) {
      wx.showToast({ title: '请填写大于 0 的可用天数', icon: 'none' })
      return
    }
    if (that.data.validityMode === 'date' && !that.data.expireDate) {
      wx.showToast({ title: '请选择总过期日', icon: 'none' })
      return
    }
    that.setData({ saving: true })
    data.saveTicketTemplatePromise({
      id: that.data.id,
      name: that.data.name.trim(),
      type: that.data.type.trim(),
      memo: that.data.memo,
      bizType: that.data.bizType,
      validityMode: that.data.validityMode,
      availableDays: that.data.validityMode === 'days'
        ? parseInt(that.data.availableDays, 10) : null,
      expireDate: that.data.validityMode === 'date' ? that.data.expireDate : null,
      miniappReceptPath: that.data.miniappReceptPath,
      hide: that.data.hide,
      valid: that.data.valid
    }, app.globalData.sessionKey).then(function (res) {
      wx.showToast({ title: '已保存', icon: 'success' })
      // 新建完要留在本页继续配商品优惠，所以就地转成编辑态而不是返回
      if (that.data.id <= 0 && res && res.id) {
        that.setData({ id: res.id, isNew: false, saving: false })
      } else {
        that.setData({ saving: false })
      }
    }).catch(function () {
      that.setData({ saving: false })
    })
  },

  // ── 商品优惠规则 ──────────────────────────────────────────────

  onAddRuleTap() {
    if (this.data.id <= 0) {
      wx.showToast({ title: '请先保存模板', icon: 'none' })
      return
    }
    this.setData({
      rulePanel: 'form',
      editRuleId: 0,
      editProductId: 0,
      editProductName: '',
      editMode: 'fixed',
      editValue: '',
      modeHint: MODE_HINT.fixed
    })
  },

  onRuleTap(e) {
    var r = this.data.rules[Number(e.currentTarget.dataset.idx)]
    if (!r) { return }
    var mode = r.mode === 'none' ? 'fixed' : r.mode
    var value = r.fixedPrice != null ? r.fixedPrice
      : (r.discountRate != null ? r.discountRate
      : (r.discountAmount != null ? r.discountAmount : ''))
    this.setData({
      rulePanel: 'form',
      editRuleId: r.id,
      editProductId: r.productId,
      editProductName: r.productName,
      editMode: mode,
      editValue: String(value),
      modeHint: MODE_HINT[mode]
    })
  },

  onRuleModeTap(e) {
    var mode = e.currentTarget.dataset.key
    this.setData({ editMode: mode, modeHint: MODE_HINT[mode] })
  },

  onRuleValueInput(e) {
    this.setData({ editValue: e.detail.value })
  },

  onRulePanelClose() {
    this.setData({ rulePanel: '' })
  },

  onNoop() {},

  onRuleSave() {
    var that = this
    var value = parseFloat(that.data.editValue)
    if (isNaN(value)) {
      wx.showToast({ title: '请填写优惠数值', icon: 'none' })
      return
    }
    if (that.data.editMode === 'rate' && (value <= 0 || value >= 1)) {
      wx.showToast({ title: '折扣率要在 0 和 1 之间', icon: 'none' })
      return
    }
    if (value < 0) {
      wx.showToast({ title: '金额不能为负', icon: 'none' })
      return
    }
    data.saveTicketProductRulePromise({
      id: that.data.editRuleId,
      templateId: that.data.id,
      productId: that.data.editProductId,
      mode: that.data.editMode,
      value: value
    }, app.globalData.sessionKey).then(function () {
      that.setData({ rulePanel: '' })
      that.getData()
    }).catch(function () {})
  },

  onRuleDelete() {
    var that = this
    if (that.data.editRuleId <= 0) { return }
    wx.showModal({
      title: '删除这条商品优惠',
      content: '删除后这个商品用本模板的券将不再享受优惠。',
      success: function (res) {
        if (!res.confirm) { return }
        data.deleteTicketProductRulePromise(that.data.editRuleId, app.globalData.sessionKey)
          .then(function () {
            that.setData({ rulePanel: '' })
            that.getData()
          }).catch(function () {})
      }
    })
  },

  // ── 商品选择器（与规则表单共用同一层遮罩，切 step 不叠遮罩）────

  onPickProductTap() {
    this.setData({ rulePanel: 'product' })
    this.loadProducts()
  },

  onProductKeywordInput(e) {
    this.setData({ productKeyword: e.detail.value })
  },

  loadProducts() {
    var that = this
    that.setData({ productLoading: true })
    data.getTicketRuleProductOptionsPromise(that.data.productKeyword, app.globalData.sessionKey)
      .then(function (res) {
        that.setData({ productOptions: (res && res.items) || [], productLoading: false })
      }).catch(function () {
        that.setData({ productLoading: false })
      })
  },

  onProductTap(e) {
    var p = this.data.productOptions[Number(e.currentTarget.dataset.idx)]
    if (!p) { return }
    this.setData({ editProductId: p.id, editProductName: p.name, rulePanel: 'form' })
  },

  // product_id = 0 是通配兜底：本模板的券对所有商品都按这条规则算
  onPickAllProducts() {
    this.setData({ editProductId: 0, editProductName: '（全部商品）', rulePanel: 'form' })
  },

  onBackToForm() {
    this.setData({ rulePanel: 'form' })
  }
})
