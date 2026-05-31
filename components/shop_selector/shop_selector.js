// components/shop_selector/shop_selector.js
//
// 自动选店逻辑（2026-05-31 重构）：
//   defaultShop 显式传 → 直接定位选中
//   否则 → 蓝牙扫附近 beacon，命中 shop_list 中 beacon_mac / beacon_uuid 的店即选中（取首批最大 RSSI）
//   30 秒超时 / 蓝牙错误 / 权限拒绝 / 全店未配 beacon → fallback：staff.base_shop_id → 列表第一家
//
// 双路径并行扫描（参考 pages/blt/beacon_scan.js）：
//   A 通用 BLE：deviceId 跟 beacon_mac 比对（Android 命中，iOS 系统隐藏真 MAC 恒不命中）
//   B CoreLocation iBeacon：uuid 跟 beacon_uuid 比对（iOS + Android 通用，但 uuids 必填）
//
// 关键点：
//   - 首批命中即停扫 + 关蓝牙（节能、避免蓝牙残留）
//   - 错误不弹 toast（开单页频繁进入，定位失败属正常情况）
const app = getApp()
const util = require('../../utils/util.js')

const SCAN_TIMEOUT_MS = 30 * 1000

// 去冒号/空格 + 大写。Android wx 回调的 deviceId 通常是 "AA:BB:CC:DD:EE:FF" 格式，
// DB 字段约定同格式，但代码两边归一防止偶发空格/小写
function _normalizeMac(s) {
  return String(s || '').replace(/[\s:\-]/g, '').toUpperCase()
}

// UUID：trim + 大写。DB 约定 8-4-4-4-12 大写
function _normalizeUuid(s) {
  return String(s || '').trim().toUpperCase()
}

// fallback 链：staff.base_shop_id → 列表第一家 → null
function _resolveFallbackShop(shopList) {
  var staff = app.globalData && app.globalData.staff
  if (staff && staff.base_shop_id && shopList) {
    for (var i = 0; i < shopList.length; i++) {
      if (shopList[i].id === staff.base_shop_id) return shopList[i]
    }
  }
  return shopList && shopList.length > 0 ? shopList[0] : null
}

