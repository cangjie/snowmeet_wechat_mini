// pages/tickets/tickets.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({
  data: {
    activeTab: 'unused', // 'unused' | 'used'
    currentList: [],      // 当前 tab 对应的列表（避免 WXML 复杂表达式）
    currentListEmpty: false,

    // 未使用票券列表
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

    // 退票弹窗
    showCancelModal: false,
    cancelTarget: {
      id: '',
      title: '',
    },

    // 使用弹窗（二维码）
    showUseModal: false,
    useTarget: {
      id: '',
      title: '',
      serial: '',
      pickupCode: '',
    },
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
  onCancelTicket(e) {
    const { id, title } = e.currentTarget.dataset
    this.setData({
      showCancelModal: true,
      cancelTarget: { id, title },
    })
  },

  closeCancelModal() {
    this.setData({ showCancelModal: false })
  },

  confirmCancel() {
    const { id } = this.data.cancelTarget

    // 从未使用列表中移除（实际开发中替换为 API 调用）
    const unusedList = this.data.unusedList.filter(item => item.id !== id)
    this.setData({
      unusedList,
      showCancelModal: false,
    }, () => {
      this._refreshCurrentList()
    })

    wx.showToast({
      title: '退票申请已提交',
      icon: 'success',
      duration: 2000,
    })
  },

  // ===== 立即使用 =====
  onUseTicket(e) {
    const { id, card_no, pickupCode, title } = e.currentTarget.dataset

    // 从列表找到完整数据（含 pickupCode）
    const ticket = this.data.unusedList.find(item => item.id === id)
    if (!ticket || !ticket.canUse) return

    this.setData({
      showUseModal: true,
      useTarget: {
        id,
        title,
        card_no,
        pickupCode: ticket.pickupCode || serial.replace(/\s/g, '').slice(0, 10),
      },
    })
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
        var list = res.data
        console.log('ticket list', list)
        for(var i = 0; i < list.length; i++){
          var item = {}
          item.id = list[i].id
          item.tire = ''
          item.title = list[i].product_name
          item.serial = (list[i].reserve_no==null || list[i].reserve_no == undefined) ? '' : list[i].reserve_no 
          item.validDate = util.formatDate(new Date(list[i].reserve_date))
          item.quantity = '1张'
          item.amount = util.showAmount(parseFloat(list[i].ticket_price))
          item.statusText = list[i].status
          item.statusClass = 'status-picked'
          item.canUse = (list[i].status != '已申请退款' && list[i].status != '已退票' &&  list[i].status != '已取卡'
          &&  list[i].status != '已退押金' )
          item.card_no = list[i].card_no
          item.pickupCode = list[i].qr_code_url
          if (item.canUse){
            unusedList.push(item)
          }
          else{
            usedList.push(item)
          }
        }
        that.data.unusedList = unusedList
        that.data.usedList = usedList
        that._refreshCurrentList()
      }
    })
  }
})
