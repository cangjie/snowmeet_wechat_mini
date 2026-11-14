// components/shop_selector/shop_selector.js
//
// 自动选店逻辑（2026-05-31 重构 + 2026-05-30 重写为平台分支）：
//   defaultShop 显式传 → 直接定位选中
//   否则 → 按平台选不同的扫描方案：
//     • Android: 只跑 wx.startBluetoothDevicesDiscovery（A 路径）
//                deviceId = 真 MAC，advertisData 含 iBeacon manufacturer 数据
//                回调里**同时**按 MAC 比 beacon_mac、按 advertisData 解析的 UUID 比 beacon_uuid
//                完全跳过 CoreLocation（省电、不弹定位权限）
//     • iOS:    只跑 wx.startBeaconDiscovery + onBeaconUpdate（B 路径，CoreLocation）
//                按 UUID 比 beacon_uuid（iOS 上 BLE 通用扫描对我们没用：deviceId 是假 MAC，
//                iBeacon manufacturer data 被系统过滤）
//                完全跳过 BLE 通用扫描（省电）
//     • devtools / 未知平台: 跑 iOS 那条（仅 CoreLocation）作 demo，反正 devtools 无真蓝牙
//
//   首批命中即停扫 + 立即 _applySelectedShop 选中
//
// 失败 / 兜底分支：
//   - 全店未配 beacon → 静默 _fallback（staff.base_shop_id → 万龙服务中心 → 列表第一家），不打扰
//   - scene='recept'（开单入口）：列表首项是「请选择门店」，**不默认选店**（2026-10-22 用户要求，
//     取代 2026-07-08 的开扫前先落默认店）：扫描期间首项显示「正在识别附近门店…」，beacon 命中才选中；
//     没命中（未配 beacon / 蓝牙不可用 / 超时）就停在「请选择门店」，由店员手动选，业务入口在选店前保持灰
//   - iOS 上 startBeaconDiscovery 失败（多为定位权限/精确位置关）→ 弹 toast 提示用户去 iOS 设置改
//   - Android openBluetoothAdapter 失败（蓝牙未开/权限拒）→ 静默 _fallback
//   - 30 秒超时（扫了但全程没命中） → 弹 toast「未检测到店内 beacon  配置:N / BLE:M / iBeacon:K」
//                                    （recept 场景改为提示手动选择门店）+ 不再改选
//
// 区域（show-area，2026-11-14 起，只给查询 / 报表页用，规则见 utils/shop_area.js）：
//   门店行上面多一行「区域」checkbox（万龙 / 旗舰，默认都勾 = 不限区域），门店下拉按勾选的区域过滤；
//   区域=万龙 + 全部门店 → ShopSelected 的 shop 是 '万龙服务中心,万龙体验中心'（后端按逗号联合查询）。
//   beacon 识别到万龙任一家 → 只勾万龙 + 全部门店；识别到崇礼旗舰店 → 只勾旗舰；识别失败 / 没配 beacon → 按员工基地店推断
//   （基地店 → 它的区域 + 全部门店；不属于任何区域的店 → 区域不限 + 选中该店）。show-area 时不再做「万龙互换成基地店」。
//   不开 show-area 的页面（开单入口、租赁设置等把门店当写入目标的页面）行为不变。
//
// 已经有选定的门店时 beacon 识别必须终止（2026-11-14 用户要求，识别结果会改掉已选的门店）：
//   店员手动选门店、勾选 / 取消勾选区域（哪怕门店列表还没回来）、页面在组件启动后才给出门店（defaultShop 变化，
//   AI 查询 / 草稿恢复）都算「已经选定」，立刻停扫并记下（_hasSelection）；之后启动扫描、识别命中、兜底、失败回调
//   一律不再改选。识别或兜底自动选过一次之后同理。
const app = getApp()
const util = require('../../utils/util.js')
const shopArea = require('../../utils/shop_area.js')

const SCAN_TIMEOUT_MS = 30 * 1000

// 系统级默认店铺：staff 没有基地店（或基地店不在列表里）时的兜底默认（用户拍板 2026-07-08）
const DEFAULT_SHOP_NAME = '万龙服务中心'

