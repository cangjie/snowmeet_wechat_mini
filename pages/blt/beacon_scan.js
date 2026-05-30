// pages/blt/beacon_scan.js
// 蓝牙 Beacon 扫描：实时拉附近 BLE 设备 + 识别 iBeacon 广播 + 显示 RSSI 信号强度
//
// 关键点：
//   1. wx.startBluetoothDevicesDiscovery 的 allowDuplicatesKey:true 让同一设备的 RSSI 持续回调，
//      不开则只触发一次。Beacon 测距/定位场景必须开。
//   2. wx.onBluetoothDeviceFound 一秒可能回调几十次，直接 setData 会卡顿，
//      用 200ms 节流（_scheduleRender + _renderTimer）。
//   3. iBeacon 在 BLE 广播的 ManufacturerData 段（device.advertisData）里，格式：
//        bytes 0-1   : 4C 00   Apple Company ID（小端）
//        byte  2     : 02      iBeacon 类型
//        byte  3     : 15      后续长度 = 21
//        bytes 4-19  : UUID     16 bytes
//        bytes 20-21 : major   big-endian
//        bytes 22-23 : minor   big-endian
//        byte  24    : txPower signed int8（校准 1m 处的 RSSI，用于估距）
//
// 不做之处：
//   * 距离估算（用 RSSI + txPower 推；不同环境衰减系数不同，业务需求才做）
//   * Eddystone 等其它 beacon 协议（Eddystone 在 ServiceData 段而非 ManufacturerData，需要另接口）

const IBEACON_PREFIX = [0x4c, 0x00, 0x02, 0x15]

function abToHex(ab) {
  if (!ab) return ''
  const arr = new Uint8Array(ab)
  let out = ''
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, '0')
  }
  return out
}

// 解析 iBeacon 广播。advertisData 是 ArrayBuffer
function parseIBeacon(advertisData) {
  if (!advertisData || advertisData.byteLength < 25) return null
  const bytes = new Uint8Array(advertisData)
  for (let i = 0; i < IBEACON_PREFIX.length; i++) {
    if (bytes[i] !== IBEACON_PREFIX[i]) return null
  }
  const hex = abToHex(advertisData.slice(4, 20))
  const uuid = (hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20, 32)).toUpperCase()
  const major = (bytes[20] << 8) | bytes[21]
  const minor = (bytes[22] << 8) | bytes[23]
  const tx = bytes[24]
  const txPower = tx > 127 ? tx - 256 : tx
  return { uuid: uuid, major: major, minor: minor, txPower: txPower }
}

// RSSI → 4 档信号格子（-55 满格，-100 没格）
function rssiBars(rssi) {
  if (rssi == null) return 0
  if (rssi >= -55) return 4
  if (rssi >= -70) return 3
  if (rssi >= -85) return 2
  if (rssi >= -100) return 1
  return 0
}

