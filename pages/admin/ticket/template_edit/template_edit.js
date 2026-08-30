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
var util = require('../../../../utils/util.js')

// 分享记录默认只看最近一周（含今天共 7 天）。批次会越攒越多，
// 一进来就把历史全铺出来没意义，店员要找的基本是刚发出去的那几张。
function defaultBatchRange() {
  var end = new Date()
  var start = new Date()
  start.setDate(end.getDate() - 6)
  return { startDate: util.formatDate(start), endDate: util.formatDate(end) }
}

// 与 [order].type 对齐（生产库订单类型就是这四个），因为 biz_type 的作用
// 就是把券路由到对应的开单流程。没有"都不参与"这一档，必须选一个。
var BIZ_OPTIONS = [
  { key: '零售', name: '零售' },
  { key: '养护', name: '养护' },
  { key: '租赁', name: '租赁' },
  { key: '餐饮', name: '餐饮' }
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
    sharable: 0,
    coverUploadId: null,
    coverUrl: '',
    posterWidth: 1080,
    posterHeight: 1440,
    qrX: 0,
    qrY: 0,
    qrWidth: 240,
    qrHeight: 240,
    posterPreviewHeight: 867,
    qrOverlayStyle: '',
    uploadingCover: false,

    bizOptions: BIZ_OPTIONS,
    bizType: '',

    validityOptions: VALIDITY_OPTIONS,
    validityMode: 'forever',
    availableDays: '',
    expireDate: '',

    // ── 商品优惠规则
    rules: [],

    shareMode: '',             // '' | 'personal' | 'group'，点分享按钮时置位，onShareAppMessage 读完即清
    shareBatches: [],          // 我在本模板下发起过的分享（按下面的日期区间筛）
    batchStartDate: '',
    batchEndDate: '',
    timelineSharePath: '',
    timelinePosterUrl: '',
    timelinePreparing: false,
    groupQrMode: 'dynamic',
    generatingGroupPoster: false,
    // 「分享」卡片里三个子区的展开状态，默认都收起
    shareOpen: { poster: false, card: false, batch: false },

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
    var range = defaultBatchRange()
    this.setData({
      id: id, isNew: id <= 0,
      batchStartDate: range.startDate, batchEndDate: range.endDate
    })
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
      if (that.data.id > 0) {
        that.getData()
        that.loadShareBatches()
      }
    })
  },

  getData() {
    var that = this
    that.setData({ loading: true })
    data.getTicketTemplateDetailPromise(that.data.id, app.globalData.sessionKey).then(function (d) {
      d = d || {}
      var coverUrl = d.coverUrl || ''
      if (coverUrl && coverUrl.indexOf('http') !== 0) {
        coverUrl = 'https://mini.snowmeet.top' + coverUrl
      }
      that.setData({
        name: d.name || '',
        type: d.type || '',
        memo: d.memo || '',
        miniappReceptPath: d.miniappReceptPath || '',
        hide: d.hide || 0,
        valid: d.valid == null ? 1 : d.valid,
        sharable: d.sharable || 0,
        coverUploadId: d.coverUploadId || null,
        coverUrl: coverUrl,
        posterWidth: d.posterWidth || 1080,
        posterHeight: d.posterHeight || 1440,
        qrX: d.qrX || 0,
        qrY: d.qrY || 0,
        qrWidth: d.qrWidth || 240,
        qrHeight: d.qrHeight || 240,
        bizType: d.bizType || '',
        validityMode: d.validityMode || 'forever',
        availableDays: d.availableDays == null ? '' : String(d.availableDays),
        expireDate: d.expireDate || '',
        rules: that._decorate(d.rules || []),
        loading: false
      }, function () {
        that._updateQrOverlay()
        that._setPosterPreviewRatio(coverUrl)
        that._prepareTimelineShare()
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
    var field = e.currentTarget.dataset.field
    patch[field] = e.detail.value
    if (field === 'qrX' || field === 'qrY' || field === 'qrWidth' || field === 'qrHeight') {
      this.setData(patch, () => this._updateQrOverlay())
      return
    }
    this.setData(patch)
  },

  _updateQrOverlay() {
    var posterWidth = parseInt(this.data.posterWidth, 10) || 1080
    var posterHeight = parseInt(this.data.posterHeight, 10) || 1440
    var x = Math.max(0, parseInt(this.data.qrX, 10) || 0)
    var y = Math.max(0, parseInt(this.data.qrY, 10) || 0)
    var width = Math.max(1, parseInt(this.data.qrWidth, 10) || 240)
    var height = Math.max(1, parseInt(this.data.qrHeight, 10) || 240)
    var previewScale = 650 / posterWidth
    this.setData({ qrOverlayStyle: 'left:' + (x * 100 / posterWidth) + '%;top:'
      + (y * 100 / posterHeight) + '%;width:' + (width * previewScale)
      // 预览宽度固定 650rpx，宽高都以它为基准，二维码不会受容器高度影响。
      + 'rpx;height:' + (height * previewScale) + 'rpx;' })
  },

  _posterPreviewWidthPx() {
    return 650 * wx.getSystemInfoSync().windowWidth / 750
  },

  _setPosterPreviewRatio(url) {
    var that = this
    if (!url) { return }
    wx.getImageInfo({
      src: url,
      success: function (info) {
        if (info.width > 0 && info.height > 0) {
          that.setData({ posterPreviewHeight: Math.round(650 * info.height / info.width) })
        }
      }
    })
  },

  onQrTouchStart(e) {
    var touch = e.touches[0]
    this._qrDrag = { startX: touch.pageX, startY: touch.pageY,
      qrX: parseInt(this.data.qrX, 10) || 0, qrY: parseInt(this.data.qrY, 10) || 0 }
  },

  onQrTouchMove(e) {
    if (!this._qrDrag) { return }
    var touch = e.touches[0]
    var posterWidth = parseInt(this.data.posterWidth, 10) || 1080
    var posterHeight = parseInt(this.data.posterHeight, 10) || 1440
    var previewWidth = this._posterPreviewWidthPx()
    var previewHeight = previewWidth * (parseInt(this.data.posterPreviewHeight, 10) || 867) / 650
    var nextX = Math.round(this._qrDrag.qrX
      + (touch.pageX - this._qrDrag.startX) * posterWidth / previewWidth)
    var nextY = Math.round(this._qrDrag.qrY
      + (touch.pageY - this._qrDrag.startY) * posterHeight / previewHeight)
    var qrWidth = parseInt(this.data.qrWidth, 10) || 240
    var qrHeight = parseInt(this.data.qrHeight, 10) || 240
    this.setData({
      qrX: Math.max(0, Math.min(nextX, posterWidth - qrWidth)),
      qrY: Math.max(0, Math.min(nextY, posterHeight - qrHeight))
    }, () => this._updateQrOverlay())
  },

  onQrTouchEnd() { this._qrDrag = null },

  onSwitch(e) {
    var patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value ? 1 : 0
    this.setData(patch)
  },

  onChooseCover() {
    var that = this
    if (that.data.uploadingCover) { return }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        var path = res.tempFiles[0].tempFilePath
        that.setData({ uploadingCover: true })
        data.uploadFilePromise(null, path, '优惠券模板海报', 'image', app.globalData.sessionKey,
          'https://mini.snowmeet.top')
          .then(function (upload) {
            var item = upload && upload.data ? upload.data : upload
            var id = item && (item.id || item.upload_id)
            var url = item && (item.file_path_name || item.url || item.path)
            if (!id || !url) { throw new Error('海报上传结果无效') }
            if (url.indexOf('http') !== 0) {
              url = 'https://mini.snowmeet.top' + url
            }
            that.setData({ coverUploadId: id, coverUrl: url, uploadingCover: false })
            that._setPosterPreviewRatio(url)
            wx.showToast({ title: '海报已上传', icon: 'success' })
          }).catch(function () {
            that.setData({ uploadingCover: false })
          })
      }
    })
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

  // 统一日期控件（date-range-picker）single 模式回的是 { date }，不是原生 picker 的 { value }
  onExpireDateChange(e) {
    this.setData({ expireDate: e.detail.date })
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
    if (!that.data.bizType) {
      wx.showToast({ title: '请选择业务类型', icon: 'none' })
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
      valid: that.data.valid,
      sharable: that.data.sharable,
      coverUploadId: that.data.coverUploadId,
      posterWidth: parseInt(that.data.posterWidth, 10) || 1080,
      posterHeight: parseInt(that.data.posterHeight, 10) || 1440,
      qrX: parseInt(that.data.qrX, 10) || 0,
      qrY: parseInt(that.data.qrY, 10) || 0,
      qrWidth: parseInt(that.data.qrWidth, 10) || 240,
      qrHeight: parseInt(that.data.qrHeight, 10) || 240
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

  // ── 分享发券（员工发券途径之二）────────────────────────────────
  //
  // 微信分不出卡片是「发给个人」还是「发到群」——onShareAppMessage 是同一个 API，
  // 发给谁是店员在微信自己的面板里选的，小程序拿不到结果。所以只能让店员**先选模式**。
  //
  // 「分享给好友」：调接口按模板生成一张待领取的券，卡片带券码，与顾客转赠同一条领取链路。
  // 「分享到群」和朋友圈：使用模板海报叠加本次批次的动态公众号二维码。

  // 两个按钮都是 open-type="share"，点谁只是置个模式标记，
  // 真正的分享由微信在 onShareAppMessage 里取内容
  onShareFriendTap() {
    if (this.data.sharable !== 1) { return }
    this.setData({ shareMode: 'personal' })
  },

  onGroupQrModeTap(e) {
    this.setData({ groupQrMode: e.currentTarget.dataset.mode })
  },

  // 「分享」卡片里的三个子区各自独立开合，不做互斥手风琴
  onShareSectionTap(e) {
    var key = e.currentTarget.dataset.key
    var open = this.data.shareOpen || {}
    var patch = {}
    patch['shareOpen.' + key] = !open[key]
    this.setData(patch)
  },

  onShareGroupTap() {
    var that = this
    if (that.data.generatingGroupPoster || that.data.sharable !== 1) { return }
    if (!that.data.coverUploadId) {
      wx.showToast({ title: '请先上传并保存分享海报', icon: 'none' })
      return
    }
    that.setData({ generatingGroupPoster: true })
    var createBatch = that.data.groupQrMode === 'static'
      ? data.createQrCodeBatchPromise(that.data.id, '群分享', app.globalData.sessionKey)
      : data.shareTicketTemplatePromise(that.data.id, 'group', app.globalData.sessionKey)
    createBatch.then(function (res) {
      return data.generateTicketPosterPromise(res.batchId, app.globalData.sessionKey)
    }).then(function (poster) {
      return that._downloadPoster(poster.url)
    }).then(function (filePath) {
      that.setData({ generatingGroupPoster: false })
      wx.showShareImageMenu({ path: filePath, fail: function () {} })
      that.loadShareBatches()
    }).catch(function () {
      that.setData({ generatingGroupPoster: false })
    })
  },

  _downloadPoster(url) {
    return new Promise(function (resolve, reject) {
      wx.downloadFile({
        url: url,
        success: function (res) {
          if (res.statusCode !== 200) { reject(res); return }
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function () { resolve(res.tempFilePath) },
            fail: function () { resolve(res.tempFilePath) }
          })
        },
        fail: reject
      })
    })
  },

  loadShareBatches() {
    var that = this
    if (that.data.id <= 0) { return }
    data.getMyShareBatchesPromise(that.data.id, app.globalData.sessionKey,
      that.data.batchStartDate, that.data.batchEndDate).then(function (res) {
      that.setData({ shareBatches: (res && res.items) || [] })
    }).catch(function () {})
  },

  onBatchDateChange(e) {
    this.setData({
      batchStartDate: e.detail.startDate,
      batchEndDate: e.detail.endDate
    })
    this.loadShareBatches()
  },

  onRevokeBatch(e) {
    var that = this
    var b = that.data.shareBatches[Number(e.currentTarget.dataset.idx)]
    if (!b || !b.canRevoke) { return }
    wx.showModal({
      title: '撤回这次分享',
      content: '撤回后这张卡片就领不了了。已经被领走的券不受影响，收不回来。',
      success: function (res) {
        if (!res.confirm) { return }
        data.revokeShareBatchPromise(b.batchId, app.globalData.sessionKey).then(function () {
          that.loadShareBatches()
        }).catch(function () {})
      }
    })
  },

  onShareAppMessage() {
    var that = this
    // 不是从分享按钮进来的（比如右上角菜单转发），不发券
    var mode = that.data.shareMode
    if ((mode !== 'personal' && mode !== 'group') || that.data.sharable !== 1 || that.data.id <= 0) {
      return {}
    }
    that.setData({ shareMode: '' })
    return data.shareTicketTemplatePromise(that.data.id, mode, app.globalData.sessionKey)
      .then(function (res) {
        // 分享动作已经建了批次，刷一下列表，店员能立刻看到并在需要时撤回
        that.loadShareBatches()
        return data.generateTicketPosterPromise(res.batchId, app.globalData.sessionKey).then(function (poster) {
          return {
          title: '送你一张' + (res.templateName || that.data.name),
          path: res.sharePath,
            imageUrl: poster.url
          }
        })
      }).catch(function () {
        return {}
      })
  },

  onShareTimeline() {
    if (!this.data.timelinePosterUrl || !this.data.timelineSharePath) {
      wx.showToast({ title: '海报正在准备，请稍后再试', icon: 'none' })
      return {}
    }
    return {
      title: '送你一张' + this.data.name,
      query: this.data.timelineSharePath.split('?')[1] || '',
      imageUrl: this.data.timelinePosterUrl
    }
  },

  _prepareTimelineShare() {
    var that = this
    if (that.data.id <= 0 || that.data.sharable !== 1 || !that.data.coverUploadId
      || that.data.timelinePreparing || that.data.timelinePosterUrl) { return }
    that.setData({ timelinePreparing: true })
    data.shareTicketTemplatePromise(that.data.id, 'group', app.globalData.sessionKey)
      .then(function (res) {
        return data.generateTicketPosterPromise(res.batchId, app.globalData.sessionKey).then(function (poster) {
          that.setData({
            timelineSharePath: res.sharePath,
            timelinePosterUrl: poster.url,
            timelinePreparing: false
          })
        })
      }).catch(function () {
        that.setData({ timelinePreparing: false })
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
    // 商品列表按业务线过滤，没选业务类型就没法列
    if (!this.data.bizType) {
      wx.showToast({ title: '请先选择业务类型', icon: 'none' })
      return
    }
    this.setData({ rulePanel: 'product' })
    this.loadProducts()
  },

  onProductKeywordInput(e) {
    this.setData({ productKeyword: e.detail.value })
  },

  loadProducts() {
    var that = this
    that.setData({ productLoading: true })
    data.getTicketRuleProductOptionsPromise(
      that.data.bizType, that.data.productKeyword, app.globalData.sessionKey)
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
