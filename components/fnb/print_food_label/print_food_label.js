// components/fnb/print_food_label/print_food_label.js
// 食材过期提醒·标签打印：复用 utils/ble_label_printer/tsc.js（TSPL 生成，二维码由打印机固件原生
// 渲染）+ utils/util.js 的通用蓝牙 Promise（与 components/care/print_care_label.js 底层同款，
// 两个文件都不改动）。与养护标签"自动挑一台默认打印机（红/黄业务规则）"不同，这里按需求实现
// "搜到就连、连上第一台就用"的重试循环——print_care_label.js 里等价逻辑是注释掉的死代码
// （print_care_label.js:178-182），这里是写活的。
const data = require('../../../utils/data.js')
const util = require('../../../utils/util.js')
var tsc = require('../../../utils/ble_label_printer/tsc.js')

// 60x40mm 标签，按 200dpi（1mm=8dots，画布 480x320dots）保守假设设计——猜错方向的后果不对称：
// 若真机实际分辨率更高，内容只会偏小不会出边；反过来会导致二维码超出标签物理边缘被裁掉。
// 真机确认实际 dpi 后如需要，整体等比例缩放这些坐标即可，不需要重写。
// 2026-07-21 由 30x20mm 改为 60x40mm：字体/二维码同步整体放大一倍（保持原设计的字符数上限
// 不变，但每个字符/模块的物理尺寸翻倍，更易读、更好扫）——所有坐标/尺寸都是旧版数值 ×2：
// 二维码 cellWidth 3→6（41 模块见方 ≈ 30.75mm，占标签 40mm 高度约 77%，与旧版占比一致）；
// 中文字体 TSS16.BF2(16×16dots)→TSS32.BF2(32×32dots)，与养护标签默认字体同规格
// （print_care_label.js:190 非"Printer_"打印机时的字体）；数字英文字体 code 1(8×12dots)→
// code 3(16×24dots)，均为 tsc.js 里现成的字号，非新增字体。
const LABEL_WIDTH_MM = 60
const LABEL_HEIGHT_MM = 40
const LABEL_GAP_MM = 2 // 占位值，需真机核实标签介质（间隙纸/黑标纸）后调整；与标签内容尺寸无关，不随本次放大变化
const QR_X = 218
const QR_Y = 36
const QR_CELL_WIDTH = 6
const QR_URL_PREFIX = 'https://mini.snowmeet.top/mapp/fnb/mat_detail?id='

function truncate(str, maxLen) {
  str = str || ''
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + '…'
}

