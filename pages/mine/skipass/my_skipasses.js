// pages/tickets/tickets.js
const app = getApp()
const util = require('../../../utils/util.js')
// 退票状态：后台 status 文案 → 标签文案、是否还能用、给顾客的说明。
// 取消先提交给供应商，确认可能要几分钟，确认后系统自动原路退款，顾客不用再操作。
var CANCEL_STATUS = {
  '取消中': { text: '退票中', usable: false, hint: '退票处理中，通常几分钟内确认，确认后自动原路退款' },
  '申请取消': { text: '退票中', usable: false, hint: '退票处理中，通常几分钟内确认，确认后自动原路退款' },
  '已取消': { text: '退票中', usable: false, hint: '退票已确认，退款正在提交' },
  // 退款已经提交给微信，钱按原路退回；微信的退款成功回调这几个月没有更新库里的状态，
  // 所以以「已申请退款」为准显示已退票，不等「退款成功」
  '已申请退款': { text: '已退票', usable: false, hint: '退款已原路退回，到账时间以支付渠道为准' },
  '退款成功': { text: '已退票', usable: false, hint: '' },
  '出票失败': { text: '出票失败', usable: false, hint: '' },
  '取消失败': { text: '退票未成功', usable: true, hint: '退票没有成功，请联系店员处理' }
}

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
    var that = this
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
      success:()=>{
        that.cancel(that.data.cancelTarget.id)
      }
    })
  },

  // ===== 立即使用 =====
  onUseTicket(e) {
    const { id, card_no, pickupCode, title } = e.currentTarget.dataset

    // 从列表找到完整数据（含 pickupCode）
    const ticket = this.data.unusedList.find(item => item.id === id)
    if (!ticket || !ticket.canUse) return

    // 取票二维码和取票码是下单后由供应商出票才有的，刚下单那一会儿还没有，
    // 这时没东西可展示，提示稍后再试（原来这里引用了不存在的变量 serial，点了直接报错）
    const pickup = ticket.pickupCode || pickupCode || ''
    const cardNo = ticket.card_no || card_no || ''
    if (!pickup && !cardNo) {
      wx.showToast({ title: '取票码正在生成，请稍后下拉刷新再试', icon: 'none' })
      return
    }

    this.setData({
      showUseModal: true,
      useTarget: {
        id,
        title,
        card_no: cardNo,
        pickupCode: pickup,
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
          // 顾客实际支付的金额（deal_price，已含张数）。ticket_price 是我们和供应商的结算价，不能给顾客看
          item.amount = util.showAmount(parseFloat(list[i].deal_price))
          var cancelInfo = CANCEL_STATUS[list[i].status]
          item.statusText = cancelInfo ? cancelInfo.text : list[i].status
          item.statusHint = cancelInfo ? cancelInfo.hint : ''
          item.statusClass = 'status-picked'
          item.canUse = (list[i].status != '已申请退款' && list[i].status != '已退票' &&  list[i].status != '已取卡'
          &&  list[i].status != '已退押金' ) && (!cancelInfo || cancelInfo.usable)
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
  cancel(id){
    var that = this
    that.setData({cancelling: true})
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Cancel/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        console.log('cancel result', res)
        that.setData({activeTab: 'used'})
        that.getData()
      }
    })
  },
})
