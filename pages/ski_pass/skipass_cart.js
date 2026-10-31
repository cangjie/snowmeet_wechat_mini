// pages/ski_pass/skipass_cart.js
// 雪票购物车（仅店员）：票种 日期 手机号 × 张数 合并成一条，底部合计，去结算 → 一个订单一次微信支付。
// 购物车存在本机（utils/skipass_cart.js）；金额只用来显示，后端结算时按当天价格行重新算并核对预存款。
const app = getApp()
const cartUtil = require('../../utils/skipass_cart.js')

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dateText(date) {
  const d = new Date(parseInt(date.slice(0, 4), 10), parseInt(date.slice(5, 7), 10) - 1, parseInt(date.slice(8, 10), 10))
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK_DAYS[d.getDay()]
}

Page({
  data: {
    isStaff: false,
    lines: [],
    ticketCount: 0,
    totalStr: '¥0.00',
    empty: true,
    paying: false
  },

  onLoad() {
    const that = this
    app.loginPromiseNew.then(function () {
      that.setData({ isStaff: !!app.globalData.staff })
      that.refresh()
    })
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const cart = cartUtil.load()
    this._cart = cart
    this.setData({
      lines: cart.items.map(it => ({
        key: it.key, title: it.title, dateText: dateText(it.date), cell: it.cell, count: it.count,
        priceStr: cartUtil.fmtMoney(it.price), lineTotalStr: cartUtil.fmtMoney(it.price * it.count)
      })),
      ticketCount: cartUtil.ticketCount(cart),
      totalStr: cartUtil.fmtMoney(cartUtil.total(cart)),
      empty: cart.items.length === 0
    })
  },

  _apply(result) {
    if (result.error) {
      wx.showToast({ title: result.error, icon: 'none' })
    }
    cartUtil.save(result.cart)
    this.refresh()
  },

  onInc(e) {
    this._apply(cartUtil.changeCount(this._cart, e.currentTarget.dataset.key, 1))
  },

  onDec(e) {
    this._apply(cartUtil.changeCount(this._cart, e.currentTarget.dataset.key, -1))
  },

  onRemove(e) {
    this._apply({ cart: cartUtil.remove(this._cart, e.currentTarget.dataset.key), error: '' })
  },

  onContinue() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.redirectTo({ url: '/pages/ski_pass/ski_pass_selector' })
    }
  },

  // ========================
  // 去结算（仅店员）
  // ========================
  onCheckout() {
    const that = this
    if (!that.data.isStaff) {
      wx.showToast({ title: '仅限店员订票', icon: 'none' })
      return
    }
    if (that.data.paying) return
    if (that.data.empty) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认订单',
      content: '共 ' + that.data.ticketCount + ' 张票\n合计 ' + that.data.totalStr,
      confirmText: '去支付',
      success: (res) => {
        if (res.confirm) {
          that._submit()
        }
      }
    })
  },

  _submit() {
    const that = this
    const cart = that._cart
    wx.showLoading({ title: '正在下单...' })
    that.setData({ paying: true })
    const fail = function (msg) {
      wx.hideLoading()
      that.setData({ paying: false })
      wx.showToast({ title: msg || '下单失败，请稍后重试', icon: 'none' })
    }
    wx.request({
      url: 'https://' + app.globalData.domainName + '/core/SkiPass/ReserveSkiPassCart?sessionKey='
        + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid'),
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: cartUtil.toRequest(cart),
      success: (res) => {
        if (res.statusCode != 200) {
          fail(typeof res.data === 'string' ? res.data : '')
          return
        }
        const order = res.data
        const expected = cartUtil.total(cart)
        if (Math.abs((order.total_amount || 0) - expected) > 0.005) {
          // 价格在加入购物车之后变了：以后台为准，让店员确认
          wx.hideLoading()
          wx.showModal({
            title: '价格已更新',
            content: '合计变为 ' + cartUtil.fmtMoney(order.total_amount) + '（原 ' + cartUtil.fmtMoney(expected) + '），是否继续支付？',
            confirmText: '继续支付',
            success: (m) => {
              if (m.confirm) {
                wx.showLoading({ title: '正在支付...' })
                that._pay(order, fail)
              } else {
                that.setData({ paying: false })
              }
            }
          })
          return
        }
        that._pay(order, fail)
      },
      fail: () => { fail('') }
    })
  },

  _pay(order, fail) {
    const that = this
    const paymentId = order.payments[0].id
    wx.request({
      url: app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + paymentId + '?sessionKey=' + app.globalData.sessionKey,
      method: 'GET',
      success: (res) => {
        wx.hideLoading()
        wx.requestPayment({
          nonceStr: res.data.data.nonce,
          package: 'prepay_id=' + res.data.data.prepay_id,
          paySign: res.data.data.sign,
          timeStamp: res.data.data.timestamp,
          signType: 'MD5',
          success: () => {
            cartUtil.save(cartUtil.emptyCart())
            wx.showToast({
              title: '支付成功。',
              icon: 'success',
              complete: () => {
                wx.redirectTo({ url: '/pages/mine/skipass/my_skipasses' })
              }
            })
          },
          fail: () => {
            that.setData({ paying: false })
            wx.showToast({ title: '支付已取消', icon: 'none' })
          }
        })
      },
      fail: () => { fail('') }
    })
  }
})
