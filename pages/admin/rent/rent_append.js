// pages/admin/rent/rent_append.js
// 追加租赁商品（独立追加页）：在已有租赁订单上追加新的租赁商品/租赁物。
// 录入规则与开单一致（内嵌 rent-recept-form）。
//
// 草稿态：后端 Rental.appending=true（AppendRental 建草稿入库）。详情页「追加租赁商品」卡片区可见、可删=放弃。
// 确认追加（组件「去结算」按钮 → onConfirmAppend）：前端预估应付押金分流：
//   应付>0 → SaveAppendings → 跳结算页，支付成功后追加项 EffectRental 生效
//   应付=0 → 二次确认 modal → SaveAppendings（免押当场生效）
//
// v1 取舍（见交付说明）：套餐/单品走 AppendRental 后端建草稿（单品到品类级，编码在卡片内补录/扫码）；
//   中途编辑暂不持久化（确认追加时一次性 SaveAppendings 落盘），中途退出回详情页草稿为后端默认值。
const app = getApp();
const util = require('../../../utils/util.js');
const data = require('../../../utils/data.js');

function safeDecode(v) {
  if (v == null) return v;
  const s = String(v);
  if (s.indexOf('%') < 0) return s;
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

Page({
  data: {
    shop: '',
    order: { id: 0, code: null, shop: '', member_id: null, appendingRentals: [] },
  },

  async onLoad(options) {
    await app.loginPromiseNew;
    const orderId = options.orderId ? safeDecode(options.orderId) : null;
    const shop = safeDecode(options.shop) || '';
    this.setData({ shop });
    if (!orderId) {
      wx.showToast({ title: '缺少订单号', icon: 'none' });
      return;
    }
    this._loadOrder(orderId);
  },

  _loadOrder(orderId) {
    const that = this;
    const sessionKey = app.globalData.sessionKey || '';
    wx.showLoading({ title: '加载中', mask: true });
    data.getOrderByStaffPromise(orderId, sessionKey).then(function (order) {
      wx.hideLoading();
      if (!order || !order.id) {
        wx.showToast({ title: '订单不存在', icon: 'none' });
        return;
      }
      that._setOrder(order);
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 把后端 order 的 appendingRentals 中的草稿（appending=true）装入购物车。
  // 后端 AppendRental 建的草稿缺开单组件需要的前端字段（class_name/categoryName/chooseCategories…），
  // 按开单 recept_package 的结构从 rentItem.category 兜底补齐，使内嵌 rent-recept-form 渲染
  //（分类行/标题/品类选择）与开单一致。GetOrder 已 Include rentItems.category，故 it.category 可用。
  _setOrder(order) {
    const drafts = (order.appendingRentals || []).filter(function (r) {
      return r.appending === true || r.appending === 1;
    });
    drafts.forEach(function (r) {
      r.timeStamp = (new Date(r.create_date || Date.now())).getTime();
      if (r.realGuaranty == null) r.realGuaranty = r.guaranty;
      // 追加默认「立即租赁」（顾客现场即用）：模式未选时默认立即租赁 + 起租=今天当前时分；
      // atOnce 一律按 pick_type 派生（立即租赁→true），覆盖后端 atOnce 默认 false 的不一致
      if (r.pick_type == null) {
        r.pick_type = '立即租赁';
        const now = new Date();
        const pad = function (n) { return String(n).padStart(2, '0'); };
        r.start_date = util.formatDate(now) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':00';
      }
      r.atOnce = (r.pick_type === '立即租赁');
      (r.rentItems || []).forEach(function (it) {
        const catName = (it.category && it.category.name) || it.class_name || '';
        if (!it.class_name) it.class_name = catName;
        if (!it.categoryName) it.categoryName = it.class_name || catName;
        if (it.chooseingCategory == null) it.chooseingCategory = false;
        if (it.canChooseCategory == null) it.canChooseCategory = false;
        if (!it.chooseCategories) it.chooseCategories = it.category ? [it.category] : [];
        if (it.pick_type == null) it.pick_type = r.pick_type || '立即租赁';
        it.atOnce = (it.pick_type === '立即租赁');
      });
    });
    order.appendingRentals = drafts;
    this.setData({ shop: order.shop || this.data.shop, order });
  },

  onBack() { wx.navigateBack({ delta: 1 }); },

  /* ---------- rent-recept-form 事件 ---------- */

  // 编辑同步：实时保存草稿（SaveAppendings commit=false：只持久化字段，不提交/不生效）。
  // 同时检测组件左划删除的草稿（id 在旧购物车有、新购物车没了）→ 即时 RemoveAppendingRental。
  onSyncRent(e) {
    const detail = e.detail || {};
    const newRentals = detail.rentals || [];
    const old = (this.data.order && this.data.order.appendingRentals) || [];
    const newIds = {};
    newRentals.forEach(function (r) { if (r.id) newIds[r.id] = true; });
    const removed = old.filter(function (r) { return r.id && !newIds[r.id]; });
    this.setData({ 'order.appendingRentals': newRentals });
    if (removed.length > 0) {
      // 删除走 RemoveAppendingRental（草稿置 valid=0），本次不再实时保存（避免与删除竞态）
      let chain = Promise.resolve();
      removed.forEach(function (r) {
        chain = chain.then(function () {
          const delUrl = app.globalData.requestPrefix
            + 'Rent/RemoveAppendingRental/' + r.id.toString()
            + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
          return util.performWebRequest(delUrl, null);
        });
      });
      chain.catch(function () {});
      return;
    }
    this._saveDraft(newRentals);
  },

  // 实时保存草稿（commit=false：后端只 SaveAppendingRental 持久化字段，保持 appending=true，不提交不生效）。
  // fire-and-forget，不回设 order 以免打断用户输入；后端已落盘，重进页面会加载到最新草稿。
  _saveDraft(rentals) {
    const order = this.data.order;
    if (!order || !order.id) return;
    const list = (rentals || []).filter(function (r) { return r.id; });
    if (list.length === 0) return;
    const url = app.globalData.requestPrefix
      + 'Rent/SaveAppendings/' + order.id.toString()
      + '?commit=false&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, list).catch(function () {});
  },

  onAddAction(e) {
    const action = (e.detail || {}).action;
    const that = this;
    if (action === 'package') {
      wx.navigateTo({
        url: '/pages/admin/reception/recept_package?shop=' + encodeURIComponent(this.data.shop || ''),
        events: {
          rentalsSelected: function (rentals) {
            that._appendByPackages(rentals);
          },
        },
      });
      return;
    }
    if (action === 'scan') {
      wx.showToast({ title: '扫码追加（下一步迭代）', icon: 'none' });
      return;
    }
    if (action === 'noCode') {
      this._appendBlank();
      return;
    }
    // action === 'search' 由组件内部开搜索 modal → addSingleProduct 事件
  },

  // 无码物品：后端建无分类空白草稿（category_id=null），用户在卡片内点「分类」选定后由组件联动（同开单）
  _appendBlank() {
    const that = this;
    const order = this.data.order;
    wx.showLoading({ title: '添加中', mask: true });
    const url = app.globalData.requestPrefix
      + 'Rent/AppendRental/' + order.id.toString()
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, null).then(function (updatedOrder) {
      wx.hideLoading();
      if (updatedOrder) that._setOrder(updatedOrder);
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  // 套餐：用 recept_package 返回 rental 的 package_id 逐个 AppendRental 后端建草稿
  _appendByPackages(rentals) {
    const that = this;
    const order = this.data.order;
    const list = (rentals || []).filter(function (r) { return r.package_id; });
    if (list.length === 0) return;
    wx.showLoading({ title: '添加中', mask: true });
    let chain = Promise.resolve(null);
    list.forEach(function (r) {
      chain = chain.then(function () {
        const url = app.globalData.requestPrefix
          + 'Rent/AppendRental/' + order.id.toString()
          + '?packageId=' + r.package_id
          + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
        return util.performWebRequest(url, null);
      });
    });
    chain.then(function (updatedOrder) {
      wx.hideLoading();
      if (updatedOrder) that._setOrder(updatedOrder);
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  // 单品：组件内搜到具体 product → 传 rentProductId，后端建草稿时直接填编码/名称（同开单）
  onAddSingleProduct(e) {
    const product = (e.detail || {}).product;
    if (!product || !product.category) return;
    const that = this;
    const order = this.data.order;
    wx.showLoading({ title: '添加中', mask: true });
    const url = app.globalData.requestPrefix
      + 'Rent/AppendRental/' + order.id.toString()
      + '?categoryId=' + product.category.id
      + '&rentProductId=' + product.id
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, null).then(function (updatedOrder) {
      wx.hideLoading();
      if (updatedOrder) that._setOrder(updatedOrder);
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  onEditRental() {},
  onSortChange() {},

  // 「确认追加」（组件「去结算」按钮触发 checkout）：前端预估应付押金分流
  onConfirmAppend() {
    const that = this;
    const order = this.data.order;
    const appendings = (order && order.appendingRentals) || [];
    if (appendings.length === 0) {
      wx.showToast({ title: '请先添加追加项', icon: 'none' });
      return;
    }
    // 预估应付押金（押金净额合计）：>0 走支付、=0 走二次确认
    let totalDeposit = 0;
    appendings.forEach(function (r) {
      if (r.noGuaranty) return;
      let d = r.realGuaranty;
      if (d == null) d = (r.guaranty || 0) - (r.guaranty_discount || 0);
      totalDeposit += (d || 0);
    });
    if (totalDeposit > 0) {
      that._doSaveAppendings(true);
    } else {
      wx.showModal({
        title: '确认追加',
        content: '本次追加无需支付，确认后立即生效。',
        confirmText: '确认',
        complete: function (res) {
          if (res.confirm) that._doSaveAppendings(false);
        }
      });
    }
  },

  _doSaveAppendings(needPay) {
    const that = this;
    const order = this.data.order;
    const appendings = order.appendingRentals || [];
    wx.showLoading({ title: needPay ? '生成支付' : '确认中', mask: true });
    const url = app.globalData.requestPrefix
      + 'Rent/SaveAppendings/' + order.id.toString()
      + '?commit=true&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, appendings).then(function (updatedOrder) {
      wx.hideLoading();
      if (updatedOrder && updatedOrder.paying_amount > 0) {
        // 应付>0：跳结算页，支付成功后追加项生效（settle.onPaid 自行收尾）
        wx.redirectTo({ url: '/pages/payment/settle/index?orderId=' + updatedOrder.id });
      } else {
        // 应付=0：免押当场生效，返回详情页
        wx.showToast({ title: '追加成功', icon: 'success' });
        setTimeout(function () { wx.navigateBack({ delta: 1 }); }, 700);
      }
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '确认失败', icon: 'none' });
    });
  },
});