// 开单场景（scene='recept'）列表首项：不默认选店，beacon 没命中就让店员手动选
const RECEPT_PLACEHOLDER = '请选择门店'
const RECEPT_SCANNING = '正在识别附近门店…'

// 去冒号/空格 + 大写。Android wx 回调的 deviceId 通常是 "AA:BB:CC:DD:EE:FF" 格式，
// DB 字段约定同格式，但代码两边归一防止偶发空格/小写
function _normalizeMac(s) {
  return String(s || '').replace(/[\s:\-]/g, '').toUpperCase()
}

// UUID 归一：trim → 去掉所有连字符 → 大写 → 按 8-4-4-4-12 重新插连字符
//   - 微信 wx.startBeaconDiscovery 在 iOS 上**严格要求** 8-4-4-4-12 格式，无连字符直接 "invalid service uuid"
//   - 但 beacon 配置软件 / DB 通常只存 32 hex 无连字符（厂商配置软件不接受连字符输入）
//   - 同样 wx.onBeaconUpdate 回的 uuid 是标准格式带连字符，统一归一后双向都好匹配
//   - 输入是 32 hex 或 36 字符带连字符都接收；输入非法（其它长度/含非 hex 字符）则原样返大写让上游报错
function _normalizeUuid(s) {
  if (!s) return ''
  var clean = String(s).trim().toUpperCase().replace(/-/g, '')
  if (!/^[0-9A-F]{32}$/.test(clean)) {
    return String(s).trim().toUpperCase()
  }
  return clean.slice(0, 8) + '-' + clean.slice(8, 12) + '-' + clean.slice(12, 16) + '-' + clean.slice(16, 20) + '-' + clean.slice(20, 32)
}

// 平台检测：返 'ios' | 'android' | 'devtools' | 其它字符串
function _getPlatform() {
  try {
    var info = wx.getSystemInfoSync()
    return ((info && info.platform) || '').toLowerCase()
  } catch (e) {
    return ''
  }
}

// 解析 iBeacon 广播。Android 的 advertisData 段含 25 字节 manufacturer data：
//   bytes 0-3   : 4C 00 02 15   Apple Company ID + iBeacon 类型 + 长度
//   bytes 4-19  : UUID（16 字节）
//   bytes 20-21 : major (BE)
//   bytes 22-23 : minor (BE)
//   bytes 24    : txPower（signed int8）
// 不是 iBeacon 格式或长度不够返 null。Android A 路径回调里用来从普通 BLE 设备里
// 拣出 iBeacon 然后按 UUID 跟 beacon_uuid 匹配（不依赖 beacon_mac 配置）
function _parseIBeacon(advertisData) {
  if (!advertisData || advertisData.byteLength < 25) return null
  var bytes = new Uint8Array(advertisData)
  if (bytes[0] !== 0x4c || bytes[1] !== 0x00 || bytes[2] !== 0x02 || bytes[3] !== 0x15) return null
  var hex = ''
  for (var i = 4; i < 20; i++) hex += bytes[i].toString(16).padStart(2, '0')
  var uuid = (hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20, 32)).toUpperCase()
  return {
    uuid: uuid,
    major: (bytes[20] << 8) | bytes[21],
    minor: (bytes[22] << 8) | bytes[23]
  }
}

// fallback 链：staff.base_shop_id → 万龙服务中心(DEFAULT_SHOP_NAME) → 列表第一家 → null
function _resolveFallbackShop(shopList) {
  var staff = app.globalData && app.globalData.staff
  if (staff && staff.base_shop_id && shopList) {
    for (var i = 0; i < shopList.length; i++) {
      if (shopList[i].id === staff.base_shop_id) return shopList[i]
    }
  }
  if (shopList) {
    for (var j = 0; j < shopList.length; j++) {
      if (shopList[j].name === DEFAULT_SHOP_NAME) return shopList[j]
    }
  }
  return shopList && shopList.length > 0 ? shopList[0] : null
}