Component({
  properties: {
    defaultShop: {
      type: String,
      value: ''
    },
    scene: {
      type: String,
      value: ''
    }
  },

  data: {
    currentSelectedIndex: 0
  },

  lifetimes: {
    ready: function () {
      var that = this
      app.loginPromiseNew.then(function () {
        var url = app.globalData.requestPrefix + 'Order/GetShops'
        util.performWebRequest(url, undefined).then(function (shopList) {
          var name_list = []
          if (!that.properties.scene || that.properties.scene == null || that.properties.scene == '') {
            name_list.push('全部店铺')
          }
          for (var i = 0; i < shopList.length; i++) {
            name_list.push(shopList[i].name)
          }
          that.setData({ shop_list: shopList, name_list: name_list })

          // defaultShop 显式命中 → 直接选中（不扫蓝牙）
          var defaultShop = that.getShop(that.properties.defaultShop)
          if (defaultShop != null) {
            for (var j = 0; j < name_list.length; j++) {
              if (name_list[j] == that.properties.defaultShop) {
                that.setData({ currentSelectedIndex: j })
                break
              }
            }
            that._applySelectedShop(defaultShop, -1)
            return
          }

          // 未指定 defaultShop（或指定但找不到）→ 走 beacon 自动定位
          that._autoSelectByBeacon(shopList)
        }).catch(function () {
          // GetShops 失败：无法 fallback（没列表可挑），event 不发，由调用方处理空状态
        })
      })
    },

    detached: function () {
      // 组件销毁时停扫，防止离开开单页后蓝牙残留
      this._stopScan()
    }
  },

  methods: {
    selectChanged: function (e) {
      var that = this
      that.setData({ currentSelectedIndex: e.detail.value })

      if (e.detail.value == 0 && that.properties.scene != 'recept') {
        that.triggerEvent('ShopSelected', { shop: '', sale: 0, care: 0, rent: 0, restuarant: 0 })
        return
      }
      var shop = that.getShop(that.data.name_list[e.detail.value])
      if (shop) {
        that.triggerEvent('ShopSelected', { shop: shop.name, sale: shop.sale, care: shop.care, rent: shop.rent, restuarant: shop.restuarant })
      }
    },

    getShop(name) {
      var shopList = this.data.shop_list
      if (!shopList) return null
      for (var i = 0; i < shopList.length; i++) {
        if (shopList[i].name == name) {
          return shopList[i]
        }
      }
      return null
    },

    // 选店落地：setData 当前索引 + 万龙系互换 + triggerEvent
    _applySelectedShop(shop, idx) {
      if (!shop) return
      if (idx >= 0) this.setData({ currentSelectedIndex: idx })
      else {
        var name_list = this.data.name_list || []
        for (var i = 0; i < name_list.length; i++) {
          if (name_list[i] == shop.name) {
            this.setData({ currentSelectedIndex: i })
            break
          }
        }
      }
      // 沿用旧版万龙互换逻辑：选中店和店员 base_shop 同属"万龙系"时按店员的店落地
      var shopName = shop.name
      var staff = app.globalData && app.globalData.staff
      if (shopName.indexOf('万龙') >= 0
        && staff && staff.shop && staff.shop.name
        && staff.shop.name.indexOf('万龙') >= 0) {
        shopName = staff.shop.name
      }
      this.triggerEvent('ShopSelected', {
        shop: shopName,
        sale: shop.sale, rent: shop.rent, care: shop.care, restuarant: shop.restuarant
      })
    },

    // 走 fallback：staff.base_shop_id → 列表第一家
    _fallback(shopList) {
      var shop = _resolveFallbackShop(shopList)
      if (shop) this._applySelectedShop(shop, -1)
    },

    // 双路径 beacon 扫描自动选店
    _autoSelectByBeacon(shopList) {
      var that = this

      // 构 mac/uuid 映射表（跳过未配的店）
      var macMap = {}   // normalize MAC → shop
      var uuidShopMap = {}  // normalize UUID → shop
      var uuidList = []
      var anyBeaconConfigured = false
      for (var i = 0; i < shopList.length; i++) {
        var s = shopList[i]
        if (s.beacon_mac) {
          macMap[_normalizeMac(s.beacon_mac)] = s
          anyBeaconConfigured = true
        }
        if (s.beacon_uuid) {
          var u = _normalizeUuid(s.beacon_uuid)
          uuidShopMap[u] = s
          // wx.startBeaconDiscovery 要求 uuids 是标准格式（含连字符），按 DB 原样转大写传
          uuidList.push(u)
          anyBeaconConfigured = true
        }
      }

      // 全店都没配 beacon → 不开蓝牙，直接 fallback
      if (!anyBeaconConfigured) {
        that._fallback(shopList)
        return
      }

      // 实例字段（不进 data，避免 setData 开销 + 帧间稳定）
      that._scanShopList = shopList
      that._beaconHitMap = {}  // shopId → max RSSI
      that._foundHandler = null
      that._beaconHandler = null
      that._scanActive = true
      that._scanTimeoutTimer = setTimeout(function () {
        // 30 秒兜底：无任何命中 → 走 fallback
        if (!that._scanActive) return
        that._stopScan()
        that._fallback(shopList)
      }, SCAN_TIMEOUT_MS)

      wx.openBluetoothAdapter({
        success: function () {
          wx.getBluetoothAdapterState({
            success: function (state) {
              if (!state.available) {
                that._stopScan()
                that._fallback(shopList)
                return
              }
              var startBLE = function () {
                wx.startBluetoothDevicesDiscovery({
                  allowDuplicatesKey: true,
                  powerLevel: 'high',
                  success: function () {
                    that._foundHandler = function (res) { that._onDeviceFound(res, macMap) }
                    wx.onBluetoothDeviceFound(that._foundHandler)
                    // BLE 起来后再起 B 路径 CoreLocation（uuidList 非空才启）
                    if (uuidList.length > 0) {
                      wx.startBeaconDiscovery({
                        uuids: uuidList,
                        ignoreBluetoothAvailable: false,
                        success: function () {
                          that._beaconHandler = function (res) { that._onBeaconUpdate(res, uuidShopMap) }
                          wx.onBeaconUpdate(that._beaconHandler)
                        },
                        fail: function () {
                          // B 路径失败不阻断 A 路径
                        }
                      })
                    }
                  },
                  fail: function () {
                    that._stopScan()
                    that._fallback(shopList)
                  }
                })
              }
              if (state.discovering) {
                wx.stopBluetoothDevicesDiscovery({ complete: startBLE })
              } else {
                startBLE()
              }
            },
            fail: function () {
              that._stopScan()
              that._fallback(shopList)
            }
          })
        },
        fail: function () {
          // errCode 10001 = 蓝牙未开 / 用户拒绝定位权限
          that._stopScan()
          that._fallback(shopList)
        }
      })
    },

    // A 路径：通用 BLE 回调，按 deviceId 比 mac
    _onDeviceFound: function (res, macMap) {
      if (!this._scanActive) return
      var devices = (res && res.devices) || []
      for (var i = 0; i < devices.length; i++) {
        var d = devices[i]
        if (!d.deviceId) continue
        var key = _normalizeMac(d.deviceId)
        var shop = macMap[key]
        if (shop) {
          var prev = this._beaconHitMap[shop.id]
          if (prev == null || d.RSSI > prev) {
            this._beaconHitMap[shop.id] = d.RSSI
          }
        }
      }
      this._finalizeIfHit()
    },

    // B 路径：CoreLocation iBeacon 回调，按 uuid 比
    _onBeaconUpdate: function (res, uuidShopMap) {
      if (!this._scanActive) return
      var beacons = (res && res.beacons) || []
      for (var i = 0; i < beacons.length; i++) {
        var b = beacons[i]
        var uuid = _normalizeUuid(b.uuid)
        if (!uuid) continue
        var shop = uuidShopMap[uuid]
        if (shop) {
          var prev = this._beaconHitMap[shop.id]
          if (prev == null || b.rssi > prev) {
            this._beaconHitMap[shop.id] = b.rssi
          }
        }
      }
      this._finalizeIfHit()
    },

    // 首批命中即停扫：选 _beaconHitMap 中 RSSI 最大那家
    _finalizeIfHit: function () {
      if (!this._scanActive) return
      var hits = this._beaconHitMap
      var bestShopId = null
      var bestRssi = null
      for (var sid in hits) {
        if (!Object.prototype.hasOwnProperty.call(hits, sid)) continue
        if (bestRssi == null || hits[sid] > bestRssi) {
          bestRssi = hits[sid]
          bestShopId = sid
        }
      }
      if (bestShopId == null) return
      var shopList = this._scanShopList || []
      var picked = null
      for (var i = 0; i < shopList.length; i++) {
        if (String(shopList[i].id) === String(bestShopId)) {
          picked = shopList[i]
          break
        }
      }
      this._stopScan()
      if (picked) {
        this._applySelectedShop(picked, -1)
      } else {
        this._fallback(shopList)
      }
    },

    _stopScan: function () {
      this._scanActive = false
      if (this._foundHandler) {
        try { wx.offBluetoothDeviceFound(this._foundHandler) } catch (e) {}
        this._foundHandler = null
      }
      if (this._beaconHandler) {
        try { wx.offBeaconUpdate(this._beaconHandler) } catch (e) {}
        this._beaconHandler = null
      }
      if (this._scanTimeoutTimer) {
        clearTimeout(this._scanTimeoutTimer)
        this._scanTimeoutTimer = null
      }
      try { wx.stopBeaconDiscovery({ complete: function () {} }) } catch (e) {}
      try {
        wx.stopBluetoothDevicesDiscovery({
          complete: function () {
            try { wx.closeBluetoothAdapter({}) } catch (e) {}
          }
        })
      } catch (e) {}
    }
  }
})
