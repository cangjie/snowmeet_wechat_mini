// 食材过期提醒 · 新建/编辑/详情页。对标网页版 wwwroot/fnb/mat_expire/new.html。
// 字段联动规则（生产日期+保质期→到期日自动推算、同名食材默认值、编辑模式老数据反推 produce_date）
// 原样搬运，不精简。
const app = getApp()
const data = require('../../../../utils/data.js')
const matExpire = require('../../../../utils/matExpire.js')
const util = require('../../../../utils/util.js')
// 2026-07-21：图片改为统一落 snowmeet.wanlonghuaxue.com（与养护开单 care_order_detail.js 的
// IMG_HOST 同一套域名），不再跟随 app.globalData.domainName（mini.snowmeet.top）
const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com'

Page({
  data: {
    editId: 0,
    pageTitle: '录入批次',
    saveBtnText: '保存并加入提醒',
    form: {
      name: '',
      batch_no: '',
      produce_date: '',
      shelf_value: '',
      unit: '天',
      expire_date: '',
      warn_days: 3,
    },
    autoTag: false,
    photos: [],
    uploadingCount: 0,
    saveDisabled: true,
    warnHint: '到期前 3 天进入临期提醒',
    preview: { show: false, cls: '', title: '', meta: '' },
    opsShow: false,
    opDoneShow: true,
    opScrapShow: true,
    scan: { show: false, mode: 'all' },
    printShow: false,
    printBatch: null,
  },

  async onLoad(options) {
    // 页面级实例状态（不进 data，纯记账用，仿 care_order_detail.js 的 this._uiState 写法）
    this._allBatches = null   // 新建模式：全量批次，供同名食材带出上次保质期/预警天数
    this._shelfAutoFilled = false // 保质期当前值是自动带出的（可被新的同名匹配覆盖）；用户手输后清除
    this._warnTouched = false     // 预警天数被用户手动改过后，同名匹配不再覆盖
    this._nameTimer = null
    this._curName = ''            // 删除确认文案用
    this._todayStr = matExpire.fmtDate(new Date()) // 预览仅展示用，落库判定以服务端为准

    await app.loginPromiseNew

    // 标签二维码「扫普通链接二维码打开小程序」进入时，原始 URL 在 options.q（URL-encoded），
    // 仿 care_order_detail.js 的双入口解析：优先 q，取不到再退回正常 navigateTo 的 options.id
    var id = 0
    if (options.q) {
      id = parseInt(util.parseQuery(options.q, 'id'), 10) || 0
    }
    if (!id) id = parseInt(options.id, 10) || 0
    if (id > 0) {
      this.setData({ editId: id })
      this.loadForEdit(id)
    } else {
      // 生产日期默认今天并真实落值：date 输入框空值时会显得像"已填"的假象，用户以为已填 →
      // 保质期联动不触发。默认真值消除假象；与包装不符时店员自行改
      this.setData({ 'form.produce_date': this._todayStr })
      this._refresh()
      var that = this
      // 拉全量批次供同名食材带出保质期；失败静默降级（不影响录入）
      data.getMatExpireBatchesPromise(app.globalData.sessionKey).then(function (res) {
        that._todayStr = (res && res.today) || that._todayStr
        that._allBatches = (res && res.batches) || []
        that._applyShelfDefault() // 数据回来前用户可能已输完名称，补一次匹配
      }).catch(function () {})
    }
  },

  onHide() {
    // 防止切后台/离开页面时扫描组件的定时器还在对着已隐藏的摄像头空转
    this.setData({ 'scan.show': false })
  },
  onUnload() {
    this.setData({ 'scan.show': false })
  },

  // ---- 编辑模式回填 ----
  loadForEdit(id) {
    var that = this
    data.getMatExpireBatchesPromise(app.globalData.sessionKey).then(function (res) {
      that._todayStr = (res && res.today) || that._todayStr
      var b = ((res && res.batches) || []).find(function (x) { return x.id === id })
      if (!b) {
        wx.showToast({ title: '批次不存在', icon: 'none' })
        return
      }
      that._curName = b.name || ''
      var produce = (b.produce_date || '').slice(0, 10)
      var expire = (b.expire_date || '').slice(0, 10)
      // 存量批次 produce_date 可能为空（旧版页面无默认值）：有保质期时按 到期日−保质期 反推并真实落值，
      // 否则编辑时改保质期没有推算基准、联动不生效
      if (!produce && b.shelf_life_value > 0 && expire) {
        var pd = new Date(expire + 'T00:00:00')
        if (b.shelf_life_unit === '月') { pd.setMonth(pd.getMonth() - b.shelf_life_value) }
        else { pd.setDate(pd.getDate() - b.shelf_life_value) }
        produce = matExpire.fmtDate(pd)
      }
      that.setData({
        pageTitle: '编辑批次',
        saveBtnText: '保存修改',
        opsShow: true,
        // 已处理批次不再显示标记按钮（后端本就幂等，纯 UI 收敛），删除仍可用
        opDoneShow: !b.dispose_status,
        opScrapShow: !b.dispose_status,
        form: {
          name: b.name || '',
          batch_no: b.batch_no || '',
          produce_date: produce,
          shelf_value: b.shelf_life_value == null ? '' : b.shelf_life_value,
          unit: b.shelf_life_unit === '月' ? '月' : '天',
          expire_date: expire,
          warn_days: b.warn_days == null ? 3 : b.warn_days,
        },
        // 回填的到期日是已存值，不标「自动」；用户再动生产日期/保质期时照常重新推算
        autoTag: false,
      })
      that._refresh()
      if (b.image_ids) {
        data.getMatExpireImagesPromise(b.image_ids, app.globalData.sessionKey).then(function (imgs) {
          var photos = (imgs || []).map(function (im) {
            var url = IMG_HOST + im.file_path_name
            return { id: im.id, url: url, thumb: url, status: 'done' }
          })
          that.setData({ photos: photos })
        }).catch(function () {})
      }
    }).catch(function () {})
  },

  // ---- 字段联动 ----

  onNameInput(e) {
    var that = this
    this.setData({ 'form.name': e.detail.value })
    this._refresh()
    clearTimeout(this._nameTimer)
    this._nameTimer = setTimeout(function () { that._applyShelfDefault() }, 600)
  },

  onBatchNoInput(e) {
    this.setData({ 'form.batch_no': e.detail.value })
    this._refresh()
  },

  onProduceChange(e) {
    this.setData({ 'form.produce_date': e.detail.value })
    this._autoExpire()
  },

  onShelfInput(e) {
    this.setData({ 'form.shelf_value': e.detail.value })
    this._shelfAutoFilled = false // 用户手输，之后同名匹配不再覆盖
    this._autoExpire()
  },

  onUnitTap(e) {
    this._setUnit(e.currentTarget.dataset.unit)
  },

  onExpireChange(e) {
    this.setData({ 'form.expire_date': e.detail.value, autoTag: false })
    this._refresh()
  },

  onWarnInput(e) {
    this.setData({ 'form.warn_days': e.detail.value })
    this._warnTouched = true
    this._refresh()
  },

  stepWarn(e) {
    var delta = parseInt(e.currentTarget.dataset.delta, 10)
    var v = parseInt(this.data.form.warn_days, 10)
    if (isNaN(v)) v = 3
    v = Math.max(0, v + delta)
    this.setData({ 'form.warn_days': v })
    this._warnTouched = true
    this._refresh()
  },

  _setUnit(u) {
    this.setData({ 'form.unit': u })
    this._autoExpire()
  },

  // 生产日期 + 保质期 → 到期日。生产日期/保质期/单位任一变化都重新推算，
  // 手动改过的到期日只保留到下一次动这些源字段（动源 = 想重算）
  _autoExpire() {
    var f = this.data.form
    var p = f.produce_date
    var n = parseInt(f.shelf_value, 10)
    if (p && n > 0) {
      var d = new Date(p + 'T00:00:00')
      if (f.unit === '月') { d.setMonth(d.getMonth() + n) } else { d.setDate(d.getDate() + n) }
      this.setData({ 'form.expire_date': matExpire.fmtDate(d), autoTag: true })
    }
    this._refresh()
  },

  // 新建时按名称找同名食材的最近批次（id 最大），带出其 保质期 + 预警提前天数 作默认值。
  // 各字段独立判定：只覆盖「空白/初始默认或此前自动带出」的值，不碰用户手动改过的
  _applyShelfDefault() {
    if (this.data.editId > 0 || !this._allBatches) return
    var name = (this.data.form.name || '').trim()
    if (!name) return
    var hit = null
    this._allBatches.forEach(function (b) {
      if ((b.name || '').trim() === name && (!hit || b.id > hit.id)) hit = b
    })
    if (!hit) return
    var parts = []
    var shelfUnit = null
    var f = this.data.form
    if (hit.shelf_life_value > 0 && (!f.shelf_value || this._shelfAutoFilled)) {
      shelfUnit = hit.shelf_life_unit === '月' ? '月' : '天'
      this.setData({ 'form.shelf_value': hit.shelf_life_value })
      this._shelfAutoFilled = true
      parts.push('保质期 ' + hit.shelf_life_value + ' ' + shelfUnit)
    }
    if (hit.warn_days != null && hit.warn_days >= 0 && !this._warnTouched
        && String(hit.warn_days) !== String(this.data.form.warn_days)) {
      this.setData({ 'form.warn_days': hit.warn_days })
      parts.push('预警提前 ' + hit.warn_days + ' 天')
    }
    if (parts.length === 0) return
    wx.showToast({ title: '已按上次记录默认：' + parts.join(' · '), icon: 'none' })
    if (shelfUnit !== null) {
      this._setUnit(shelfUnit) // 内部触发 _autoExpire → 到期日跟着推算 + refresh
    } else {
      this._refresh() // 只带出预警天数时也要刷新提示文案/状态预览
    }
  },

  _refresh() {
    var f = this.data.form
    var warn = parseInt(f.warn_days, 10)
    if (isNaN(warn) || warn < 0) warn = 0
    var warnHint = '到期前 ' + warn + ' 天进入临期提醒'

    var preview = { show: false, cls: '', title: '', meta: '' }
    var expire = f.expire_date
    if (expire) {
      var st = matExpire.deriveStatus({ expire_date: expire, warn_days: warn, dispose_status: null }, this._todayStr)
      var days = matExpire.daysBetween(this._todayStr, expire)
      var cls = { '已过期': 'expired', '今日': 'today', '临期': 'warning', '正常': 'normal' }[st] || ''
      preview = {
        show: true,
        cls: cls,
        title: '录入后状态：' + st,
        meta: (days < 0 ? '已逾期 ' + (-days) + ' 天' : days === 0 ? '今日到期' : '距到期还有 ' + days + ' 天')
          + ' · 到期 ' + expire.replace(/-/g, '/'),
      }
    }

    var ok = (f.name || '').trim() && (f.batch_no || '').trim() && expire && this.data.uploadingCount === 0
    this.setData({ warnHint: warnHint, preview: preview, saveDisabled: !ok })
  },

  genNo() {
    var that = this
    data.genMatExpireBatchNoPromise(app.globalData.sessionKey).then(function (res) {
      that.setData({ 'form.batch_no': (res && res.batchNo) || '' })
      that._refresh()
    }).catch(function () {})
  },

  // ---- 照片：即传即得（van-uploader，选一张传一张，与 care_order_detail 同款） ----
  onPhotoRead(e) {
    var that = this
    var uploadFile = e.detail.file
    var pending = { id: 0, url: uploadFile.tempFilePath, thumb: uploadFile.thumb || uploadFile.tempFilePath, status: 'uploading', message: '上传中' }
    var photos = (this.data.photos || []).concat([pending])
    this.setData({ photos: photos, uploadingCount: this.data.uploadingCount + 1 })
    this._refresh()
    data.uploadMatExpirePhotoPromise(uploadFile.tempFilePath, app.globalData.sessionKey).then(function (res) {
      var cur = (that.data.photos || []).slice()
      var i = cur.findIndex(function (p) { return p.status === 'uploading' && p.id === 0 && p.url === pending.url })
      var url = IMG_HOST + res.file_path_name
      if (i >= 0) {
        cur[i] = { id: res.id, url: url, thumb: url, status: 'done' }
      }
      that.setData({ photos: cur, uploadingCount: Math.max(0, that.data.uploadingCount - 1) })
      that._refresh()
    }).catch(function () {
      var cur = (that.data.photos || []).slice()
      var i = cur.findIndex(function (p) { return p.status === 'uploading' && p.id === 0 && p.url === pending.url })
      if (i >= 0) cur.splice(i, 1)
      wx.showToast({ title: '照片上传失败', icon: 'none' })
      that.setData({ photos: cur, uploadingCount: Math.max(0, that.data.uploadingCount - 1) })
      that._refresh()
    })
  },

  // 只改本地数组，image_ids 保存时从本地数组现算——和网页版一致，没有独立的删图接口
  onPhotoDelete(e) {
    var idx = e.detail.index
    var cur = (this.data.photos || []).filter(function (p, i) { return i !== idx })
    this.setData({ photos: cur })
    this._refresh()
  },

  // ---- 保存 ----
  save() {
    if (this.data.saveDisabled) return
    var f = this.data.form
    var photos = this.data.photos || []
    var body = {
      id: this.data.editId,
      name: (f.name || '').trim(),
      batch_no: (f.batch_no || '').trim(),
      produce_date: f.produce_date || null,
      shelf_life_value: f.shelf_value ? parseInt(f.shelf_value, 10) : null,
      shelf_life_unit: f.shelf_value ? f.unit : null,
      expire_date: f.expire_date,
      warn_days: Math.max(0, parseInt(f.warn_days, 10) || 0),
      image_ids: photos.length
        ? photos.filter(function (p) { return p.id > 0 }).map(function (p) { return p.id }).join(',')
        : null,
    }
    this.setData({ saveDisabled: true })
    var that = this
    data.saveMatExpireBatchPromise(body, app.globalData.sessionKey).then(function () {
      wx.showToast({ title: '已保存', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 400)
    }).catch(function () {
      that.setData({ saveDisabled: false })
    })
  },

  cancel() {
    wx.navigateBack()
  },

  // ---- 批次操作（编辑模式，与列表页动作面板同一套接口/文案） ----
  doDispose(e) {
    if (!this.data.editId) return
    var action = e.currentTarget.dataset.action
    data.disposeMatExpireBatchPromise(this.data.editId, action, app.globalData.sessionKey).then(function () {
      wx.showToast({ title: '已标记' + action, icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 400)
    }).catch(function () {})
  },

  goBack() {
    wx.navigateBack()
  },

  doDelete() {
    var that = this
    if (!this.data.editId) return
    wx.showModal({
      title: '删除批次',
      content: '删除「' + that._curName + '」？删除后列表不再显示。',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return
        data.deleteMatExpireBatchPromise(that.data.editId, app.globalData.sessionKey).then(function () {
          wx.showToast({ title: '已删除', icon: 'none' })
          setTimeout(function () { wx.navigateBack() }, 400)
        }).catch(function () {})
      },
    })
  },

  // ---- 实时扫描（ocr_scan_layer 组件） ----
  onScanTap(e) {
    this.setData({ scan: { show: true, mode: e.currentTarget.dataset.mode || 'all' } })
  },

  onScanClose() {
    this.setData({ 'scan.show': false })
  },

  // date/expire/shelf 模式：单点即填即关
  onScanFill(e) {
    var d = e.detail
    this.setData({ 'scan.show': false })
    if (d.field === 'produce_date') {
      this.setData({ 'form.produce_date': d.value })
      this._autoExpire() // 生产日期落值 → 有保质期时立即推算到期日
    } else if (d.field === 'expire_date') {
      this.setData({ 'form.expire_date': d.value, autoTag: false }) // 等同手改语义，不反向推算
      this._refresh()
    } else if (d.field === 'shelf') {
      this.setData({ 'form.shelf_value': d.value.value })
      this._shelfAutoFilled = false
      this._setUnit(d.value.unit === '月' ? '月' : '天') // 内部 _autoExpire → 联动到期日 + refresh
    }
  },

  // all 模式：多选名称词拼接 + 可选生产日期，点确认按钮一次性填入
  onScanConfirm(e) {
    var d = e.detail
    this.setData({ 'scan.show': false })
    var patch = {}
    if (d.name) patch['form.name'] = d.name
    if (d.produceDate) patch['form.produce_date'] = d.produceDate
    if (Object.keys(patch).length) this.setData(patch)
    this._autoExpire() // 生产日期落值后立即推算（保质期已有值时）
    if (d.name) this._applyShelfDefault() // 触发同名批次带出保质期/预警
  },

  // ---- 打印标签（仅已保存批次，与 opsShow 同一门控） ----
  onPrintTap() {
    var f = this.data.form
    this.setData({
      printShow: true,
      printBatch: { id: this.data.editId, name: f.name, batch_no: f.batch_no, expire_date: f.expire_date },
    })
  },

  onPrinterClose() {
    this.setData({ printShow: false })
  },
})
