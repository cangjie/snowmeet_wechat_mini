// pages/ski_pass/ski_pass_selector.js
// 雪票首页：按「时长 + 场次」分组，每组写最低价；点进去在详情页选装备和日期。
// 价格人人可看，订票只有店员能订（后端 ReserveSkiPass 强制，详情页对顾客不显示支付栏）。
const app = getApp()
const skipassGroup = require('../../utils/skipass_group.js')

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

Page({
  data: {
    resort: '万龙',
    groups: [],
    tabs: [],
    resortArr: [],
    activeTab: 0,
    showTabs: false,
    tabIndex: 0,
    isStaff: false,
    loaded: false,
    loadFailed: false
  },

  _now() {
    return new Date()
  },

  onChange(e) {
    var that = this
    var value = e.detail.index
    that.setData({ groups: [], loaded: false, resort: that.data.resortArr[value] })
    that.GetData()
  },

  onLoad(options) {
    var that = this
    options = options || {}
    var resort = options.resort ? safeDecode(options.resort) : ''
    if (!resort || resort == 'undefined') {
      resort = '万龙'
    }
    that.setData({ resort })
    if (options.memberId) {
      that.setData({ memberId: options.memberId })
    }
    if (options.staffId) {
      that.setData({ staffId: options.staffId })
    }
    app.loginPromiseNew.then(function () {
      that.setData({
        tabbarItemList: app.globalData.userTabBarItem,
        canGetInfo: true,
        isStaff: !!app.globalData.staff
      })
      that.getResortArr()
    })
  },

  getResortArr() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetResorts'
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        var resort = that.data.resort
        var resortArr = [resort]
        if (res.statusCode == 200 && Array.isArray(res.data)) {
          // 南山已关店（2026-09-30），小程序里的南山雪票代码已删除；服务端 GetResorts 仍会返回南山，这里剔除。
          resortArr = res.data.filter(function (r) { return r != '南山' })
        }
        if (resortArr.length == 0) {
          resortArr = ['万龙']
        }
        var tabs = []
        var activeTab = -1
        for (var i = 0; i < resortArr.length; i++) {
          tabs.push({ title: resortArr[i], title2: '', img: '', desc: '' })
          if (resort == resortArr[i]) {
            activeTab = i
          }
        }
        // 带着列表里没有的雪场（如旧链接里的 resort=南山）进来时，落到第一个雪场，
        // 否则会按那个雪场去查商品并走万龙的下单流程。
        if (activeTab < 0) {
          activeTab = 0
          resort = resortArr[0]
        }
        that.setData({ tabs, resortArr, activeTab, resort, showTabs: resortArr.length > 1 })
        that.GetData()
      },
      fail: () => {
        that.setData({ loaded: true, loadFailed: true })
      }
    })
  },

  GetData() {
    var that = this
    var resort = that.data.resort
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetProductsByResort?showHidden=0&resort=' + encodeURIComponent(resort)
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '')
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200 || !Array.isArray(res.data)) {
          that.setData({ groups: [], loaded: true, loadFailed: true })
          return
        }
        var groups = skipassGroup.buildGroups(res.data, that._now()).map(function (g) {
          return { key: g.key, title: g.title, subtitle: g.subtitle, minPriceStr: g.minPriceStr }
        })
        that.setData({ groups, loaded: true, loadFailed: false })
      },
      fail: () => {
        that.setData({ groups: [], loaded: true, loadFailed: true })
      }
    })
  },

  tabSwitch: function (e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
    })
  },

  gotoDetail(e) {
    var that = this
    var key = e.currentTarget.dataset.key
    var url = 'skipass_detail_new?group=' + encodeURIComponent(key) + '&resort=' + encodeURIComponent(that.data.resort)
    url += (that.data.memberId ? ('&memberId=' + that.data.memberId) : '')
    url += (that.data.staffId ? ('&staffId=' + that.data.staffId) : '')
    wx.navigateTo({
      url: url,
    })
  },

  onShareAppMessage() {

  }
})
