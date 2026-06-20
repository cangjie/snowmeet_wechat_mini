// pages/admin/reception/recept_entry.js
// 现场开单入口 - 新版接待流程
// 替代旧版 pages/admin/recept/recept_entry（QR 扫码 + WebSocket 实时身份验证）
// PRD §1.4.5 现场开单流程：
//   第一步 录入订单标识信息（姓名 / 手机号非必填）
//   第二步 选择业务类型（零售 / 养护 / 租赁）→ 进入对应业务开单
//   第三步 顾客扫码支付时再做账户匹配（不在本页处理）
//
// 后端依赖（SnowmeetApi）：
//   GET Order/GetShops（由 components/shop_selector 内部调用）
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');

// 把用户输入归一化：去掉空格/横杠/括号，0044... → +44...
function normalizePhone(raw) {
  let normalized = String(raw || '').trim().replace(/[\s\-()]/g, '');
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }
  return normalized;
}

function isValidInternationalPhone(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;

  // 允许国际常见输入形式：+65 8123 4567 / (852) 5123-4567 / 0044 7700 900123
  const normalized = normalizePhone(value);

  if (normalized.startsWith('+')) {
    // E.164: + 后 6~15 位数字，首位不能是 0
    return /^\+[1-9]\d{5,14}$/.test(normalized);
  }

  // 未带国家区号时，兼容本地写法：7~15 位数字（覆盖 US/HK/SG/EU 常见长度）
  return /^\d{7,15}$/.test(normalized);
}