Page({
  data: {
    scanning: false,
    error: '',
    onlyBeacon: false,
    devices: []                // 渲染列表（已排序去重）
  },

  // ---------- 生命周期 ----------
  onLoad() {
    // 用实例字段（不进 data）避免 setData 开销
    this._devicesMap = {}      // deviceId -> { rssi, lastSeen, beacon, name, ... }
    this._foundHandler = null  // 保留引用以便 offBluetoothDeviceFound 解绑
    this._renderTimer = null
  },

  onUnload() {
    this._teardown()
  },

  onHide() {
    // 切到后台不主动停（用户可能去别的页面查 UUID 再回来），但渲染节流定时器要清掉
    if (this._renderTimer) {
      clearTimeout(this._renderTimer)
      this._renderTimer = null
    }
  },

  // ---------- 控件 ----------
  toggleScan() {
    if (this.data.scanning) {
      this._stopScan()
    } else {
      this._startScan()
    }
  },

  toggleOnlyBeacon(e) {
    this.setData({ onlyBeacon: e.detail.value }, () => this._render())
  },

  clearDevices() {
    this._devicesMap = {}
    this.setData({ devices: [] })
  },

  // ---------- 扫描启动/停止 ----------
  _startScan() {
    const that = this
    that.setData({ error: '' })
    wx.openBluetoothAdapter({
      success() {
        wx.getBluetoothAdapterState({
          success(state) {
            if (!state.available) {
              that.setData({ error: '蓝牙不可用，请打开手机蓝牙后重试' })
              return
            }
            const start = () => {
              wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: true,   // 持续回调让 RSSI 实时刷新
                powerLevel: 'high',         // 提高扫描频率（iOS 自动忽略此参数，Android 提速）
                success() {
                  that._foundHandler = function (res) { that._onDeviceFound(res) }
                  wx.onBluetoothDeviceFound(that._foundHandler)
                  that.setData({ scanning: true })
                },
                fail(err) {
                  console.warn('startBluetoothDevicesDiscovery failed', err)
                  that.setData({ error: '启动扫描失败：' + (err.errMsg || JSON.stringify(err)) })
                }
              })
            }
            // 已在扫的话先停一下，避免句柄重叠
            if (state.discovering) {
              wx.stopBluetoothDevicesDiscovery({ complete: start })
            } else {
              start()
            }
          },
          fail(err) {
            that.setData({ error: '读取蓝牙状态失败：' + (err.errMsg || JSON.stringify(err)) })
          }
        })
      },
      fail(err) {
        // errCode 10001 = 蓝牙未开 / 用户未授权
        const msg = err.errCode === 10001
          ? '蓝牙未开启或定位权限被拒（Android 需打开定位才能扫 BLE）'
          : ('初始化蓝牙失败：' + (err.errMsg || JSON.stringify(err)))
        that.setData({ error: msg })
      }
    })
  },

  _stopScan() {
    const that = this
    if (this._foundHandler) {
      try { wx.offBluetoothDeviceFound(this._foundHandler) } catch (e) {}
      this._foundHandler = null
    }
    if (this._renderTimer) {
      clearTimeout(this._renderTimer)
      this._renderTimer = null
    }
    wx.stopBluetoothDevicesDiscovery({
      complete() {
        that.setData({ scanning: false })
      }
    })
  },

  // onUnload 时彻底拆，包括 closeBluetoothAdapter；不依赖 setData（页面快要销毁）
  _teardown() {
    if (this._foundHandler) {
      try { wx.offBluetoothDeviceFound(this._foundHandler) } catch (e) {}
      this._foundHandler = null
    }
    if (this._renderTimer) {
      clearTimeout(this._renderTimer)
      this._renderTimer = null
    }
    wx.stopBluetoothDevicesDiscovery({
      complete() {
        wx.closeBluetoothAdapter({})
      }
    })
  },

  // ---------- 设备回调 ----------
  _onDeviceFound(res) {
    const now = Date.now()
    const list = (res && res.devices) || []
    let changed = false
    for (let i = 0; i < list.length; i++) {
      const d = list[i]
      const key = d.deviceId
      if (!key) continue
      const beacon = parseIBeacon(d.advertisData)
      const prev = this._devicesMap[key] || { firstSeen: now, name: '' }
      // 设备名可能某次回调为空，保留之前抓到的名字
      const name = d.name || d.localName || prev.name
      this._devicesMap[key] = {
        deviceId: key,
        name: name,
        rssi: d.RSSI,
        firstSeen: prev.firstSeen || now,
        lastSeen: now,
        beacon: beacon
      }
      changed = true
    }
    if (changed) this._scheduleRender()
  },

  // 节流：onBluetoothDeviceFound 高频回调（200~500ms / 设备），合并到 200ms 一次 setData
  _scheduleRender() {
    if (this._renderTimer) return
    const that = this
    this._renderTimer = setTimeout(function () {
      that._renderTimer = null
      that._render()
    }, 200)
  },

  _render() {
    const onlyBeacon = this.data.onlyBeacon
    const now = Date.now()
    let arr = []
    for (const k in this._devicesMap) {
      if (!Object.prototype.hasOwnProperty.call(this._devicesMap, k)) continue
      arr.push(this._devicesMap[k])
    }
    if (onlyBeacon) {
      arr = arr.filter(function (d) { return !!d.beacon })
    }
    // RSSI 越大越好（-30 强 / -90 弱）；按降序排，缺失的丢底部
    arr.sort(function (a, b) {
      const ra = (a.rssi == null) ? -999 : a.rssi
      const rb = (b.rssi == null) ? -999 : b.rssi
      return rb - ra
    })
    const decorated = arr.map(function (d) {
      return {
        key: d.deviceId,
        name: d.name || '(未命名设备)',
        deviceId: d.deviceId,
        rssi: d.rssi,
        rssiBars: rssiBars(d.rssi),
        hasBeacon: !!d.beacon,
        uuid: d.beacon ? d.beacon.uuid : '',
        major: d.beacon ? d.beacon.major : '',
        minor: d.beacon ? d.beacon.minor : '',
        txPower: d.beacon ? d.beacon.txPower : '',
        agoSec: Math.max(0, Math.round((now - d.lastSeen) / 1000))
      }
    })
    this.setData({ devices: decorated })
  },

  // ---------- 工具 ----------
  copyUuid(e) {
    const uuid = e.currentTarget.dataset.uuid
    if (!uuid) return
    wx.setClipboardData({
      data: uuid,
      success() { wx.showToast({ title: 'UUID 已复制', icon: 'success' }) }
    })
  }
})