Component({
  // 区域行 / 门店行的样式类由宿主页面传入（各页的筛选行样式不同）：row-class 套在每一行，label-class 是行首文字，value-class 是右侧控件
  externalClasses: ['row-class', 'label-class', 'value-class'],

  properties: {
    defaultShop: {
      type: String,
      value: '',
      // 页面在组件启动之后才给出门店：已经有选定的门店，终止识别（门店列表还没回来时 ready 会按最新值处理）
      observer: function (value) { this._onDefaultShopChanged(value) }
    },
    scene: {
      type: String,
      value: ''
    },
    // 是否显示「区域」行（查询 / 报表页用）；为 true 时组件自己渲染「区域」和「门店」两行
    showArea: {
      type: Boolean,
      value: false
    },
    // 区域行 / 门店行的行首文字（页面的其它标签带【】时可以传「【区域】」「【门店】」）
    areaLabel: { type: String, value: '区域' },
    shopLabel: { type: String, value: '门店' }
  },

  data: {
    currentSelectedIndex: 0,
    areaWanlong: true,
    areaFlagship: true
  },

  lifetimes: {
    ready: function () {
      var that = this
      app.loginPromiseNew.then(function () {
        var url = app.globalData.requestPrefix + 'Order/GetShops'
        util.performWebRequest(url, undefined).then(function (shopList) {
          that.setData({ shop_list: shopList })
          var name_list = that._buildNameList(shopList)
          that.setData({ name_list: name_list })

          // 门店列表回来之前店员已经动过区域：不再扫描、不再套用默认，按店员的选择出结果
          if (that._hasSelection) {
            if (that.properties.showArea) that._emitSelection()
            return
          }

          // AI/跨页查询显式要求“全部门店”（旧页面传的是“全部店铺”）时，不启动 beacon 自动选店，
          // 避免页面结果被异步缩小到员工基地店。
          if (shopArea.isAllLabel(that.properties.defaultShop) && !that.properties.scene) {
            if (that.properties.showArea) {
              that._setAreas(shopArea.AREAS)
              that.setData({ currentSelectedIndex: 0 })
              that._emitSelection()
              return
            }
            that.setData({ currentSelectedIndex: 0 })
            that.triggerEvent('ShopSelected', { shop: '', sale: 0, care: 0, rent: 0, restuarant: 0 })
            return
          }

          // defaultShop 显式命中 → 直接选中（不扫蓝牙）
          var defaultShop = that.getShop(that.properties.defaultShop)
          if (defaultShop != null) {
            if (that.properties.showArea) {
              that._applyChosenShop(defaultShop)
              return
            }
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
      // 用户手动选择必须优先：立即停掉可能仍在后台跑的自动定位扫描（beacon 命中是异步的，
      // 若不停掉，稍后命中会通过 _finalizeIfHit → _applySelectedShop 静默覆盖这次手动选择，
      // 且「万龙互换逻辑」会把结果换成店员自己的基地店，与手动选的店不一致）
      that._markSelected()
      that.setData({ currentSelectedIndex: e.detail.value })

      // 带区域行的页面：门店 + 勾选的区域一起决定对外发出的 shop
      if (that.properties.showArea) {
        that._emitSelection()
        return
      }

      // 首项是「全部门店」（无 scene）或「请选择门店」（开单场景），都表示没有选定门店
      if (e.detail.value == 0 && (!that.properties.scene || that.properties.scene === 'recept')) {
        that.triggerEvent('ShopSelected', { shop: '', sale: 0, care: 0, rent: 0, restuarant: 0 })
        return
      }
      var shop = that.getShop(that.data.name_list[e.detail.value])
      if (shop) {
        that.triggerEvent('ShopSelected', { shop: shop.name, sale: shop.sale, care: shop.care, rent: shop.rent, restuarant: shop.restuarant })
      }
    },

    // 门店下拉的名单：首项（全部门店 / 请选择门店）+ 门店；带区域行时只列勾选区域里的门店
    _buildNameList(shopList) {
      var name_list = []
      var scene = this.properties.scene
      if (!scene) {
        name_list.push(shopArea.ALL_LABEL)
      } else if (scene === 'recept') {
        name_list.push(RECEPT_PLACEHOLDER)
      }
      var shops = this.properties.showArea ? shopArea.shopsForAreas(shopList, this._checkedAreas()) : shopList
      for (var i = 0; i < shops.length; i++) {
        name_list.push(shops[i].name)
      }
      return name_list
    },

    _checkedAreas() {
      var areas = []
      if (this.data.areaWanlong) areas.push(shopArea.WANLONG)
      if (this.data.areaFlagship) areas.push(shopArea.FLAGSHIP)
      return areas
    },

    // 设置勾选的区域并按它重建门店下拉（不发事件、不动当前选中项）
    _setAreas(areas) {
      this.setData({
        areaWanlong: areas.indexOf(shopArea.WANLONG) >= 0,
        areaFlagship: areas.indexOf(shopArea.FLAGSHIP) >= 0
      })
      this.setData({ name_list: this._buildNameList(this.data.shop_list || []) })
    },

    // 用户勾选 / 取消勾选区域：手动操作优先，停掉还在跑的自动定位
    areaChanged: function (e) {
      var that = this
      that._markSelected()
      var values = (e && e.detail && e.detail.value) || []
      var shopList = that.data.shop_list || []
      var idx = Number(that.data.currentSelectedIndex) || 0
      var current = idx > 0 ? (that.data.name_list || [])[idx] : ''
      var areas = values.filter(function (a) { return shopArea.AREAS.indexOf(a) >= 0 })
      that._setAreas(areas)
      // 选中的门店不在新区域的下拉里 → 回到「全部门店」
      var newIdx = current && shopArea.contains(shopList, areas, current) ? that.data.name_list.indexOf(current) : 0
      that.setData({ currentSelectedIndex: newIdx < 0 ? 0 : newIdx })
      // 门店列表还没回来：只记下店员的区域选择，等列表回来（ready）再统一出结果
      if (!that.data.shop_list) return
      that._emitSelection()
    },

    // 带区域行时对外发出当前选择：shop = 具体门店名，或全部门店时按区域给空串 / 逗号串（后端联合查询）；areas = 勾选的区域
    _emitSelection() {
      var idx = Number(this.data.currentSelectedIndex) || 0
      var name = idx > 0 ? (this.data.name_list || [])[idx] : ''
      var shop = name ? this.getShop(name) : null
      var areas = this._checkedAreas()
      var detail = shop
        ? { shop: shop.name, sale: shop.sale, care: shop.care, rent: shop.rent, restuarant: shop.restuarant }
        : { shop: shopArea.shopParam(this.data.shop_list || [], areas, ''), sale: 0, care: 0, rent: 0, restuarant: 0 }
      detail.areas = areas
      this.triggerEvent('ShopSelected', detail)
    },

    // beacon 命中 / 基地店兜底 / 页面指定门店：由这家店推断区域和门店（万龙 → 万龙 + 全部门店，旗舰 → 旗舰 + 全部门店）
    _applyAreaSelection(shop) {
      this._hasSelection = true
      var inferred = shopArea.fromShop(shop.name)
      this._setAreas(inferred.areas)
      var idx = inferred.shop ? this.data.name_list.indexOf(inferred.shop) : 0
      this.setData({ currentSelectedIndex: idx < 0 ? 0 : idx })
      this._emitSelection()
    },

    // 已经有选定的门店（店员手动选 / 勾区域 / 页面指定）：记下并立刻停止 beacon 识别，之后识别和兜底都不能再改选
    _markSelected() {
      this._hasSelection = true
      this._stopScan()
    },

    // 页面在组件启动之后才给出 / 改了门店
    _onDefaultShopChanged(value) {
      if (!value || !this.data || !this.data.shop_list) return   // 列表还没回来：ready 会按最新的 defaultShop 处理
      this._markSelected()
      this._showChosen(value)
    },

    // 只更新界面显示页面指定的门店，不发事件（页面自己已经知道）
    _showChosen(name) {
      var showArea = this.properties.showArea
      if (shopArea.isAllLabel(name)) {
        if (showArea) this._setAreas(shopArea.AREAS)
        this.setData({ currentSelectedIndex: 0 })
        return
      }
      var shop = this.getShop(name)
      if (!shop) return
      if (showArea) this._setAreas(shopArea.fromChosenShop(name).areas)
      var idx = (this.data.name_list || []).indexOf(name)
      if (idx >= 0) this.setData({ currentSelectedIndex: idx })
    },

    // 页面 / 店员明确指定的某一家（带区域行）：区域跟着它，门店就是这一家，对外发这一家
    _applyChosenShop(shop) {
      this._hasSelection = true
      var chosen = shopArea.fromChosenShop(shop.name)
      this._setAreas(chosen.areas)
      var idx = (this.data.name_list || []).indexOf(shop.name)
      this.setData({ currentSelectedIndex: idx < 0 ? 0 : idx })
      this._emitSelection()
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

    // 选店落地：开单入口以 beacon 命中的店为准；其它旧页面保留万龙系基地店逻辑。
    _applySelectedShop(shop, idx) {
      if (!shop) return
      this._hasSelection = true
      if (this.properties.showArea) {
        this._applyAreaSelection(shop)
        return
      }
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
      // 开单入口的 beacon 命中必须直接生效。扫描前的 fallback 已经按基地店落过一次；
      // 若这里再次换回基地店，就永远看不到 beacon 选出的门店。
      // 其它旧页面仍沿用万龙系基地店逻辑，并保持店名、能力标记与选择框一致。
      var selectedShop = shop
      var staff = app.globalData && app.globalData.staff
      if (this.properties.scene !== 'recept'
        && shop.name.indexOf('万龙') >= 0
        && staff && staff.shop && staff.shop.name
        && staff.shop.name.indexOf('万龙') >= 0) {
        selectedShop = this.getShop(staff.shop.name) || shop
      }
      var selectedIndex = (this.data.name_list || []).indexOf(selectedShop.name)
      if (selectedIndex >= 0) this.setData({ currentSelectedIndex: selectedIndex })
      this.triggerEvent('ShopSelected', {
        shop: selectedShop.name,
        sale: selectedShop.sale, rent: selectedShop.rent,
        care: selectedShop.care, restuarant: selectedShop.restuarant
      })
    },

    // 走 fallback：staff.base_shop_id → 列表第一家。开单场景不默认选店，停在「请选择门店」
    _fallback(shopList) {
      if (this._hasSelection) return   // 已经有选定的门店（手动选 / 页面指定 / 已识别过）：兜底不能再改
      if (this.properties.scene === 'recept') {
        this._setReceptPlaceholder(RECEPT_PLACEHOLDER)
        return
      }
      var shop = _resolveFallbackShop(shopList)
      if (shop) this._applySelectedShop(shop, -1)
    },

    // 开单场景列表首项的文字：扫描中 / 请选择门店
    _setReceptPlaceholder(text) {
      if (this.properties.scene !== 'recept') return
      var list = this.data.name_list
      if (!list || list.length === 0 || list[0] === text) return
      var copy = list.slice()
      copy[0] = text
      this.setData({ name_list: copy })
    },

    // 双路径 beacon 扫描自动选店
    _autoSelectByBeacon(shopList) {
      var that = this
      if (that._hasSelection) return   // 已经有选定的门店：不启动识别

      // 构 mac/uuid 映射表（跳过未配的店）
      var macMap = {}   // normalize MAC → shop
      var uuidShopMap = {}  // normalize UUID → shop
      var uuidList = []
      var anyBeaconConfigured = false
      var configuredShops = []  // 仅含配了 beacon 的店，诊断用
      for (var i = 0; i < shopList.length; i++) {
        var s = shopList[i]
        var hasMac = !!s.beacon_mac
        var hasUuid = !!s.beacon_uuid
        if (hasMac) {
          macMap[_normalizeMac(s.beacon_mac)] = s
          anyBeaconConfigured = true
        }
        if (hasUuid) {
          var u = _normalizeUuid(s.beacon_uuid)
          uuidShopMap[u] = s
          // wx.startBeaconDiscovery 要求 uuids 是标准格式（含连字符），按 DB 原样转大写传
          uuidList.push(u)
          anyBeaconConfigured = true
        }
        if (hasMac || hasUuid) {
          configuredShops.push({
            name: s.name,
            mac: s.beacon_mac ? _normalizeMac(s.beacon_mac) : null,
            uuid: s.beacon_uuid ? _normalizeUuid(s.beacon_uuid) : null
          })
        }
      }

      // 诊断：开扫前打印配置情况，方便从 devtools console 看
      console.log('[shop_selector] beacon 配置统计：', {
        '总店数': shopList.length,
        '已配 beacon 店数': configuredShops.length,
        '待匹配 UUIDs': uuidList,
        '待匹配 MACs': Object.keys(macMap),
        '详情': configuredShops
      })

      // 全店都没配 beacon → 不开蓝牙，直接 fallback
      if (!anyBeaconConfigured) {
        console.warn('[shop_selector] 所有店铺都未配 beacon_uuid/beacon_mac，跳过扫描走 fallback')
        that._fallback(shopList)
        return
      }

      // 开单入口（scene='recept'）：不默认选店，扫描期间首项提示正在识别；命中才选中，没命中由店员手动选
      that._setReceptPlaceholder(RECEPT_SCANNING)

      // 实例字段（不进 data，避免 setData 开销 + 帧间稳定）
      that._scanShopList = shopList
      that._beaconHitMap = {}  // shopId → max RSSI
      that._foundHandler = null
      that._beaconHandler = null
      that._scanActive = true
      // 诊断计数：30s 超时时塞进 toast 让用户一眼看出断在哪
      that._diagSeenBleSet = {}      // Android A 路径扫到的所有 BLE deviceId（包括没匹配的）
      that._diagSeenBeaconSet = {}   // iOS B 路径回的所有 iBeacon UUID:major:minor（包括没匹配的）
      that._diagConfigCount = configuredShops.length
      that._diagUuidList = uuidList
      that._diagPlatform = _getPlatform()

      console.log('[shop_selector] 平台:', that._diagPlatform || '(unknown)',
        '→ 策略:', that._diagPlatform === 'ios' ? '仅 CoreLocation(B 路径)' :
                   that._diagPlatform === 'android' ? '仅 BLE 通用扫描(A 路径) + advertisData 解析 iBeacon' :
                   'devtools 等：仅 B 路径作 demo')

      // 30 秒超时兜底（首批命中会在 _finalizeIfHit 里 clearTimeout）
      that._scanTimeoutTimer = setTimeout(function () {
        if (!that._scanActive) return
        that._stopScan()
        var bleCount = Object.keys(that._diagSeenBleSet || {}).length
        var beaconCount = Object.keys(that._diagSeenBeaconSet || {}).length
        var cfg = that._diagConfigCount || 0
        var diag
        if (that._diagPlatform === 'ios') {
          // iOS 上不跑 A 路径，BLE 数恒为 0 → 只显示 iBeacon
          diag = '配置:' + cfg + ' / iBeacon:' + beaconCount + ' (iOS)'
        } else if (that._diagPlatform === 'android') {
          // Android 上 iBeacon 数来自 advertisData 解析
          diag = '配置:' + cfg + ' / BLE:' + bleCount + ' / 解析 iBeacon:' + beaconCount + ' (Android)'
        } else {
          diag = '配置:' + cfg + ' / BLE:' + bleCount + ' / iBeacon:' + beaconCount
        }
        console.warn('[shop_selector] 30s 超时未命中', {
          '平台': that._diagPlatform,
          '配置店数': that._diagConfigCount,
          '扫到 BLE 总数': bleCount,
          '扫到 iBeacon 总数': beaconCount,
          'BLE 列表前 10': Object.keys(that._diagSeenBleSet || {}).slice(0, 10),
          'iBeacon 列表前 10': Object.keys(that._diagSeenBeaconSet || {}).slice(0, 10),
          '待匹配 UUIDs': that._diagUuidList,
          'startBeaconDiscovery 失败原因': that._diagBeaconStartFail || '(未失败)'
        })
        if (that.properties.scene === 'recept') {
          // 开单场景：诊断信息只留在 console，给店员一句能照做的提示
          wx.showToast({ title: '没有识别到附近门店，请手动选择门店', icon: 'none', duration: 3000 })
          return
        }
        var extra = ''
        if (that._diagBeaconStartFail) {
          extra = '  [iBeacon API errCode=' + (that._diagBeaconStartFail.errCode || '?') + ' 查定位权限]'
        }
        wx.showToast({
          title: '未检测到店内 beacon  ' + diag + extra,
          icon: 'none',
          duration: 4500
        })
      }, SCAN_TIMEOUT_MS)

      // 平台分发
      var platform = that._diagPlatform
      if (platform === 'android') {
        that._startAndroidScan(macMap, uuidShopMap, shopList)
      } else {
        // iOS / devtools / 未知平台 → 走 B 路径
        // iOS 必须这么走（advertisData 被系统过滤、deviceId 是假 MAC，A 路径在 iOS 上对我们毫无用）
        // devtools 没有真蓝牙，跑哪条都不会真扫到，只跑 B 路径占位
        if (uuidList.length === 0) {
          console.warn('[shop_selector] iOS/devtools 但无 beacon_uuid 配置，无法扫描')
          that._stopScan()
          that._fallback(shopList)
          return
        }
        that._startIOSScan(uuidList, uuidShopMap)
      }
    },

    // Android 路径：仅 wx.startBluetoothDevicesDiscovery + onBluetoothDeviceFound
    // 回调里既按 MAC 比 beacon_mac，也解析 advertisData 拿 iBeacon UUID 比 beacon_uuid
    _startAndroidScan: function (macMap, uuidShopMap, shopList) {
      var that = this
      wx.openBluetoothAdapter({
        success: function () {
          wx.getBluetoothAdapterState({
            success: function (state) {
              if (!state.available) {
                console.warn('[shop_selector] Android 蓝牙不可用,走 fallback')
                that._stopScan()
                that._fallback(shopList)
                return
              }
              var startBLE = function () {
                wx.startBluetoothDevicesDiscovery({
                  allowDuplicatesKey: true,
                  powerLevel: 'high',
                  success: function () {
                    console.log('[shop_selector] Android startBluetoothDevicesDiscovery success')
                    that._foundHandler = function (res) { that._onDeviceFound(res, macMap, uuidShopMap) }
                    wx.onBluetoothDeviceFound(that._foundHandler)
                  },
                  fail: function (err) {
                    console.warn('[shop_selector] Android startBluetoothDevicesDiscovery FAIL', err)
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
            fail: function (err) {
              console.warn('[shop_selector] Android getBluetoothAdapterState FAIL', err)
              that._stopScan()
              that._fallback(shopList)
            }
          })
        },
        fail: function (err) {
          // errCode 10001 = 蓝牙未开 / 用户拒绝定位权限
          console.warn('[shop_selector] Android openBluetoothAdapter FAIL', err)
          that._stopScan()
          that._fallback(shopList)
        }
      })
    },

    // iOS 路径：仅 wx.startBeaconDiscovery + onBeaconUpdate（CoreLocation）
    // 不调 openBluetoothAdapter，避免触发不必要的蓝牙权限请求
    _startIOSScan: function (uuidList, uuidShopMap) {
      var that = this
      console.log('[shop_selector] iOS 启动 CoreLocation iBeacon scan, uuids=', uuidList)
      // 先 stop 一次防止 startBeaconDiscovery 重入失败（页面来回切换、上次未清理等场景）
      wx.stopBeaconDiscovery({
        complete: function () {
          wx.startBeaconDiscovery({
            uuids: uuidList,
            ignoreBluetoothAvailable: true,   // iOS B 路径不依赖蓝牙状态
            success: function (sres) {
              console.log('[shop_selector] iOS startBeaconDiscovery success', sres)
              that._beaconHandler = function (res) {
                var arr = (res && res.beacons) || []
                if (arr.length === 0) {
                  console.log('[shop_selector] iOS onBeaconUpdate 空回调（在跑但视野内无配置内 iBeacon）')
                } else {
                  console.log('[shop_selector] iOS onBeaconUpdate 拿到', arr.length, '个 iBeacon')
                }
                that._onBeaconUpdate(res, uuidShopMap)
              }
              wx.onBeaconUpdate(that._beaconHandler)
              wx.onBeaconServiceChange(function (sc) {
                console.log('[shop_selector] iOS onBeaconServiceChange', sc)
              })
            },
            fail: function (ferr) {
              // iOS B 路径失败 = 整条路死了（A 路径在 iOS 上对我们没用），必须提示用户
              console.warn('[shop_selector] iOS startBeaconDiscovery FAIL', ferr)
              that._diagBeaconStartFail = ferr
              that._stopScan()
              wx.showToast({
                title: 'iBeacon 启动失败 errCode=' + (ferr.errCode || '?') + ' 查 iOS 定位权限/精确位置',
                icon: 'none',
                duration: 4500
              })
            }
          })
        }
      })
    },

    // Android 路径回调：deviceId 按 MAC 比，advertisData 解析后按 UUID 比，两条都试
    _onDeviceFound: function (res, macMap, uuidShopMap) {
      if (!this._scanActive) return
      var devices = (res && res.devices) || []
      for (var i = 0; i < devices.length; i++) {
        var d = devices[i]
        if (!d.deviceId) continue
        var key = _normalizeMac(d.deviceId)
        // 诊断：所有 BLE 扫到的 deviceId 都记，不管匹不匹配
        this._diagSeenBleSet[key] = (this._diagSeenBleSet[key] || -999) > d.RSSI ? this._diagSeenBleSet[key] : d.RSSI

        // ① 按 MAC 匹配 beacon_mac
        var shop = macMap[key]
        if (shop) {
          console.log('[shop_selector] Android MAC 命中：', key, '→', shop.name, 'RSSI:', d.RSSI)
        }

        // ② 按 advertisData 解析的 iBeacon UUID 匹配 beacon_uuid（MAC 没命中时也尝试，覆盖 UUID-only 配置的店）
        if (!shop && uuidShopMap) {
          var b = _parseIBeacon(d.advertisData)
          if (b) {
            // 同时记入 iBeacon 诊断 set，让 toast 上 iBeacon:K 也能反映 Android 解析到的数
            var bkey = b.uuid + ':' + b.major + ':' + b.minor
            this._diagSeenBeaconSet[bkey] = (this._diagSeenBeaconSet[bkey] || -999) > d.RSSI ? this._diagSeenBeaconSet[bkey] : d.RSSI
            shop = uuidShopMap[b.uuid]
            if (shop) {
              console.log('[shop_selector] Android advertisData iBeacon UUID 命中：', b.uuid, 'major:', b.major, 'minor:', b.minor, '→', shop.name, 'RSSI:', d.RSSI)
            } else {
              console.log('[shop_selector] Android 解析出非配置 iBeacon UUID：', b.uuid, 'major:', b.major, 'minor:', b.minor, 'RSSI:', d.RSSI)
            }
          }
        }

        if (shop) {
          var prev = this._beaconHitMap[shop.id]
          if (prev == null || d.RSSI > prev) {
            this._beaconHitMap[shop.id] = d.RSSI
          }
        }
      }
      this._finalizeIfHit()
    },

    // iOS 路径回调（CoreLocation iBeacon），按 uuid 比 beacon_uuid
    // 注意：iOS startBeaconDiscovery({uuids:[...]}) 已经把 UUID 列表给系统层做过滤了，
    // 所以这里回的 beacons 理论上 UUID 都在我们列表里。仍然做一次 lookup 防御 + 诊断
    _onBeaconUpdate: function (res, uuidShopMap) {
      if (!this._scanActive) return
      var beacons = (res && res.beacons) || []
      for (var i = 0; i < beacons.length; i++) {
        var b = beacons[i]
        var uuid = _normalizeUuid(b.uuid)
        if (!uuid) continue
        var beaconKey = uuid + ':' + b.major + ':' + b.minor
        this._diagSeenBeaconSet[beaconKey] = (this._diagSeenBeaconSet[beaconKey] || -999) > b.rssi ? this._diagSeenBeaconSet[beaconKey] : b.rssi
        var shop = uuidShopMap[uuid]
        if (shop) {
          console.log('[shop_selector] iOS UUID 命中：', uuid, 'major:', b.major, 'minor:', b.minor, '→', shop.name, 'RSSI:', b.rssi)
          var prev = this._beaconHitMap[shop.id]
          if (prev == null || b.rssi > prev) {
            this._beaconHitMap[shop.id] = b.rssi
          }
        } else {
          // CoreLocation 居然回了不在 uuids list 里的 UUID（理论上不会，但记一下做防御）
          console.log('[shop_selector] iOS 扫到非配置 UUID（异常）：', uuid)
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
      // 不再扫描：开单场景首项从「正在识别附近门店…」恢复为「请选择门店」（命中时随后会选中门店）
      this._setReceptPlaceholder(RECEPT_PLACEHOLDER)
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