// 号码是否「完整到可以拿去查会员」：明确带国家区号(+) 或 国内 11 位手机号。
// 避免在国内号码输到 7~10 位（isValidInternationalPhone 已为 true）时就反复发查询。
function shouldLookupPhone(normalized) {
  if (!isValidInternationalPhone(normalized)) return false;
  if (normalized.startsWith('+')) return true;
  return /^\d{11}$/.test(normalized);
}

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
    customerReadyForService: false,

    // 找回中断订单面板
    showRecoverPanel: false,
    recoverLoading: false,
    recoverOrders: [],
  },

  /* ---------- 生命周期 ---------- */
  onLoad() {
    // shop-selector 自身依赖 app.loginPromiseNew，这里无需重复
    this._lookupTimer = null;   // 手机号查会员的防抖定时器
    this._lastLookupCell = '';  // 最近一次已查询的号码，去重避免重复请求
  },

  onShow() {},

  onUnload() {
    if (this._lookupTimer) {
      clearTimeout(this._lookupTimer);
      this._lookupTimer = null;
    }
  },

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
  onNameInput(e) {
    this.setData({ customerName: e.detail.value });
    this.updateCustomerReadyState();
  },
  onGenderTap(e) {
    this.setData({ gender: e.currentTarget.dataset.value });
    this.updateCustomerReadyState();
  },

  onCellInput(e) {
    const cell = (e.detail.value || '').trim();
    this.setData({ customerCell: cell });
    this.updateCustomerReadyState();
    this.scheduleMemberLookup(cell);
  },

  /* ---------- 手机号匹配会员 → 自动回填姓名/性别 ---------- */
  // 输入手机号时防抖触发查询：号码不完整时不查，号码完整且与上次不同才发请求
  scheduleMemberLookup(cell) {
    if (this._lookupTimer) {
      clearTimeout(this._lookupTimer);
      this._lookupTimer = null;
    }
    const normalized = normalizePhone(cell);
    if (!shouldLookupPhone(normalized)) {
      this._lastLookupCell = '';  // 号码删短不完整时重置，便于重新输完再次查询
      return;
    }
    this._lookupTimer = setTimeout(() => {
      this._lookupTimer = null;
      this.tryMatchMemberByCell(normalized);
    }, 450);
  },

  tryMatchMemberByCell(normalized) {
    // 防抖期间号码可能又改了，用当前框里的值复核
    const current = normalizePhone(this.data.customerCell);
    if (current !== normalized || !shouldLookupPhone(current) || current === this._lastLookupCell) {
      return;
    }
    this._lastLookupCell = current;

    // 登录(app.loginPromiseNew)是异步的：wx.login + MemberLogin 网络往返后才会写入
    // app.globalData.sessionKey / requestPrefix。入口页是落地首页、自己没 await 登录，
    // 落地后立刻输入手机号可能在登录返回前就触发查询 → sessionKey 为空 → 后端判无权限 → 查不到。
    // 这里先等登录完成再查（与 recept_new 一致），杜绝这个竞态。
    Promise.resolve(app.loginPromiseNew).then(() => {
      return data.getMemberByNumSilentPromise(current);
    }).then((member) => {
      // 非会员 / 无权限 / 网络错：保持安静，店员手动录入即可
      if (!member || !(member.id || member.member_id || member.memberId)) {
        return;
      }
      // 异步返回时号码若已被改动，丢弃这次回填
      if (normalizePhone(this.data.customerCell) !== current) {
        return;
      }
      // 用会员档案里的姓名/性别覆盖（仅在档案有值时覆盖，空值不清掉已填内容）
      const patch = {};
      const realName = (member.real_name || '').trim();
      const gender = (member.gender || '').trim();
      if (realName) {
        patch.customerName = realName;
      }
      if (gender === '男' || gender === '女') {
        patch.gender = gender;
      }
      if (Object.keys(patch).length === 0) {
        // 命中会员但档案没有姓名/性别——没东西可填。打日志便于排查是「查不到」还是「查到了但空」
        console.warn('[recept_entry] 命中会员但 real_name/gender 均为空，无可回填', current, member);
        return;
      }
      this.setData(patch);
      this.updateCustomerReadyState();
      wx.showToast({ title: '已匹配会员信息', icon: 'none', duration: 1500 });
    });
  },

  updateCustomerReadyState() {
    const customerName = (this.data.customerName || '').trim();
    const customerCell = (this.data.customerCell || '').trim();
    const gender = (this.data.gender || '').trim();
    const customerReadyForService = !!customerName && !!gender && isValidInternationalPhone(customerCell);
    this.setData({ customerReadyForService });
  },

  /* ---------- 直接点击业务卡片进入开单 ---------- */
  onBizTap(e) {
    const bizType = e.currentTarget.dataset.type;
    const { shop, sale, rent, care } = this.data;
    const customerName = (this.data.customerName || '').trim();
    const customerCell = (this.data.customerCell || '').trim();

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

    if (bizType === 'maintain' || bizType === 'rent') {
      const gender = (this.data.gender || '').trim();
      if (!customerName || !customerCell || !gender) {
        wx.showToast({ title: '养护和租赁需填写姓名、手机号和性别', icon: 'none' });
        return;
      }
      if (!isValidInternationalPhone(customerCell)) {
        wx.showToast({ title: '请输入正确国际手机号', icon: 'none' });
        return;
      }
    }

    // 暂存订单标识信息（PRD §1.4.6 订单找回）
    const draft = {
      shopName: shop,
      customerName: customerName,
      gender: this.data.gender,
      customerCell: customerCell,
      bizType: bizType,
      createdAt: Date.now(),
    };
    wx.setStorageSync('reception_draft', draft);

    // 进入新版业务开单共享页（pages/admin/reception/recept_new）
    // 由该页根据 bizType 渲染对应的接待表单组件（rent / maintain / retail）
    //
    const params = [
      'bizType=' + encodeURIComponent(bizType),
      'shop=' + encodeURIComponent(shop),
      'customerName=' + encodeURIComponent(customerName),
      'gender=' + encodeURIComponent(this.data.gender || ''),
      'customerCell=' + encodeURIComponent(customerCell),
    ];
    wx.navigateTo({ url: '/pages/admin/reception/recept_new?' + params.join('&') });
  },

  /* ---------- 其他交互 ---------- */
  onTabChange(e) {
    // reception-tabbar 默认会处理路由；这里只在需要时拦截/记录
    // const key = e.detail.key;
  },

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

  // 兼容：之前 wxml 里曾绑定过 onPickShop（现在已移除），保留空函数避免外链调用报错
  onPickShop() {},
});
