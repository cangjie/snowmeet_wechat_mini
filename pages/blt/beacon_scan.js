// pages/blt/beacon_scan.js
// 蓝牙 Beacon 扫描：实时拉附近 BLE 设备 + 识别 iBeacon 广播 + 显示 RSSI 信号强度
//
// 关键点：
//   1. 双扫描路径并行运行（同一页面同时扫两套数据），合并到同一个设备列表：
//      A) wx.startBluetoothDevicesDiscovery + wx.onBluetoothDeviceFound（通用 BLE）
//         - 两个平台都有效；Android 能从 advertisData 里解析出 iBeacon 字段
//         - iOS 系统层过滤掉 iBeacon ManufacturerData → A 路径在 iOS 上识别不到 iBeacon
//      B) wx.startBeaconDiscovery + wx.onBeaconUpdate（CoreLocation 路径，iBeacon 专用）
//         - iOS / Android 都有效；底层走 CoreLocation，能拿 accuracy / proximity
//         - 必须事先知道要扫的 UUID 列表（Apple 平台硬约束），所以 UI 上有 textarea 让用户填
//         - 没填 UUID 时只跑 A 路径，iOS 拿不到 iBeacon
//   2. wx.startBluetoothDevicesDiscovery 的 allowDuplicatesKey:true 让同一设备的 RSSI 持续回调，
//      不开则只触发一次。Beacon 测距/定位场景必须开。
//   3. wx.onBluetoothDeviceFound 一秒可能回调几十次，直接 setData 会卡顿，
//      用 200ms 节流（_scheduleRender + _renderTimer）。
//   4. iBeacon 在 BLE 广播的 ManufacturerData 段（device.advertisData）里，格式：
//        bytes 0-1   : 4C 00   Apple Company ID（小端）
//        byte  2     : 02      iBeacon 类型
//        byte  3     : 15      后续长度 = 21
//        bytes 4-19  : UUID     16 bytes
//        bytes 20-21 : major   big-endian
//        bytes 22-23 : minor   big-endian
//        byte  24    : txPower signed int8（校准 1m 处的 RSSI，用于估距）
//   5. 去重：A、B 两路径可能同时报同一个 iBeacon（Android 上常见），用 `iBeacon:UUID:major:minor`
//      作为 map key 合并；非 iBeacon 的普通 BLE 设备用 `device.deviceId` 作 key。
//      合并后单条记录里：txPower 来自 A，accuracy/proximity 来自 B，rssi 用最新那次回调的值。
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

// 解析 textarea 输入的 UUID 列表：支持换行 / 逗号 / 空格分隔，自动 trim+uppercase，过滤格式非法的
const UUID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
function parseUuids(raw) {
  if (!raw) return []
  const parts = String(raw).split(/[\s,;]+/)
  const valid = []
  for (let i = 0; i < parts.length; i++) {
    const u = parts[i].trim().toUpperCase()
    if (u && UUID_REGEX.test(u)) valid.push(u)
  }
  return valid
}

// wx.onBeaconUpdate 给回的 proximity 是数字枚举，转中文方便看
function proximityLabel(p) {
  if (p === 1) return '极近'
  if (p === 2) return '近'
  if (p === 3) return '远'
  return '未知'
}

// iBeacon 在内部 _devicesMap 里的 key：保证 A/B 两路径合并到同一行
function iBeaconKey(uuid, major, minor) {
  return 'iBeacon:' + (uuid || '').toUpperCase() + ':' + major + ':' + minor
}

// 默认 UUID：业务侧 2026-05-30 指定的部署 beacon 标识，开页就预填好
// 原始 32 hex → 标准 8-4-4-4-12 拆分，换行分隔
const DEFAULT_UUIDS = [
  'ABF41F06-161C-4A74-99B3-6E5307278F00',  // 0112233445566778899AABBCCDDEEFF0
  'D0722C00-614F-4DA4-9102-25AFDD337F22'   // 0112233445566778899AABBCCDDEEFF1
].join('\n')

