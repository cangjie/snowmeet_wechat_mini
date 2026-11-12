// pages/tickets/tickets.js
const app = getApp()
const util = require('../../../utils/util.js')
const myGroup = require('../../../utils/skipass_my_group.js')

Page({
  data: {
    activeTab: 'unused', // 'unused' | 'used'
    currentList: [],      // 当前 tab 对应的列表（避免 WXML 复杂表达式）
    currentListEmpty: false,
    unusedList:[],
    usedList:[],

    // 未使用票券列表
    /*
    unusedList: [
      {
        id: 'T001',
        tier: 'premium',
        title: '【25-26雪季】6小时日场自带板滑雪票',
        serial: '8823 4910 2210',
        validDate: '2025-12-24',
        quantity: '1张',
        amount: '480.00',
        statusText: '已取卡',
        statusClass: 'status-picked',
        canUse: false,
        pickupCode: '8823491022',
      },
      {
        id: 'T002',
        tier: 'standard',
        title: '【25-26雪季】夜场畅滑雪票 (含雪具)',
        serial: '7721 0045 1198',
        validDate: '2025-12-25',
        quantity: '',
        amount: '320.00',
        statusText: '待使用',
        statusClass: 'status-pending',
        canUse: true,
        pickupCode: '7721004511',
      },
    ],

    // 已使用票券列表
    usedList: [
      {
        id: 'T003',
        tier: 'standard',
        title: '【25-26雪季】全天畅滑雪票 (含雪具)',
        serial: '6612 3300 8877',
        validDate: '2025-12-10',
        quantity: '1张',
        amount: '420.00',
        statusText: '已使用',
        statusClass: 'status-used',
        canUse: false,
      },
      {
        id: 'T004',
        tier: 'premium',
        title: '【25-26雪季】6小时日场自带板滑雪票',
        serial: '5512 1100 9988',
        validDate: '2025-12-05',
        quantity: '2张',
        amount: '960.00',
        statusText: '已使用',
        statusClass: 'status-used',
        canUse: false,
      },
      {
        id: 'T005',
        tier: 'standard',
        title: '【25-26雪季】夜场畅滑雪票 (含雪具)',
        serial: '4401 8899 3321',
        validDate: '2025-11-28',
        quantity: '',
        amount: '320.00',
        statusText: '已使用',
        statusClass: 'status-used',
        canUse: false,
      },
      {
        id: 'T006',
        tier: 'standard',
        title: '【25-26雪季】全天畅滑雪票',
        serial: '3300 7788 4456',
        validDate: '2025-11-20',
        quantity: '1张',
        amount: '380.00',
        statusText: '已使用',
        statusClass: 'status-used',
        canUse: false,
      },
      {
        id: 'T007',
        tier: 'premium',
        title: '【25-26雪季】6小时日场自带板滑雪票',
        serial: '2200 6677 5543',
        validDate: '2025-11-15',
        quantity: '1张',
        amount: '480.00',
        statusText: '已使用',
        statusClass: 'status-used',
        canUse: false,
      },
    ],
    */

    // 退票弹窗
    showCancelModal: false,
    cancelTarget: {
      id: '',
      title: '',
    },

    // 使用弹窗（二维码）
    // 立即使用：一组里有多张票时按标签（票1、票2…）切换，每张票各自的二维码、状态和退票按钮
    showUseModal: false,
    useTarget: { key: '', title: '', validDate: '', cell: '', count: 0 },
    useTickets: [],
    useIndex: 0,
    useTicket: {},
    qrFailed: false,
  },

  onLoad() {
    // 设置页面标题
    wx.setNavigationBarTitle({ title: '我的雪票' })
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getData()
    })
    
  },

  // 刷新当前列表快照（WXML 不支持复杂三元表达式）
  _refreshCurrentList() {
    const list = this.data.activeTab === 'unused'
      ? this.data.unusedList
      : this.data.usedList
    this.setData({
      currentList: list,
      currentListEmpty: list.length === 0,
      usedList: this.data.usedList, unusedList: this.data.unusedList
    })
  },

  // ===== Tab 切换 =====
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab }, () => {
      this._refreshCurrentList()
    })
  },

  // ===== 申请取消 =====
  // 退票按钮在「立即使用」弹层里，每张票各有一个；先关掉票码弹层，再弹确认
  onCancelTicket(e) {
    const { id } = e.currentTarget.dataset
    const ticket = this.data.useTickets.find(t => t.id === id)
    const title = this.data.useTarget.title + (this.data.useTarget.count > 1 && ticket ? '（' + ticket.tag + '）' : '')
    this.setData({
      showUseModal: false,
      showCancelModal: true,
      cancelTarget: { id, title },
    })
  },

  closeCancelModal() {
    this.setData({ showCancelModal: false })
  },

  confirmCancel() {
    const { id } = this.data.cancelTarget
    this.setData({ showCancelModal: false })
    this.cancel(id)
  },

  // ===== 立即使用：打开这一组的票码弹层 =====
  onUseTicket(e) {
    const key = e.currentTarget.dataset.key
    const group = this.data.unusedList.find(item => item.key === key)
    if (!group || !group.usableCount) return
    const tickets = group.tickets.map((t, i) => Object.assign({ tag: '票' + (i + 1) }, t))
    let index = tickets.findIndex(t => t.usable)
    if (index < 0) index = 0
    this.setData({
      showUseModal: true,
      useTarget: { key, title: group.title, validDate: group.validDate, cell: group.cell, count: group.count },
      useTickets: tickets,
      useIndex: index,
      useTicket: tickets[index],
      qrFailed: false,
    })
  },

  // 二维码图片没加载出来：提示稍后重试，取票码文字仍可用
  onQrError() {
    this.setData({ qrFailed: true })
  },

  onSelectTicket(e) {
    const index = Number(e.currentTarget.dataset.index)
    const ticket = this.data.useTickets[index]
    if (!ticket) return
    this.setData({ useIndex: index, useTicket: ticket, qrFailed: false })
  },

  closeUseModal() {
    this.setData({ showUseModal: false })
  },

  // ===== 复制取票码 =====
  copyCode(e) {
    const { code } = e.currentTarget.dataset
    wx.setClipboardData({
      data: code,
      success() {
        wx.showToast({
          title: '取票码已复制',
          icon: 'success',
          duration: 1500,
        })
      },
    })
  },
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/SkiPass/GetMySkipass?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var unusedList = []
        var usedList = []
        var groups = myGroup.buildMyGroups(res.data)
        groups.forEach(function (g) {
          // 取票二维码：供应商的图片域名不在小程序的合法域名里，真机上显示不出来，改由我们的服务器取了再转给小程序
          g.tickets.forEach(function (t) {
            t.qrSrc = t.pickupCode
              ? 'https://' + app.globalData.domainName + '/core/SkiPass/QrImage?skipassId=' + t.id
                + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
              : ''
          })
          // 顾客实际支付的金额（各张 deal_price 之和）。ticket_price 是我们和供应商的结算价，不能给顾客看
          g.amount = util.showAmount(g.amountNum)
          if (g.tab === 'unused') {
            unusedList.push(g)
          } else {
            usedList.push(g)
          }
        })
        that.data.unusedList = unusedList
        that.data.usedList = usedList
        that._refreshCurrentList()
      }
    })
  },
  refund(id){
    var that = this
    that.setData({cancelling: true})
    //var id = e.currentTarget.id
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Refund?skipassId=' + id + '&reason=' + encodeURIComponent('确认取消成功后退款') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        console.log('cancel result', res)
        that.getData()
      }
    })
  },
  // 退这一张票：先向供应商提交取消，确认后系统自动退这张票的票款；这里只提交、刷新列表
  cancel(id){
    var that = this
    that.setData({cancelling: true})
    wx.showLoading({ title: '正在提交...' })
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Cancel/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        wx.hideLoading()
        that.setData({cancelling: false})
        wx.showToast({
          title: res.statusCode == 200 ? '退票申请已提交' : '退票失败，请联系店员',
          icon: res.statusCode == 200 ? 'success' : 'none',
          duration: 2000,
        })
        that.getData()
      },
      fail:()=>{
        wx.hideLoading()
        that.setData({cancelling: false})
        wx.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      }
    })
  },
})
