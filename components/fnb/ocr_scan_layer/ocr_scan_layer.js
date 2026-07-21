// 食材过期提醒：实时连续扫描组件。
// 对标网页版 wwwroot/fnb/mat_expire/new.html 的 getUserMedia+canvas 每 1.3s 抓帧识别；
// 小程序无法直接搬 getUserMedia，改用 <camera> 组件 + CameraContext.takePhoto() 定时轮询
// （takePhoto 直接吐 JPEG 文件，不需要手工搭 onCameraFrame 的原始像素→JPEG 编码管线）。
//
// 对外契约：
//   properties: show(Boolean) mode(String: 'all'|'date'|'expire'|'shelf')
//   events: bind:fill {field,value} / bind:confirm {name,produceDate} / bind:close
// 组件自己管：摄像头生命周期、定时抓拍+OCR调用、候选/日期/保质期 chip 状态、选中态暂停、
// 30 秒无结果自动停止抓拍（取景界面仍开着）。是否关闭扫描层（show=false）由父页面在
// bind:fill/bind:confirm/bind:close 的处理函数里决定——组件本身不擅自改自己的 show prop。
var data = require('../../../utils/data.js')

var CAPTURE_INTERVAL_MS = 1500   // 比网页版 1300ms 略保守：takePhoto 写文件+读 base64 比 canvas.toDataURL 多一层开销，真机测完可调
var PHOTO_QUALITY = 'normal'     // 对应网页版 JPEG quality 0.7 的取舍
// 摄像头预览/输出分辨率写在 WXML <camera resolution="medium">，此处仅作说明:
// medium 替代网页版手工限宽 1000px 的画布降采样逻辑，这条路径不需要手工降采样