Page({
  data: {
    scanning: false,
    error: '',
    warn: '',                  // 软警告（如 startBeaconDiscovery 失败，但 BLE 仍在扫）
    onlyBeacon: false,
    uuids: DEFAULT_UUIDS,      // textarea 原始字符串，默认填业务部署的 UUID
    validUuidCount: 2,         // 解析后合法 UUID 数（与上面默认值保持一致）
    devices: []                // 渲染列表（已排序去重）
  },

  // ---------- 生命周期 ----------
  onLoad() {
    // 用实例字段（不进 data）避免 setData 开销
    this._devicesMap = {}      // key -> { rssi, lastSeen, beacon, name, ... }；key 见 iBeaconKey()
    this._foundHandler = null  // 保留引用以便 offBluetoothDeviceFound 解绑
    this._beaconHandler = null // wx.onBeaconUpdate 的回调引用
    this._renderTimer = null
    this._validUuids = []      // 当前扫描使用的 UUID 列表（startScan 时定下来，扫描期间不变）
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

  // textarea 输入 UUID：每次输入都实时算合法 UUID 数显示给用户
  // 注意：扫描期间改 UUID 不立即生效（startBeaconDiscovery 不支持热切换），
  //       需要用户停止后再开始才会用新的 UUID 列表
  onUuidsInput(e) {
    const raw = e.detail.value
    const valid = parseUuids(raw)
    this.setData({ uuids: raw, validUuidCount: valid.length })
  },

  // ---------- 扫描启动/停止 ----------
  _startScan() {
    const that = this
    that.setData({ error: '', warn: '' })
    // 用户输入的 UUID 列表在 startScan 时定下来；扫描期间改 textarea 不立即生效
    that._validUuids = parseUuids(that.data.uuids)

    wx.openBluetoothAdapter({
      success() {
        wx.getBluetoothAdapterState({
          success(state) {
            if (!state.available) {
              that.setData({ error: '蓝牙不可用，请打开手机蓝牙后重试' })
              return
            }
            const startBLE = () => {
              wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: true,   // 持续回调让 RSSI 实时刷新
                powerLevel: 'high',         // 提高扫描频率（iOS 自动忽略此参数，Android 提速）
                success() {
                  that._foundHandler = function (res) { that._onDeviceFound(res) }
                  wx.onBluetoothDeviceFound(that._foundHandler)
                  that.setData({ scanning: true })
                  // BLE 起来后再起 CoreLocation 路径（B 路径），UUID 非空才启
                  that._startBeaconAPI()
                },
                fail(err) {
                  console.warn('startBluetoothDevicesDiscovery failed', err)
                  that.setData({ error: '启动扫描失败：' + (err.errMsg || JSON.stringify(err)) })
                }
              })
            }
            // 已在扫的话先停一下，避免句柄重叠
            if (state.discovering) {
              wx.stopBluetoothDevicesDiscovery({ complete: startBLE })
            } else {
              startBLE()
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

  // 启动 iBeacon 专用扫描（B 路径，CoreLocation）。没填合法 UUID 直接跳过，仅 BLE 路径运行
  _startBeaconAPI() {
    const that = this
    if (!that._validUuids || that._validUuids.length === 0) {
      // 没填 UUID 时，iOS 上完全识别不到 iBeacon —— 给个软提示而不报错
      // （Android 上 BLE 路径解析 advertisData 还能识别，无 UUID 也能用）
      that.setData({ warn: '未填 UUID。iOS 上将无法识别 iBeacon（仅显示通用 BLE 设备）；Android 仍可通过广播数据识别。' })
      return
    }
    wx.startBeaconDiscovery({
      uuids: that._validUuids,
      ignoreBluetoothAvailable: false,
      success() {
        that._beaconHandler = function (res) { that._onBeaconUpdate(res) }
        wx.onBeaconUpdate(that._beaconHandler)
      },
      fail(err) {
        // beacon 路径失败不阻断 BLE 路径；只在 warn 显示
        console.warn('startBeaconDiscovery failed', err)
        that.setData({ warn: 'iBeacon 扫描启动失败（仍可扫通用 BLE）：' + (err.errMsg || JSON.stringify(err)) })
      }
    })
  },

  _stopScan() {
    const that = this
    // 拆 BLE 路径
    if (this._foundHandler) {
      try { wx.offBluetoothDeviceFound(this._foundHandler) } catch (e) {}
      this._foundHandler = null
    }
    // 拆 CoreLocation iBeacon 路径
    if (this._beaconHandler) {
      try { wx.offBeaconUpdate(this._beaconHandler) } catch (e) {}
      this._beaconHandler = null
    }
    if (this._renderTimer) {
      clearTimeout(this._renderTimer)
      this._renderTimer = null
    }
    // 两路径都 stop（没起的那条 SDK 会自动 noop / 静默失败）
    wx.stopBeaconDiscovery({ complete: function () {} })
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
    if (this._beaconHandler) {
      try { wx.offBeaconUpdate(this._beaconHandler) } catch (e) {}
      this._beaconHandler = null
    }
    if (this._renderTimer) {
      clearTimeout(this._renderTimer)
      this._renderTimer = null
    }
    wx.stopBeaconDiscovery({ complete: function () {} })
    wx.stopBluetoothDevicesDiscovery({
      complete() {
        wx.closeBluetoothAdapter({})
      }
    })
  },

  // ---------- 设备回调 ----------
  // A 路径：通用 BLE 扫描的回调
  _onDeviceFound(res) {
    const now = Date.now()
    const list = (res && res.devices) || []
    let changed = false
    for (let i = 0; i < list.length; i++) {
      const d = list[i]
      const rawDeviceId = d.deviceId
      if (!rawDeviceId) continue
      const beacon = parseIBeacon(d.advertisData)
      // 关键：如果本设备是 iBeacon，用 iBeaconKey 而不是 deviceId 作 map key，
      // 让 B 路径（CoreLocation）报的同一个 iBeacon 能合并到同一行
      const key = beacon ? iBeaconKey(beacon.uuid, beacon.major, beacon.minor) : rawDeviceId
      const prev = this._devicesMap[key] || { firstSeen: now, name: '' }
      const name = d.name || d.localName || prev.name
      // 合并字段：B 路径独有的 accuracy/proximity 不能被 A 路径覆盖成 undefined
      const mergedBeacon = beacon ? {
        uuid: beacon.uuid,
        major: beacon.major,
        minor: beacon.minor,
        txPower: beacon.txPower,
        accuracy: prev.beacon ? prev.beacon.accuracy : null,
        proximity: prev.beacon ? prev.beacon.proximity : null
      } : prev.beacon || null
      this._devicesMap[key] = {
        deviceId: rawDeviceId,                       // 显示用：BLE 路径拿到的设备 ID
        name: name,
        rssi: d.RSSI,
        firstSeen: prev.firstSeen || now,
        lastSeen: now,
        beacon: mergedBeacon,
        source: prev.source === 'both' || prev.source === 'B' ? 'both' : 'A'
      }
      changed = true
    }
    if (changed) this._scheduleRender()
  },

  // B 路径：CoreLocation iBeacon 扫描的回调
  // res.beacons: [{ uuid, major, minor, rssi, accuracy, proximity }]
  // proximity: 0=未知 / 1=极近 / 2=近 / 3=远
  // accuracy: 距离米数（系统估算，仅参考；负值表示无法估算）
  _onBeaconUpdate(res) {
    const now = Date.now()
    const beacons = (res && res.beacons) || []
    let changed = false
    for (let i = 0; i < beacons.length; i++) {
      const b = beacons[i]
      const uuid = (b.uuid || '').toUpperCase()
      if (!uuid) continue
      const key = iBeaconKey(uuid, b.major, b.minor)
      const prev = this._devicesMap[key] || { firstSeen: now, name: 'iBeacon' }
      // 合并：txPower 是 A 路径独有的（从广播数据切出来），保留之前 A 路径报过的
      const mergedBeacon = {
        uuid: uuid,
        major: b.major,
        minor: b.minor,
        txPower: prev.beacon ? prev.beacon.txPower : null,
        accuracy: (typeof b.accuracy === 'number') ? b.accuracy : null,
        proximity: (typeof b.proximity === 'number') ? b.proximity : null
      }
      this._devicesMap[key] = {
        deviceId: prev.deviceId || '(CoreLocation)',  // iOS 这条路径不返 BLE deviceId，用占位
        name: prev.name || 'iBeacon',
        rssi: b.rssi,
        firstSeen: prev.firstSeen || now,
        lastSeen: now,
        beacon: mergedBeacon,
        source: prev.source === 'both' || prev.source === 'A' ? 'both' : 'B'
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
    // 用 entry 的 map key 兼作 wx:key，保证两路径合并到同一行后稳定渲染
    for (const k in this._devicesMap) {
      if (!Object.prototype.hasOwnProperty.call(this._devicesMap, k)) continue
      arr.push({ _mapKey: k, entry: this._devicesMap[k] })
    }
    if (onlyBeacon) {
      arr = arr.filter(function (x) { return !!x.entry.beacon })
    }
    // RSSI 越大越好（-30 强 / -90 弱）；按降序排，缺失的丢底部
    arr.sort(function (a, b) {
      const ra = (a.entry.rssi == null) ? -999 : a.entry.rssi
      const rb = (b.entry.rssi == null) ? -999 : b.entry.rssi
      return rb - ra
    })
    const decorated = arr.map(function (x) {
      const d = x.entry
      const beacon = d.beacon
      // accuracy 仅 B 路径有；负值（系统估算失败）当 null
      const accuracy = (beacon && typeof beacon.accuracy === 'number' && beacon.accuracy >= 0)
        ? Math.round(beacon.accuracy * 100) / 100
        : null
      const proximity = (beacon && typeof beacon.proximity === 'number')
        ? proximityLabel(beacon.proximity)
        : ''
      return {
        key: x._mapKey,
        name: d.name || '(未命名设备)',
        deviceId: d.deviceId,
        rssi: d.rssi,
        rssiBars: rssiBars(d.rssi),
        hasBeacon: !!beacon,
        uuid: beacon ? beacon.uuid : '',
        major: beacon ? beacon.major : '',
        minor: beacon ? beacon.minor : '',
        txPower: (beacon && typeof beacon.txPower === 'number') ? beacon.txPower : '',
        accuracy: accuracy,                  // null 表示无（A 路径只跑时）
        proximity: proximity,                // ''  表示无
        source: d.source || '',              // 'A' | 'B' | 'both'，用于显示来源
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