Component({
  properties: {
    batch: Object, // { id, name, batch_no, expire_date }
  },

  data: {
    availablePrinters: [],
    connected: false,
    ready: false,
    printing: false,
    statusText: '正在搜索打印机…',
    copies: '1', // 字符串存储，允许输入过程中的中间态（如清空重打），真正校验在 _resolveCopies()
  },

  lifetimes: {
    ready() {
      var that = this
      that._connectingIndex = null
      that._connectedDevice = null
      data.getAllPrintersPromise().then(function (printers) {
        util.getBLEDeviceNameListInRangePromise().then(function (list) {
          var availablePrinters = []
          for (var i = 0; i < printers.length; i++) {
            for (var j = 0; j < list.devices.length; j++) {
              if (list.devices[j].name.indexOf(printers[i].name) >= 0 && list.devices[j].connectable == true) {
                var printer = list.devices[j]
                printer.printer = printers[i]
                printer.status = '未连接'
                availablePrinters.push(printer)
              }
            }
          }
          that.setData({ availablePrinters: availablePrinters })
          if (availablePrinters.length <= 0) {
            that.setData({ statusText: '未搜索到打印机' })
            wx.showToast({ title: '未搜索到打印机', icon: 'none' })
            return
          }
          that._connectingIndex = 0
          that._tryConnect()
        }).catch(function () {
          that.setData({ statusText: '蓝牙搜索失败，请检查蓝牙是否开启' })
        })
      }).catch(function () {
        that.setData({ statusText: '获取打印机列表失败' })
      })
    },
    detached() {
      this._closeCurrentConnection()
      wx.stopBluetoothDevicesDiscovery()
    },
  },

  methods: {
    // 搜到就连、连上第一台就用：按顺序尝试 availablePrinters，成功即停止，全部失败才报错
    _tryConnect() {
      var that = this
      var idx = this._connectingIndex
      var printers = this.data.availablePrinters
      if (idx == null || idx >= printers.length) {
        this.setData({ statusText: '未能连接到任何打印机，可在下方手动重试' })
        wx.showToast({ title: '连接打印机失败', icon: 'none' })
        return
      }
      var printer = printers[idx]
      printer.status = '连接中'
      this.setData({ availablePrinters: printers, statusText: '正在连接 ' + printer.printer.name + '…' })
      util.connectBLEPromise(printer.deviceId).then(function (device) {
        that._connectedDevice = device
        var list = that.data.availablePrinters
        list[idx].status = '已连接'
        that.setData({ availablePrinters: list, connected: true, ready: true, statusText: '已连接 ' + printer.printer.name })
      }).catch(function () {
        var list = that.data.availablePrinters
        if (list[idx]) {
          list[idx].status = '连接失败'
        }
        that.setData({ availablePrinters: list })
        wx.closeBLEConnection({ deviceId: printer.deviceId })
        that._connectingIndex = idx + 1
        that._tryConnect()
      })
    },

    _closeCurrentConnection() {
      if (this._connectedDevice) {
        wx.closeBLEConnection({ deviceId: this._connectedDevice.deviceId })
        this._connectedDevice = null
      }
    },

    // 手动断开（兜底 UI：自动连接失败、或想换一台打印机时用）
    disconnectDevice(e) {
      var that = this
      var idx = parseInt(e.currentTarget.id, 10)
      var printers = this.data.availablePrinters
      var printer = printers[idx]
      wx.closeBLEConnection({
        deviceId: printer.deviceId,
        complete: function () {
          printer.status = '未连接'
          that._connectedDevice = null
          that.setData({ availablePrinters: printers, connected: false, ready: false, statusText: '已断开' })
        },
      })
    },

    // 手动连接（兜底 UI）
    connectDeviceManual(e) {
      var idx = parseInt(e.currentTarget.id, 10)
      this._closeCurrentConnection()
      this._connectingIndex = idx
      this.setData({ connected: false, ready: false })
      this._tryConnect()
    },

    // 打印份数：输入框允许中间态（清空/删光重打），此处才是唯一校验点——非正整数兜底为 1，上限 99 防误触多打
    _resolveCopies() {
      var v = parseInt(this.data.copies, 10)
      if (isNaN(v) || v < 1) v = 1
      if (v > 99) v = 99
      return v
    },

    onCopiesInput(e) {
      this.setData({ copies: e.detail.value })
    },

    getCommand(copies) {
      var b = this.properties.batch || {}
      var name = truncate(b.name, 5)
      var batchNo = truncate(b.batch_no, 11)
      var expire = (b.expire_date || '').slice(0, 10)
      var url = QR_URL_PREFIX + (b.id || 0).toString()

      var command = tsc.jpPrinter.createNew()
      command.setCls() // 清除缓冲区，防止上一次没生效
      command.setSize(LABEL_WIDTH_MM, LABEL_HEIGHT_MM)
      command.setGap(LABEL_GAP_MM)
      command.setCls()
      command.setText(16, 16, 'TSS32.BF2', 0, 1, 1, name) // 名称（需要中文）
      command.setText(16, 120, '3', 0, 1, 1, batchNo) // 批次号（纯 ASCII，用数字英文字体腾空间）
      command.setText(16, 200, '3', 0, 1, 1, expire) // 到期日期（同上）
      command.setQrcode(QR_X, QR_Y, 'L', QR_CELL_WIDTH, 'M', url)
      // setPrint(n) 是 tsc.js 里现成的"打印 n 份缓冲区内容"指令（setPagePrint() 只是 n=1 的特例），
      // 份数由打印机固件自己重复出纸，BLE 只需传一遍缓冲区，不用像养护标签那样整份重发
      command.setPrint(copies)
      return command.getData()
    },

    print() {
      if (!this.data.ready || !this._connectedDevice) {
        wx.showToast({ title: '打印机未连接', icon: 'none' })
        return
      }
      var copies = this._resolveCopies()
      var buff = this.getCommand(copies)
      this.setData({ printing: true, copies: String(copies) })
      this._sendBuff([...buff], 0)
    },

    // 单份缓冲区分片发送（份数由打印机端 setPrint(n) 处理，不需要养护标签那套逐份重发的记账），
    // 128 字节一片递归写入
    _sendBuff(buff, offset) {
      var that = this
      var CHUNK = 128
      var end = Math.min(offset + CHUNK, buff.length)
      var chunk = buff.slice(offset, end)
      var buf = new ArrayBuffer(chunk.length)
      var dataView = new DataView(buf)
      for (var i = 0; i < chunk.length; i++) {
        dataView.setUint8(i, chunk[i])
      }
      var device = this._connectedDevice
      wx.writeBLECharacteristicValue({
        deviceId: device.deviceId,
        serviceId: device.writeServiceId,
        characteristicId: device.writeUUID,
        value: buf,
        success: function () {},
        fail: function () {
          that.setData({ printing: false })
          wx.showToast({ title: '打印失败', icon: 'none' })
        },
        complete: function () {
          if (end < buff.length) {
            that._sendBuff(buff, end)
          } else {
            that.setData({ printing: false })
            wx.showToast({ title: '已发送打印 × ' + that.data.copies + ' 份' })
          }
        },
      })
    },
  },
})
