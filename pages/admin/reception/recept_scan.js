// pages/admin/reception/recept_scan.js
// 扫码接待（管理员菜单默认进入的开单入口）
//   店员手机出一次性接待码（120 秒过期自动换新）→ 顾客用微信扫码直接进小程序（pages/order/recept_checkin）
//   → 验证手机号 → 本页识别出顾客 → 店员点业务进入开单，会员信息自动带上；没扫码就按散客开单。
//   店员开单后在结算页选微信支付，顾客手机会自动跳到付款页。
// 手动录入顾客信息的入口 recept_entry 保留，由页面底部链接进入。
//
// 后端依赖（SnowmeetApi QrCodeController）：
//   CreateReceptCheckinByStaff / GetReceptCheckinByStaff / StopQeryScan
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');
const receptionShop = require('../../../utils/reception_shop.js');

const POLL_INTERVAL = 1500;

const STAGE_TEXT = {
  waiting_scan: '请顾客用微信扫码',
  need_phone: '顾客已扫码，正在验证手机号…',
  verified: '已识别顾客',
};

Page({
  data: {
    // 店铺信息：由 shop-selector 通过 ShopSelected 事件回传
    currentShopName: '',
    shop: '',
    sale: 0,
    rent: 0,
    care: 0,
    restuarant: 0,

    // 当前接待码 { id, code, qrText, stage, expireTime }
    checkin: null,
    qrCodeUrl: '',
    loadingQr: false,
    stageText: '',
    // 已识别的顾客 { memberId, name, gender, cell, maskedCell }；null = 还没人扫码验证（按散客开单）
    customer: null,

    // 找回中断订单面板
    showRecoverPanel: false,
    recoverLoading: false,
    recoverOrders: [],
  },

  /* ---------- 生命周期 ---------- */
  onLoad() {
    this._pollTimer = null;
    this._creating = false;
  },

  onShow() {
    // 已识别的顾客保留：店员从开单页返回换个业务时，不用让顾客重新扫码
    if (this.data.customer) return;
    // 切回前台 / 从别的页面返回：继续查原来那张码（已过期会自动换新）
    if (this.data.checkin) {
      this.pollCheckin();
      this._startPolling();
      return;
    }
    this.refreshCheckin();
  },

  // 切到后台只暂停轮询、不作废码：顾客可能正在验证手机号，店员看一眼别的应用回来还要接得上
  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
    this._discardUnusedCode();
  },

  /* ---------- shop-selector 回调 ---------- */
  shopSelected(e) {
    const { shop, sale, rent, care, restuarant } = e.detail || {};
    this.setData({
      currentShopName: shop || '',
      shop: shop || '',
      sale: sale || 0,
      rent: rent || 0,
      care: receptionShop.canStartCare(shop, care) ? 1 : 0,
      restuarant: restuarant || 0,
    });
  },

  /* ---------- 接待码 ---------- */
  // 出一张新码；同时清掉已识别的顾客（「换一位顾客」也走这里）
  refreshCheckin() {
    const that = this;
    if (that._creating) return;
    that._creating = true;
    that._stopPolling();
    that._discardUnusedCode();
    that.setData({ loadingQr: true, checkin: null, customer: null, qrCodeUrl: '', stageText: '' });
    Promise.resolve(app.loginPromiseNew).then(function () {
      return data.createReceptCheckinByStaffPromise(app.globalData.sessionKey);
    }).then(function (checkin) {
      that._creating = false;
      const qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText='
        + encodeURIComponent(checkin.qrText);
      that.setData({ checkin, qrCodeUrl, loadingQr: false, stageText: STAGE_TEXT.waiting_scan });
      that._startPolling();
    }).catch(function () {
      that._creating = false;
      that.setData({ loadingQr: false, stageText: '二维码生成失败，请点「换一个码」重试' });
    });
  },

  onRefreshTap() {
    this.refreshCheckin();
  },

  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => this.pollCheckin(), POLL_INTERVAL);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  pollCheckin() {
    const checkin = this.data.checkin;
    if (!checkin || this.data.customer) {
      this._stopPolling();
      return;
    }
    data.getReceptCheckinByStaffPromise(checkin.id, app.globalData.sessionKey).then((res) => {
      // 网络抖动 / 偶发错误：等下一轮再查
      if (!res || res.code !== 0 || !res.data) return;
      // 返回时已经换了码，丢弃
      if (!this.data.checkin || this.data.checkin.id !== checkin.id) return;
      this.applyCheckin(res.data);
    });
  },

  applyCheckin(view) {
    if (view.stage === 'expired' || view.stage === 'stopped') {
      this.refreshCheckin();
      return;
    }
    const patch = { 'checkin.stage': view.stage, stageText: STAGE_TEXT[view.stage] || '' };
    if (view.stage === 'verified') {
      this._stopPolling();
      patch.customer = {
        memberId: view.memberId,
        name: view.name || '',
        gender: view.gender || '',
        cell: view.cell || '',
        maskedCell: view.maskedCell || '',
      };
    }
    this.setData(patch);
  },

  // 作废还没验证完的码，免得过后有人扫到、一直等不到开单。已识别的码保留（顾客在等这一单）
  _discardUnusedCode() {
    const checkin = this.data.checkin;
    if (!checkin || checkin.stage === 'verified') return;
    data.stopScanQrCodePromise(checkin.id, app.globalData.sessionKey).catch(() => {});
  },

  /* ---------- 直接点击业务卡片进入开单 ---------- */
  onBizTap(e) {
    const bizType = e.currentTarget.dataset.type;
    const { shop, sale, rent, care } = this.data;

    if (!shop) {
      wx.showToast({ title: '请先选择店铺', icon: 'none' });
      return;
    }
    if (bizType === 'retail' && sale !== 1) {
      wx.showToast({ title: '当前店铺不支持零售', icon: 'none' });
      return;
    }
    if (bizType === 'maintain' && care !== 1) {
      wx.showToast({ title: '当前店铺不支持养护', icon: 'none' });
      return;
    }
    if (bizType === 'rent' && rent !== 1) {
      wx.showToast({ title: '当前店铺不支持租赁', icon: 'none' });
      return;
    }

    // 顾客扫了码还没验证完手机号就开单，会按散客开、顾客手机等不到付款页，先确认一下
    const checkin = this.data.checkin;
    if (!this.data.customer && checkin && checkin.stage === 'need_phone') {
      wx.showModal({
        title: '顾客还在验证手机号',
        content: '现在开单将按散客处理，顾客手机不会自动跳到付款页。确定继续吗？',
        success: (res) => {
          if (res.confirm) this._gotoReception(bizType);
        },
      });
      return;
    }
    this._gotoReception(bizType);
  },

  _gotoReception(bizType) {
    const orderShop = receptionShop.orderShopFor(bizType, this.data.shop);
    const customer = this.data.customer || {};
    if (!this.data.customer) {
      // 按散客开单：没用上的码作废，回到本页时重新出码
      this._stopPolling();
      this._discardUnusedCode();
      this.setData({ checkin: null, qrCodeUrl: '', stageText: '' });
    }

    // 暂存订单标识信息（PRD §1.4.6 订单找回），字段与 recept_entry 一致
    wx.setStorageSync('reception_draft', {
      shopName: orderShop,
      customerName: customer.name || '',
      gender: customer.gender || '',
      customerCell: customer.cell || '',
      bizType: bizType,
      createdAt: Date.now(),
    });

    const params = [
      'bizType=' + encodeURIComponent(bizType),
      'shop=' + encodeURIComponent(orderShop),
      'customerName=' + encodeURIComponent(customer.name || ''),
      'gender=' + encodeURIComponent(customer.gender || ''),
      'customerCell=' + encodeURIComponent(customer.cell || ''),
    ];
    if (customer.memberId) {
      params.push('memberId=' + encodeURIComponent(customer.memberId));
    }
    wx.navigateTo({ url: '/pages/admin/reception/recept_new?' + params.join('&') });
  },

  /* ---------- 手动录入入口 ---------- */
  onManualEntryTap() {
    wx.navigateTo({ url: '/pages/admin/reception/recept_entry' });
  },

  /* ---------- 其他交互 ---------- */
  onTabChange() {},

  onRecoverOrder() {
    const that = this
    const shop = that.data.currentShopName || null
    that.setData({ showRecoverPanel: true, recoverLoading: true, recoverOrders: [] })
    data.getRentReceptingOrdersPromise(shop, app.globalData.sessionKey).then(function (orders) {
      for (var i = 0; orders && i < orders.length; i++) {
        const o = orders[i]
        if (o.member) {
          if (!o.contact_name)   o.contact_name   = o.member.real_name || ''
          if (!o.contact_num)    o.contact_num    = o.member.cell || ''
          if (!o.contact_gender) o.contact_gender = o.member.gender || ''
        }
        o.calledName = ((o.contact_name || '') + ' '
          + (o.contact_gender === '男' ? '先生' : (o.contact_gender === '女' ? '女士' : ''))).trim()
        o.timeStr = util.formatTimeStr(new Date(o.biz_date))
      }
      that.setData({ recoverOrders: orders || [], recoverLoading: false })
    }).catch(function () {
      that.setData({ recoverLoading: false })
      wx.showToast({ title: '查询失败，请重试', icon: 'none' })
    })
  },

  onRecoverOrderTap(e) {
    const orderId = e.currentTarget.dataset.id
    const shop = this.data.currentShopName || ''
    this.setData({ showRecoverPanel: false })
    wx.navigateTo({
      url: '/pages/admin/reception/recept_new?orderId=' + orderId
        + '&bizType=rent&shop=' + encodeURIComponent(shop),
    })
  },

  onCloseRecoverPanel() {
    this.setData({ showRecoverPanel: false })
  },
});
