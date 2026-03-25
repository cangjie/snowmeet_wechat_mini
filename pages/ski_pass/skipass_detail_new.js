// pages/ticket-booking/index.js

const UNIT_PRICE = 253.00
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
Page({

  data: {
    // 当前选中日期（显示用）
    selectedDate: '2026-03-20',
    // 购票数量
    quantity: 1,
    // 总价
    totalPrice: '253.00',
    // 游客姓名
    guestName: '李源',
    // 游客手机号
    guestPhone: '15810602258',
    // 输入框聚焦状态
    nameFocused: false,
    phoneFocused: false,
    // 日期弹窗
    showDatePicker: false,
    // 日期选项列表
    dateOptions: [],
    // picker 当前选中 index
    pickerValue: [0],
    // 临时选中 index（未确认前）
    tempPickerIndex: 0,
    count: 1
  },

  onLoad(options) {
    var that = this
    that.setData({selectedDate: util.formatDate(new Date())})
    app.loginPromiseNew.then(function (resolve) {
      that._initDateOptions()
      that.getBalance()
      that.setData({
        id: options.id, memberId: options.memberId, staffId: options.staffId
      })
      that.getData()
    })
  },

  // ========================
  // 初始化日期列表（从今天起 5 天）
  // ========================
  _initDateOptions() {
    const options = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const week = weekDays[d.getDay()]
      const label = i === 0 ? '今天' : i === 1 ? '明天' : week
      options.push(`${yyyy}-${mm}-${dd}  ${label}`)
    }
    this.setData({ dateOptions: options })
  },

  // ========================
  // 计算并更新总价
  // ========================
  _updateTotalPrice() {
    const total = (UNIT_PRICE * this.data.quantity).toFixed(2)
    this.setData({ totalPrice: total })
  },

  // ========================
  // 顶部导航
  // ========================
  onBack() {
    wx.navigateBack({ delta: 1 })
  },

  onMore() {
    wx.showActionSheet({
      itemList: ['分享给朋友', '复制链接', '举报'],
      success(res) {
        console.log('选择了:', res.tapIndex)
      }
    })
  },

  // ========================
  // 日期选择
  // ========================
  onSelectDate() {
    this.setData({ showDatePicker: true })
  },

  onCloseDatePicker() {
    var that = this
    that.setData({ showDatePicker: false })

  },

  preventBubble() {
    // 阻止点击面板时关闭弹窗
  },

  onPickerChange(e) {
    const index = e.detail.value[0]
    this.setData({
      pickerValue: [index],
      tempPickerIndex: index,
    })
  },

  onConfirmDate() {
    var that = this
    const index = this.data.tempPickerIndex
    // 取日期部分（去掉星期）
    const raw = this.data.dateOptions[index] || ''
    const dateStr = raw.split(' ')[0].trim()
    that.setData({
      selectedDate: dateStr,
      showDatePicker: false,
    })
    wx.showToast({
      title: `已选择 ${dateStr}`,
      icon: 'success',
      duration: 1500,
      success: (res) => {
        that.setDate(new Date(that.data.selectedDate))
      }
    })
  },

  // ========================
  // 数量加减
  // ========================
  onIncrease() {
    // 加号已禁用，不执行任何操作
  },

  onDecrease() {
    const qty = this.data.quantity - 1
    if (qty < 1) {
      wx.showToast({ title: '至少购买 1 张', icon: 'none' })
      return
    }
    this.setData({ quantity: qty })
    this._updateTotalPrice()
  },

  // ========================
  // 游客信息输入
  // ========================
  onNameInput(e) {
    //this.setData({ guestName: e.detail.value })
    var that = this
    that.data.name = e.detail.value
  },

  onPhoneInput(e) {
    //this.setData({ guestPhone: e.detail.value })
    var that = this
    that.data.cell = e.detail.value
  },

  // ========================
  // 自动获取手机号（需用户授权）
  // ========================
  onAutoFill() {
    wx.getUserProfile({
      desc: '用于自动填写手机号',
      success: () => {
        // 实际项目中通过 getPhoneNumber button 获取，此处为演示
        wx.showToast({ title: '请使用按钮授权获取', icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '取消授权', icon: 'none' })
      }
    })
  },

  // ========================
  // 确认支付
  // ========================
  onPay() {
    var that = this
    const { guestName, guestPhone, selectedDate, quantity, totalPrice } = this.data

    // 基础校验
    if (!guestName.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(guestPhone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认订单',
      content: `日期：${selectedDate}\n数量：${that.data.count} 张\n总价：${that.data.summaryStr}\n\n姓名：${that.data.name}\n取票手机号：${that.data.cell}`,
      confirmText: '去支付',
      success: (res) => {
        if (res.confirm) {
          this._requestPayment()
        }
      }
    })
  },

  // ========================
  // 发起微信支付（对接实际后端）
  // ========================
  _requestPayment() {
    var that = this
    var product = that.data.product
    var idNo = that.data.idNo? that.data.idNo: ''
    wx.showLoading({ title: '正在下单...' })
    that.setData({paying: true})
    var submitUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/ReserveSkiPass/' + product.product_id + '?date=' + that.data.selectedDate + '&count=' + that.data.count + '&cell=' + that.data.cell + '&name=' + encodeURIComponent(that.data.name) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid') + '&idNo=' + idNo + (that.data.memberId ? '&refereeMemberId=' + that.data.memberId : '')
      + (that.data.staffId ? '&staffId=' + that.data.staffId : '')
    wx.request({
      url: submitUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        console.log('skipass booked', res)
        var order = res.data
        var paymentId = order.payments[0].id
        var payUrl = app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + paymentId + '?sessionKey=' + app.globalData.sessionKey
        wx.request({
          url: payUrl,
          method: 'GET',
          success: (res) => {
            wx.requestPayment({
              nonceStr: res.data.data.nonce,
              package: 'prepay_id=' + res.data.data.prepay_id,
              paySign: res.data.data.sign,
              timeStamp: res.data.data.timestamp,
              signType: 'MD5',
              success: (res) => {
                wx.showToast({
                  title: '支付成功。',
                  icon: 'success',
                  complete: () => {
                    wx.redirectTo({
                      url: '../mine/skipass/my_skipass',
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
    // TODO: 替换为真实的后端接口
    // wx.request({
    //   url: 'https://your-server.com/api/order/create',
    //   method: 'POST',
    //   data: {
    //     date: this.data.selectedDate,
    //     quantity: this.data.quantity,
    //     name: this.data.guestName,
    //     phone: this.data.guestPhone,
    //   },
    //   success: (res) => {
    //     const { timeStamp, nonceStr, package: pkg, signType, paySign } = res.data
    //     wx.requestPayment({
    //       timeStamp, nonceStr, package: pkg, signType, paySign,
    //       success: () => {
    //         wx.hideLoading()
    //         wx.navigateTo({ url: '/pages/payment-success/index' })
    //       },
    //       fail: () => {
    //         wx.hideLoading()
    //         wx.showToast({ title: '支付已取消', icon: 'none' })
    //       }
    //     })
    //   },
    //   fail: () => {
    //     wx.hideLoading()
    //     wx.showToast({ title: '网络错误，请重试', icon: 'none' })
    //   }
    // })

    // 演示：模拟成功
    setTimeout(() => {
      /*
      wx.hideLoading()
      wx.showToast({ title: '支付成功！', icon: 'success', duration: 2000 })
      */
    }, 1500)
    
    
  },
  getBalance() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/WanlongZiwoyouHelper/GetBalance'
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          that.setData({ canReserve: false })
        }
        try {
          var balance = parseFloat(res.data)
          var canReserve = true
          if (balance <= that.data.summary) {
            canReserve = false
          }
          that.setData({ balance, canReserve })

        }
        catch {
          that.setData({ canReserve: false })
        }
      }
    })
  },
  getData() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/WanlongZiwoyouHelper/GetProductById/' + that.data.id
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        var product = res.data
        that.setData({ product })
        console.log('get product', product)
        var title = product.resort + ' 雪票预定'
        var currentDate = new Date(that.data.selectedDate)
        wx.setNavigationBarTitle({
          title: title,
        })
        var productImage = 'https://snowmeet.wanlonghuaxue.com/images/skipass_day.png'
        if (product.name.indexOf('夜场') >= 0) {
          productImage = 'https://snowmeet.wanlonghuaxue.com/images/skipass_eve.png'
          if (currentDate.getHours() >= 20) {
            currentDate = new Date()
            currentDate = currentDate.setDate(currentDate.getDate() + 1)
            currentDate = new Date(currentDate)
          }
        }
        else {
          currentDate = new Date()
          if (currentDate.getHours() >= 14) {
            currentDate = new Date()
            currentDate = currentDate.setDate(currentDate.getDate() + 1)
            currentDate = new Date(currentDate)
          }
        }
        that.setData({ selectedDate: util.formatDate(currentDate), productImage })
        that.GetRealName()
        that.getDailyPrice()
        var summary = that.data.count * that.data.dailyPrice.deal_price
        var canReserve = true
        if (isNaN(that.data.balance) || summary >= that.data.balance) {
          canReserve = false
        }
        var summary = that.data.count * that.data.dailyPrice.deal_price
        that.setData({ canReserve, summary, summaryStr: util.showAmount(summary) })
      }
    })
  },
  GetRealName() {
    var that = this
    data.getMyInfo(app.globalData.sessionKey).then(function (info) {
      that.setData({ name: info.real_name, cell: info.cell })
    })
  },
  getDailyPrice() {
    var that = this
    var product = that.data.product
    var currentDate = util.formatDate(new Date(that.data.selectedDate))
    var find = false
    for (var i = 0; i < product.dailyPrice.length; i++) {
      var pDate = util.formatDate(new Date(product.dailyPrice[i].reserve_date))
      if (pDate == currentDate) {
        find = true
        var dailyPrice = product.dailyPrice[i]
        dailyPrice.deal_priceStr = util.showAmount(parseFloat(dailyPrice.deal_price))
        dailyPrice.marketPriceStr = util.showAmount(parseFloat(dailyPrice.marketPrice))
        that.setData({ dailyPrice: dailyPrice })
        break
      }
    }
    if (!find) {
      that.setData({ dailyPrice: undefined })
    }
  },
  getCell(e) {
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateWechatMemberCell?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&encData=' + encodeURIComponent(e.detail.encryptedData) + '&iv=' + encodeURIComponent(e.detail.iv)
    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        var member = res.data
        console.log('get member', member)
        that.setData({ cell: member.currentCell })
      }
    })
  },
  setDate(date) {
    var that = this
    //var date = new Date(e.detail.value)
    that.setData({ currentDate: util.formatDate(date) })
    that.getDailyPrice()
    if (that.data.dailyPrice) {
      var dealPrice = that.data.dailyPrice.deal_price
      var count = that.data.count
      var summary = dealPrice * count
      var canReserve = true
      if (isNaN(that.data.balance) || summary >= that.data.balance) {
        canReserve = false
      }
      that.setData({ summary, summaryStr: util.showAmount(summary), canReserve })
    }
    else {
      that.setData({ summary: 0, summaryStr: util.showAmount(0), canReserve: false })
    }
  },
})
