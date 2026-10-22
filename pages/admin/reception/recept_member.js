// pages/admin/reception/recept_member.js
// 接待·顾客信息（对应旧版 recept_member_info）：店员在这里看顾客信息，再选店铺和业务进入开单。
//   从扫码接待页（recept_scan）进来有两种情况：
//   - 顾客扫码（checkinId）：老顾客直接显示会员信息；新顾客要在手机上授权手机号，本页轮询，
//     授权后弹窗提示店员，再显示会员信息。顾客不方便授权时可改按散客开单。
//   - 散客进入（walkin=1）：不挂会员，姓名/性别/电话都选填，可在这里或开单页顶部填写。
//
// 后端依赖（SnowmeetApi）：QrCode/GetReceptCheckinByStaff；选店由 shop-selector 组件内部调 Order/GetShops
const app = getApp();
const data = require('../../../utils/data.js');
const receptionShop = require('../../../utils/reception_shop.js');

const POLL_INTERVAL = 1500;

Page({
  data: {
    // 'scan' = 顾客扫码；'walkin' = 散客
    mode: 'walkin',
    checkinId: 0,
    // 顾客已扫码、还没授权手机号
    waitingPhone: false,
    customer: { memberId: null, name: '', gender: '', cell: '' },

    // 店铺信息：由 shop-selector 通过 ShopSelected 事件回传
    currentShopName: '',
    shop: '',
    sale: 0,
    rent: 0,
    care: 0,
    restuarant: 0,
  },

  /* ---------- 生命周期 ---------- */
  // options.stage：扫码页跳过来时码的阶段。need_phone = 新顾客还要授权手机号，授权后弹窗告诉店员；
  // verified = 老顾客已有手机号，拉到会员信息直接显示
  onLoad(options) {
    this._pollTimer = null;
    const checkinId = Number(options.checkinId || 0);
    if (!checkinId) {
      this.setData({ mode: 'walkin' });
      return;
    }
    this._announceOnVerify = options.stage !== 'verified';
    this.setData({ mode: 'scan', checkinId, waitingPhone: true });
    this.pollCheckin();
  },

  onShow() {
    if (this.data.waitingPhone) this._startPolling();
  },

  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
  },

  /* ---------- 等顾客授权手机号 ---------- */
  _startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this.pollCheckin(), POLL_INTERVAL);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  pollCheckin() {
    const checkinId = this.data.checkinId;
    if (!checkinId || !this.data.waitingPhone) {
      this._stopPolling();
      return;
    }
    Promise.resolve(app.loginPromiseNew).then(() => {
      return data.getReceptCheckinByStaffPromise(checkinId, app.globalData.sessionKey);
    }).then((res) => {
      // 网络抖动 / 偶发错误：等下一轮再查
      if (!res || res.code !== 0 || !res.data) return;
      // 已改按散客开单，丢弃
      if (!this.data.waitingPhone) return;
      this.applyCheckin(res.data);
    });
  },

  applyCheckin(view) {
    if (view.stage !== 'verified') return;
    this._stopPolling();
    this.setData({
      waitingPhone: false,
      customer: {
        memberId: view.memberId,
        name: view.name || '',
        gender: view.gender || '',
        cell: view.cell || '',
      },
    });
    if (this._announceOnVerify) {
      wx.showModal({
        title: '顾客已授权手机号',
        content: '顾客已经授权了手机号 ' + (view.maskedCell || '') + '，请选择店铺和业务开单。',
        showCancel: false,
        confirmText: '知道了',
      });
    }
  },

  // 顾客不方便授权手机号：改按散客开单
  onWalkInInstead() {
    wx.showModal({
      title: '按散客开单',
      content: '顾客还没授权手机号。按散客开单后，顾客手机不会自动跳到付款页。确定吗？',
      success: (res) => {
        if (!res.confirm) return;
        this._stopPolling();
        this.setData({
          mode: 'walkin',
          waitingPhone: false,
          customer: { memberId: null, name: '', gender: '', cell: '' },
        });
      },
    });
  },

  /* ---------- 顶部顾客信息条（reception-member-bar） ---------- */
  onMemberDetail(e) {
    const memberId = (e && e.detail && e.detail.memberId) || this.data.customer.memberId;
    if (!memberId) return;
    wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + memberId });
  },

  // 散客填的手机号匹配到会员：挂上会员（只给散客挂，与 recept_new 一致）
  onMemberInfoFound(e) {
    const memberId = e && e.detail && e.detail.memberId;
    if (!memberId || this.data.customer.memberId) return;
    const member = (e.detail && e.detail.member) || {};
    const patch = { 'customer.memberId': memberId };
    const realName = (member.real_name || '').trim();
    const gender = (member.gender || '').trim();
    if (!this.data.customer.name && realName) patch['customer.name'] = realName;
    if (!this.data.customer.gender && (gender === '男' || gender === '女')) patch['customer.gender'] = gender;
    this.setData(patch);
  },

  onCustomerChange(e) {
    const d = e.detail || {};
    this.setData({
      'customer.name': d.name || '',
      'customer.gender': d.gender || '',
      'customer.cell': d.cell || '',
    });
  },

  /* ---------- 选店铺 ---------- */
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

  /* ---------- 选业务进入开单 ---------- */
  onBizTap(e) {
    const bizType = e.currentTarget.dataset.type;
    const { shop, sale, rent, care } = this.data;

    if (this.data.waitingPhone) {
      wx.showToast({ title: '请等顾客授权手机号', icon: 'none' });
      return;
    }
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

    const orderShop = receptionShop.orderShopFor(bizType, shop);
    const customer = this.data.customer;
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
});
