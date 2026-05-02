// pages/admin/reception/recept_new.js
// 业务开单（共享页）
// 责任划分（参考 pages/admin/recept/recept_new.js）：
//   * 顶级页：持有客户信息 / 订单数据，监听各 *-recept-form 子组件事件，
//             按需向 SnowmeetApi 同步订单（Rent/SaveRentRecept 等）
//   * 子组件：仅渲染表单 + 通过事件回传数据更新
//
// 当前实现：租赁开单第一步（rent-recept-form）。其他业务后续迭代。
const app = getApp();
const util = require('../../../utils/util.js');

const BIZ_LABELS = { rent: '租赁', maintain: '养护', retail: '零售' };

// 防御性解码：如果 options 已经是解码过的就原样返回；如果还是 %xx 格式则解一次
function safeDecode(v) {
  if (v == null) return v;
  const s = String(v);
  if (s.indexOf('%') < 0) return s;
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

Page({
  data: {
    bizType: '',
    bizLabel: '',
    shop: '',
    customer: {
      memberId: null,
      name: '',
      cell: '',
      cellMasked: '未提供',
      gender: '',
    },
    // 订单本地状态（与后端同步）
    order: {
      id: 0,
      code: null,
      type: '',
      shop: '',
      member_id: null,
      rentals: [],
    },
  },

  /* ---------- 生命周期 ---------- */

  async onLoad(options) {
    // 优先从订单id获取顾客信息，如果订单id为空或者从订单获取到的用户信息为空，则需要从参数获取顾客信息。
    const draft = wx.getStorageSync('reception_draft') || {};
    const bizType = safeDecode(options.bizType) || draft.bizType || 'rent';
    const shop = safeDecode(options.shop) || draft.shopName || '';

    let customer = { memberId: null, name: '', cell: '', gender: '' };
    let orderId = options.orderId ? safeDecode(options.orderId) : null;
    let orderCustomerLoaded = false;

    if (orderId) {
      try {
        const data = require('../../../utils/data.js');
        const sessionKey = app.globalData.sessionKey || '';
        const order = await data.getOrderByStaffPromise(orderId, sessionKey);
        if (order && (order.contact_name || order.contact_num || order.member_id)) {
          customer = {
            memberId: order.member_id || null,
            name: order.contact_name || '',
            cell: order.contact_num || '',
            gender: order.contact_gender || '',
          };
          orderCustomerLoaded = true;
        }
      } catch (e) {
        console.warn('Failed to load order by orderId:', e);
      }
    }

    if (!orderCustomerLoaded) {
      // fallback to params/draft
      customer = {
        memberId: options.memberId ? Number(safeDecode(options.memberId)) : null,
        name: safeDecode(options.customerName) || draft.customerName || '',
        cell: safeDecode(options.customerCell) || draft.customerCell || '',
        gender: safeDecode(options.gender) || draft.gender || '',
      };
    }

    this.setData({
      bizType,
      bizLabel: BIZ_LABELS[bizType] || '业务',
      shop,
      customer,
      'order.type': BIZ_LABELS[bizType] || '',
      'order.shop': shop,
      'order.member_id': customer.memberId,
    });
  },

  onShow() {},

  /* ---------- 通用：返回 / 顶部 ---------- */
  onBack() { wx.navigateBack({ delta: 1 }); },

  onMemberDetail(e) {
    const memberId = (e && e.detail && e.detail.memberId) || this.data.customer.memberId;
    if (!memberId) return;
    // TODO: 接入新版会员详情页；当前临时复用旧页面
    wx.navigateTo({
      url: '/pages/admin/recept/recept_member_info?memberId=' + memberId,
    });
  },

  onMemberInfoFound(e) {
    const memberId = e && e.detail && e.detail.memberId;
    if (!memberId) return;
    if (this.data.customer && this.data.customer.memberId === memberId) return;
    this.setData({
      'customer.memberId': memberId,
      'order.member_id': memberId,
    });
  },

  /* ---------- 子组件：rent-recept-form 事件 ---------- */
  /**
   * 子组件每次购物车变化都会触发 syncRent
   * 参考 recept_new.js 的 rentDataUpdated → saveReceptOrder
   */
  onSyncRent(e) {
    const detail = e.detail || {};
    const rentals = detail.rentals || [];
    this.setData({ 'order.rentals': rentals });
    this.saveRentReceptOrder(); // 持久化到后端
  },

  onAddAction(e) {
    const action = (e.detail || {}).action;
    if (action === 'package') {
      wx.navigateTo({
        url: '/pages/admin/reception/recept_package?shop=' + encodeURIComponent(this.data.shop || ''),
        events: {
          rentalsSelected: (rentals) => {
            this._appendRentals(rentals);
          },
        },
      });
      return;
    }
    if (action === 'scan') {
      wx.scanCode({
        success: (res) => {
          wx.showToast({ title: '已扫码：' + (res.result || '').slice(0, 12), icon: 'none' });
          // TODO: 调 Rent/QueryByBarcode 后追加到购物车
        },
      });
      return;
    }
    const labels = { search: '搜索单品', noCode: '无码物品' };
    wx.showToast({ title: (labels[action] || '操作') + '（下一步迭代）', icon: 'none' });
  },

  _appendRentals(rentals) {
    const current = (this.data.order && this.data.order.rentals) ? this.data.order.rentals.slice() : [];
    const merged = current.concat(rentals);
    this.setData({ 'order.rentals': merged });
    this.saveRentReceptOrder();
  },

  onEditRental(e) {
    // TODO: 弹出押金 / 租金 / 起租 / 租赁形式 / 装备录入面板
    wx.showToast({ title: '编辑租赁明细（下一步迭代）', icon: 'none' });
  },

  onSortChange(e) {
    // 按时间 / 按品种切换：第一步先记录，后续在子组件中按 sort 重排
    // const { sort } = e.detail;
  },

  onCheckout(e) {
    // 进入支付环节（下一步迭代再做）
    wx.showToast({ title: '去结算（下一步迭代）', icon: 'none' });
    // TODO: navigate 到支付页 / 弹出 rent-back-drop
  },

  /* ---------- 与后端同步：调 Rent/SaveRentRecept ---------- */
  saveRentReceptOrder() {
    const order = this.data.order;
    if (!order.shop) {
      wx.showToast({ title: '店铺不能为空', icon: 'error' });
      return;
    }
    if (!order.rentals || order.rentals.length === 0) {
      // 空购物车不调接口（避免首次进入就生成空订单）
      return;
    }

    // 复制并清理 rental，避免循环引用 / 后端拒收（与旧 recept_new 一致）
    const payload = {
      ...order,
      contact_name:   this.data.customer.name || null,
      contact_gender: this.data.customer.gender || null,
      contact_num:    this.data.customer.cell || null,
      member_id:      this.data.customer.memberId || null,
      type:           '租赁',
      valid:          0,
      recepting:      1,
      rentals: (order.rentals || []).map((r) => {
        const copy = { ...r };
        if (copy.startDate) copy.startDate = util.formatDate(new Date(copy.startDate));
        if (copy.pricePresets) {
          copy.pricePresets = copy.pricePresets.map((p) => ({ ...p, id: 0 }));
        }
        copy.details = null;
        copy.category = null;
        return copy;
      }),
    };

    const url = app.globalData.requestPrefix
      + 'Rent/SaveRentRecept?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, payload).then((submitted) => {
      // 后端返回的最新 order，本地同步（保持 timeStamp 用于 wx:key）
      if (submitted && submitted.rentals) {
        submitted.rentals.forEach((r) => {
          r.timeStamp = (new Date(r.create_date || Date.now())).getTime();
        });
      }
      this.setData({ order: submitted });
    }).catch((err) => {
      console.warn('saveRentReceptOrder failed', err);
    });
  },
});