Component({
  properties: {
    show: { type: Boolean, value: false },
    mode: { type: String, value: 'all' },
  },

  data: {
    tip: '',
    chips: [],
    confirmVisible: false,
    confirmText: '',
    permState: 'unknown', // 'unknown' | 'denied'
  },

  lifetimes: {
    attached() {
      this._cameraCtx = null
      this._timer = null
      this._busy = false
      this._picked = []       // 已选名称词，按点击顺序拼接（all 模式）
      this._pickedDate = null // all 模式顺带选中的生产日期
      this._lastCands = []
      this._lastDates = []
      this._lastExpireDates = []
      this._lastShelfLives = []
      this._deadline = 0
    },
    detached() {
      this._stopTimer()
    },
  },

  observers: {
    show: function (v) {
      if (v) {
        this._checkPermAndStart()
      } else {
        this._stopTimer()
      }
    },
  },

  methods: {
    _checkPermAndStart() {
      var that = this
      wx.getSetting({
        success: (res) => {
          if (res.authSetting && res.authSetting['scope.camera'] === false) {
            that.setData({ permState: 'denied' })
            return
          }
          that.setData({ permState: 'unknown' })
          that._startScan()
        },
        fail: () => {
          that.setData({ permState: 'unknown' })
          that._startScan()
        },
      })
    },

    _startScan() {
      if (!this._cameraCtx) {
        // CameraContext 必须传 this 绑定到组件内部的 <camera>，否则会指向一个不存在的
        // 页面级摄像头，takePhoto() 全部静默失败
        this._cameraCtx = wx.createCameraContext(this)
      }
      this._busy = false
      this._picked = []
      this._pickedDate = null
      this._lastCands = []
      this._lastDates = []
      this._lastExpireDates = []
      this._lastShelfLives = []
      this._deadline = Date.now() + 30000

      var mode = this.data.mode
      var initTip = mode === 'date' ? '对准包装上的生产日期'
        : mode === 'expire' ? '对准包装上的到期日期 / 保质期标注'
        : mode === 'shelf' ? '对准包装上的保质期标注'
        : '对准食材包装上的名称'
      this.setData({ tip: initTip, chips: [], confirmVisible: false, confirmText: '' })

      this._stopTimer()
      var that = this
      this._timer = setInterval(function () { that._capture() }, CAPTURE_INTERVAL_MS)
    },

    _stopTimer() {
      if (this._timer) {
        clearInterval(this._timer)
        this._timer = null
      }
    },

    // 有任何选择即暂停抓帧（候选固定不跳动、省 OCR 调用）；全部取消则恢复识别并重置超时
    _syncPause() {
      if (this._picked.length > 0 || this._pickedDate) {
        this._stopTimer()
      } else if (!this._timer && this.data.show) {
        this._deadline = Date.now() + 30000
        var that = this
        this._timer = setInterval(function () { that._capture() }, CAPTURE_INTERVAL_MS)
      }
    },

    _capture() {
      if (this._busy || !this.data.show) return
      if (Date.now() > this._deadline) {
        this.setData({ tip: '未识别到结果，可换角度重试或关闭后手动输入' })
        this._stopTimer()
        return
      }
      if (!this._cameraCtx) return
      var that = this
      this._busy = true
      this._cameraCtx.takePhoto({
        quality: PHOTO_QUALITY,
        success: (res) => {
          var fs = wx.getFileSystemManager()
          var b64
          try {
            // readFileSync(path,'base64') 返回值本身不带 data: 前缀，可直接传给 OcrScanName
            b64 = fs.readFileSync(res.tempImagePath, 'base64')
          } catch (e) {
            that._busy = false
            return
          }
          var app = getApp()
          data.ocrScanMatExpirePromise(b64, app.globalData.sessionKey).then((r) => {
            that._onResult(r || {})
            that._busy = false
          }).catch(() => {
            // 单帧失败静默，继续下一帧（同网页版 captureFrame 的 catch 空实现）
            that._busy = false
          })
        },
        fail: () => {
          that._busy = false
        },
      })
    },

    _onResult(res) {
      if (!this.data.show) return
      var candidates = res.candidates || []
      var dates = res.dates || []
      var expireDates = res.expireDates || []
      var shelfLives = res.shelfLives || []
      if (candidates.length > 0) {
        this._lastCands = candidates.map(function (c) { return c.text })
      }
      if (dates.length > 0) this._lastDates = dates
      if (expireDates.length > 0) this._lastExpireDates = expireDates
      if (shelfLives.length > 0) this._lastShelfLives = shelfLives
      this._renderChips()
    },

    // 名称：已选固定在前（带序号）；日期：📅 chip；保质期：⏳ chip；未选候选随帧刷新。
    // date/expire/shelf 模式只显示各自候选；expire 模式带到期锚词的日期优先
    _renderChips() {
      var mode = this.data.mode
      var texts = mode !== 'all'
        ? []
        : this._picked.concat(this._lastCands.filter((t) => this._picked.indexOf(t) < 0))
      var dateSrc = mode === 'shelf' ? []
        : (mode === 'expire'
          ? (this._lastExpireDates.length > 0 ? this._lastExpireDates : this._lastDates)
          : this._lastDates)
      var dates = (this._pickedDate && dateSrc.indexOf(this._pickedDate) < 0 ? [this._pickedDate] : []).concat(dateSrc)
      var shelfs = mode === 'shelf' ? this._lastShelfLives : []
      if (texts.length === 0 && dates.length === 0 && shelfs.length === 0) return

      var tip = (this._picked.length > 0 || this._pickedDate)
        ? '继续点选，完成后点下方按钮填入'
        : (mode === 'shelf' ? '点 ⏳ 保质期直接填入'
          : (mode === 'expire'
            ? (this._lastExpireDates.length > 0 ? '已识别到期标注，点 📅 日期直接填入' : '点 📅 到期日期直接填入')
            : (mode === 'date' ? '点 📅 生产日期直接填入' : '点选名称词（可多选拼接）和 📅 生产日期')))

      var chips = []
      texts.forEach((t) => {
        var i = this._picked.indexOf(t)
        chips.push({ key: 'n:' + t, kind: 'name', cls: '', on: i >= 0, label: (i >= 0 ? '(' + (i + 1) + ') ' : '') + t })
      })
      dates.forEach((d) => {
        chips.push({ key: 'd:' + d, kind: 'date', cls: 'date', on: this._pickedDate === d, label: '📅 ' + d })
      })
      shelfs.forEach((sl) => {
        chips.push({
          key: 's:' + sl.value + '|' + sl.unit, kind: 'shelf', cls: 'shelf', on: false,
          label: '⏳ ' + sl.value + ' ' + (sl.unit === '月' ? '个月' : '天'),
        })
      })

      var parts = []
      if (this._picked.length > 0) parts.push(this._picked.join(''))
      if (this._pickedDate) parts.push('生产日期 ' + this._pickedDate)

      this.setData({
        tip: tip,
        chips: chips,
        confirmVisible: mode === 'all' && parts.length > 0,
        confirmText: parts.length > 0 ? '填入：' + parts.join(' · ') : '',
      })
    },

    onChipTap(e) {
      var kind = e.currentTarget.dataset.kind
      var key = e.currentTarget.dataset.key
      var mode = this.data.mode

      if (kind === 'shelf') {
        var p = key.slice(2).split('|')
        this.triggerEvent('fill', { field: 'shelf', value: { value: p[0], unit: p[1] } })
        return
      }
      if (kind === 'date') {
        var d = key.slice(2)
        if (mode === 'date') {
          this.triggerEvent('fill', { field: 'produce_date', value: d })
          return
        }
        if (mode === 'expire') {
          this.triggerEvent('fill', { field: 'expire_date', value: d })
          return
        }
        // all 模式：单选切换，随名称一起确认
        this._pickedDate = this._pickedDate === d ? null : d
        this._syncPause()
        this._renderChips()
        return
      }
      // kind === 'name'，仅 all 模式会出现
      var t = key.slice(2)
      var i = this._picked.indexOf(t)
      if (i >= 0) this._picked.splice(i, 1)
      else this._picked.push(t)
      this._syncPause()
      this._renderChips()
    },

    // 确认按钮仅 all 模式（名称扫描）使用：多选拼接名称 + 顺带选中的生产日期一起填入
    onConfirmTap() {
      if (this._picked.length === 0 && !this._pickedDate) return
      this.triggerEvent('confirm', { name: this._picked.join(''), produceDate: this._pickedDate || null })
    },

    onCloseTap() {
      this.triggerEvent('close', {})
    },

    onCameraError(e) {
      console.warn('mat_expire scan camera error', e)
      this.setData({ permState: 'denied' })
      this._stopTimer()
    },

    onCameraStop(e) {
      console.warn('mat_expire scan camera stopped', e)
      this._stopTimer()
    },

    onOpenSetting() {
      var that = this
      wx.openSetting({
        success: (res) => {
          if (res.authSetting && res.authSetting['scope.camera']) {
            that.setData({ permState: 'unknown' })
            that._startScan()
          }
        },
      })
    },
  },
})
