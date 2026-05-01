// pages/admin/reception/recept_entry.js
// 现场开单入口 - 新版接待流程
// 替代旧版 pages/admin/recept/recept_entry（QR 扫码 + WebSocket 实时身份验证）
// PRD §1.4.5 现场开单流程：
//   第一步 录入订单标识信息（姓名 / 手机号非必填）
//   第二步 选择业务类型（零售 / 养护 / 租赁）→ 进入对应业务开单
//   第三步 顾客扫码支付时再做账户匹配（不在本页处理）
//
// 后端依赖（SnowmeetApi）：
//   GET Member/GetMemberByNum?num={cell}&type=cell&sessionKey={key}
//        → ApiResult<Member?>，code=0 命中，code=1 未找到
//   GET Order/GetShops（由 components/shop_selector 内部调用）
const app = getApp();
const util = require('../../../utils/util.js');

let cellLookupTimer = null;

Page({
  data: {
    // 店铺信息：由 shop-selector 通过 ShopSelected 事件回传
    currentShopName: '',
    shop: '',           // 兼容旧逻辑：保留 shop 字段
    sale: 0,            // 1 = 此店支持零售
    rent: 0,            // 1 = 此店支持租赁
    care: 0,            // 1 = 此店支持养护
    restuarant: 0,      // 1 = 此店支持餐饮（暂未在新流程展示）

    // 顾客信息（PRD：姓名 / 手机号非必填）
    customerName: '',
    gender: '',
    customerCell: '',
    matchedMember: null,
    cellLooking: false,
    cellLooked: false,
  },

  /* ---------- 生命周期 ---------- */
  onLoad() {
    // shop-selector 自身依赖 app.loginPromiseNew，这里无需重复
  },

  onShow() {},

  /* ---------- shop-selector 回调（沿用旧系统的事件名/字段） ---------- */
  shopSelected(e) {
    const { shop, sale, rent, care, restuarant } = e.detail || {};
    this.setData({
      currentShopName: shop || '',
      shop: shop || '',
      sale: sale || 0,
      rent: rent || 0,
      care: care || 0,
      restuarant: restuarant || 0,
    });
  },

  /* ---------- 表单输入 ---------- */
  onNameInput(e) { this.setData({ customerName: e.detail.value }); },
  onGenderTap(e) { this.setData({ gender: e.currentTarget.dataset.value }); },

  onCellInput(e) {
    const cell = (e.detail.value || '').trim();
    this.setData({ customerCell: cell });
    if (this.data.matchedMember || this.data.cellLooked) {
      this.setData({ matchedMember: null, cellLooked: false });
    }
    if (cell.length === 11) {
      if (cellLookupTimer) clearTimeout(cellLookupTimer);
      cellLookupTimer = setTimeout(() => this.lookupMemberByCell(cell), 350);
    }
  },

  onCellBlur(e) {
    const cell = (e.detail.value || '').trim();
    if (cell.length === 11 && !this.data.cellLooked && !this.data.cellLooking) {
      this.lookupMemberByCell(cell);
    }
  },

  /* ---------- 调用 SnowmeetApi 查会员 ---------- */
  lookupMemberByCell(cell) {
    if (!/^1\d{10}$/.test(cell)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }
    this.setData({ cellLooking: true });
    const url = app.globalData.requestPrefix
      + 'Member/GetMemberByNum?num=' + encodeURIComponent(cell)
      + '&type=cell'
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, undefined)
      .then((member) => {
        this.setData({
          matchedMember: member || null,
          cellLooked: true,
          cellLooking: false,
        });
      })
      .catch(() => {
        this.setData({
          matchedMember: null,
          cellLooked: true,
          cellLooking: false,
        });
      });
  },

  /* ---------- 直接点击业务卡片进入开单 ---------- */
  onBizTap(e) {
    const bizType = e.currentTarget.dataset.type;
    const { shop, sale, rent, care } = this.data;

    if (!shop) {
      wx.showToast({ title: '请先选择店铺', icon: 'none' });
      return;
    }
    // 沿用旧系统的能力校验
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

    // 暂存订单标识信息（PRD §1.4.6 订单找回）
    const draft = {
      shopName: shop,
      customerName: this.data.customerName,
      gender: this.data.gender,
      customerCell: this.data.customerCell,
      matchedMemberId: this.data.matchedMember ? this.data.matchedMember.id : null,
      bizType: bizType,
      createdAt: Date.now(),
    };
    wx.setStorageSync('reception_draft', draft);

    // 进入新版业务开单共享页（pages/admin/reception/recept_new）
    // 由该页根据 bizType 渲染对应的接待表单组件（rent / maintain / retail）
    const memberId = draft.matchedMemberId;
    const params = [
      'bizType=' + encodeURIComponent(bizType),
      'shop=' + encodeURIComponent(shop),
    ];
    if (memberId)               params.push('memberId=' + encodeURIComponent(memberId));
    if (draft.customerName)     params.push('realName=' + encodeURIComponent(draft.customerName));
    if (draft.customerCell)     params.push('cell=' + encodeURIComponent(draft.customerCell));
    if (draft.gender)           params.push('gender=' + encodeURIComponent(draft.gender));
    wx.navigateTo({ url: '/pages/admin/reception/recept_new?' + params.join('&') });
  },

  /* ---------- 其他交互 ---------- */
  onTabChange(e) {
    // reception-tabbar 默认会处理路由；这里只在需要时拦截/记录
    // const key = e.detail.key;
  },

  onRecoverOrder() {
    wx.showToast({ title: '订单找回（待实现）', icon: 'none' });
  },

  // 兼容：之前 wxml 里曾绑定过 onPickShop（现在已移除），保留空函数避免外链调用报错
  onPickShop() {},
});
