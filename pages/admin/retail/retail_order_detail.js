// pages/admin/retail/retail_order_detail.js
// 新版零售订单详情页（Alpine Operational Minimalist，对标 care_order_detail / rent_order_detail）
// 能力与旧版一致：查看订单 / 改顾客信息（姓名、性别、手机号）/ 改零售内容（七色米单号、订单类型、
// 金额（未收款时）、备注、照片增删）/ 未收款时去收款。旧版内嵌的支付组件改为跳通用结算页。
// 入口：零售订单列表、会员详情最近订单、结算页「查看订单」，参数均为 ?id=订单id。
const app = getApp();
const util = require('../../../utils/util.js');
const data = require('../../../utils/data.js');
const retailRules = require('../../../utils/retail.js');

const IMG_HOST = data.IMAGE_HOST;
const MAX_IMAGES = 5;

function fullUrl(p) {
  if (!p) return '';
  return p.indexOf('http') === 0 ? p : IMG_HOST + p;
}

// 手机号脱敏：保留前 3 后 4，中间打码；空值返回 '—'（与 care/rent 详情页同款）
function maskCell(cell) {
  if (!cell && cell !== 0) return '—';
  const s = String(cell).trim();
  if (!s) return '—';
  if (/^\d{11}$/.test(s)) return s.substr(0, 3) + '****' + s.substr(7);
  if (s.length > 7) return s.substr(0, 3) + '****' + s.substr(s.length - 4);
  if (s.length > 4) return s.substr(0, s.length - 4) + '****';
  return '****';
}

function statusChipClass(status) {
  switch (status) {
    case '支付成功': return 'chip-success';
    case '待支付':
    case '待生成':
    case '部分支付': return 'chip-pending';
    case '挂账': return 'chip-warn';
    case '已下单': return 'chip-primary';
    default: return 'chip-muted';
  }
}

// 给 UpdateOrderWithDetailByStaff 的载荷。后端用 _db.Update(order) 整图附加：
//   - 同一会员会同时挂在 order.member / payment.member / refund.member 上，整图附加会因同键
//     多实例撞键 500 → 去掉这些嵌套的会员/店员导航（order.member 后端本来也会置空）；
//   - payments / refunds 本身保留：后端会对订单逐属性写差异日志（含 paidAmount、orderStatus 这类
//     计算属性），清空它们会每次多记几条「已付金额 100→0」的误导日志。载荷取自保存前刚拉的最新订单，
//     整图写回的就是库里的当前值。
function stripForDetailUpdate(order) {
  const payload = { ...order };
  payload.member = null;
  payload.payments = (order.payments || []).map((p) => ({
    ...p,
    member: null,
    staff: null,
    refunds: (p.refunds || []).map((r) => ({ ...r, member: null, payment: null })),
  }));
  payload.retails = (order.retails || []).map((r) => {
    const keep = { ...r };
    delete keep.order;
    delete keep.product;
    delete keep.punchCard;
    delete keep.logs;
    return keep;
  });
  payload.retailImages = (order.retailImages || []).map((im) => ({
    id: im.id || 0,
    order_id: order.id,
    image_id: im.image_id,
    valid: true,
  }));
  return payload;
}

Page({
  data: {
    id: 0,
    order: null,
    retail: null,
    view: {},
    payment: { paidStr: '', refundStr: '', payRows: [], refundRows: [], expanded: false },
    // 顾客信息编辑
    contactEditing: false,
    contactDraft: { name: '', gender: '', cell: '' },
    savingContact: false,
    // 零售内容编辑
    retailEditing: false,
    retailDraft: null,
    typeOptions: [],
    mi7Hint: '',
    savingRetail: false,
    maxImages: MAX_IMAGES,
  },

  onLoad(options) {
    this.setData({ id: parseInt(options.id || options.orderId, 10) || 0 });
  },

  onShow() {
    // 编辑中不自动刷新：选照片 / 拍照返回会触发 onShow，整页重载会丢编辑内容
    if (this.data.contactEditing || this.data.retailEditing) return;
    const that = this;
    Promise.resolve(app.loginPromiseNew).then(() => that.loadOrder());
  },

  loadOrder() {
    const that = this;
    if (!this.data.id) return Promise.resolve(null);
    return data.getOrderByStaffPromise(this.data.id, app.globalData.sessionKey).then((order) => {
      that.renderOrder(order);
      return order;
    }).catch((e) => {
      console.warn('load retail order failed', e);
    });
  },

  renderOrder(order) {
    const retail = (order.retails || [])[0] || null;
    const bizDate = order.biz_date ? new Date(order.biz_date) : null;
    const member = order.member || null;
    let memberShip = '散客';
    if (member && member.following_wechat == 1) memberShip = '会员';
    else if (member) memberShip = '散客(取关)';
    const entertain = !!(retail && (retail.order_type || '').trim() === '招待');
    const paid = order.paidAmount || 0;
    const status = order.orderStatus || '';
    const unpaid = order.valid == 1 && order.dealed != 1 && order.closed != 1 && paid === 0;
    const payingAmount = order.paying_amount || 0;
    const photos = (order.retailImages || []).map((im) => {
      const img = im.image || {};
      return {
        id: im.id,
        image_id: im.image_id,
        url: fullUrl(img.file_path_name),
        thumb: fullUrl(img.thumbUrl || img.file_path_name),
      };
    });
    const view = {
      code: order.code || ('#' + order.id),
      bizDateStr: bizDate ? util.formatDate(bizDate) + ' ' + util.formatTimeStr(bizDate) : '',
      staffName: (order.staff && (order.staff.name || order.staff.real_name)) || '',
      status,
      statusChip: statusChipClass(status),
      customerName: order.contact_name || '',
      customerTitle: order.contact_gender === '男' ? '先生' : (order.contact_gender === '女' ? '女士' : ''),
      gender: order.contact_gender || '',
      cell: order.contact_num || '',
      memberShip,
      memberChip: memberShip === '会员' ? 'chip-primary' : 'chip-muted',
      mi7: retail ? (retail.mi7_code || '') : '',
      retailType: (retail && retail.retail_type) || '未填',
      entertain,
      amountStr: util.showAmount(retail ? retail.deal_price : order.total_amount),
      giveupScore: !!(retail && retail.giveup_score == 1),
      memo: (retail && retail.memo) || '',
      photos,
      // 收款入口：未收款的有效单都能去结算页（招待单 0 元 → 结算页「确认生效」）
      showGoPay: unpaid,
      goPayLabel: payingAmount > 0 ? ('去收款 ' + util.showAmount(payingAmount)) : '去确认生效',
      // 金额只在未收款、非招待时可改（旧版口径：paying_amount 还在才可改）
      canEditAmount: unpaid && !entertain,
    };
    // 支付明细（与养护/租赁详情页同款）
    const payRows = (order.availablePayments || []).map((p) => {
      const d = new Date(p.paid_date || p.create_date);
      const isProxy = p.is_proxy_pay === true || p.is_proxy_pay === 1;
      return {
        ...p,
        paid_dateDateStr: util.formatDate(d),
        paid_dateTimeStr: util.formatTimeStr(d),
        amountStr: util.showAmount(p.amount || 0),
        _isProxy: isProxy,
        _proxyCellMasked: isProxy ? maskCell(p.cell) : '',
      };
    });
    const refundRows = (order.availableRefunds || []).map((r) => {
      const d = new Date(r.create_date);
      return {
        ...r,
        paid_dateDateStr: util.formatDate(d),
        paid_dateTimeStr: util.formatTimeStr(d),
        amountStr: util.showAmount(r.amount || 0),
        pay_method: r.pay_method || (r.payment && r.payment.pay_method) || '',
      };
    });
    this.setData({
      order,
      retail,
      view,
      payment: {
        ...this.data.payment,
        paidStr: util.showAmount(paid),
        refundStr: util.showAmount(order.refundAmount || 0),
        payRows,
        refundRows,
      },
    });
  },

  /* ---------- 通用 ---------- */
  onCall() {
    const num = this.data.order && this.data.order.contact_num;
    if (num) wx.makePhoneCall({ phoneNumber: num });
  },
  onTogglePayment() {
    this.setData({ 'payment.expanded': !this.data.payment.expanded });
  },
  onPhotoTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const urls = (this.data.view.photos || []).map((p) => p.url);
    wx.previewImage({ urls, current: urls[idx] });
  },
  onGoPay() {
    const order = this.data.order;
    if (!order) return;
    wx.navigateTo({ url: '/pages/payment/settle/index?orderId=' + order.id });
  },

  /* ---------- 顾客信息编辑 ---------- */
  onContactEditTap() {
    const order = this.data.order;
    if (!order) return;
    this.setData({
      contactEditing: true,
      contactDraft: {
        name: order.contact_name || '',
        gender: order.contact_gender || '',
        cell: order.contact_num || '',
      },
    });
  },
  onContactCancel() {
    this.setData({ contactEditing: false });
  },
  onContactInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['contactDraft.' + field]: (e.detail.value || '').trim() });
  },
  onContactGenderTap(e) {
    this.setData({ 'contactDraft.gender': e.currentTarget.dataset.gender });
  },
  onContactSave() {
    const that = this;
    if (this.data.savingContact) return;
    const d = this.data.contactDraft;
    this.setData({ savingContact: true });
    // 以最新订单为基底只改这三个字段：UpdateOrder 会把整行标量写回，
    // 用页面上的旧快照可能把这期间顾客刚付完的状态（dealed/paying_amount）冲掉
    // UpdateOrderByStaff 只写订单这一行（Entry(order).State=Modified），不附加子对象，载荷原样即可
    data.getOrderByStaffPromise(this.data.id, app.globalData.sessionKey).then((latest) => {
      const payload = { ...latest };
      payload.contact_name = d.name || null;
      payload.contact_gender = d.gender || null;
      payload.contact_num = d.cell || null;
      return data.updateOrderPromise(payload, '零售详情页修改顾客信息', app.globalData.sessionKey);
    }).then(() => {
      that.setData({ savingContact: false, contactEditing: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      that.loadOrder();
    }).catch(() => {
      that.setData({ savingContact: false });
    });
  },

  /* ---------- 零售内容编辑 ---------- */
  onRetailEditTap() {
    const retail = this.data.retail;
    if (!retail) return;
    const draft = {
      mi7Code: retail.mi7_code || '',
      mi7Status: retail.mi7_code ? (retailRules.isValidMi7Code(retail.mi7_code) ? 'ok' : 'invalid') : 'empty',
      retailType: retail.retail_type || '零售',
      dealPrice: retail.deal_price,
      amountInput: '',
      memo: retail.memo || '',
      images: (this.data.view.photos || []).map((p) => ({ ...p, status: 'success' })),
    };
    this.setData({
      retailEditing: true,
      retailDraft: draft,
      typeOptions: retailRules.retailTypeOptions(draft.retailType),
    });
    this._refreshMi7Hint();
  },
  onRetailCancel() {
    this._mi7Seq = (this._mi7Seq || 0) + 1;
    this.setData({ retailEditing: false, retailDraft: null });
  },
  _refreshMi7Hint() {
    const d = this.data.retailDraft;
    let hint = '';
    if (d) {
      if (d.mi7Status === 'empty') hint = '留空表示紧急开单，之后再补';
      else if (d.mi7Status === 'invalid') hint = '格式不对：XSD 开头，14 位，或 15 位以 I/A 结尾';
      else if (d.mi7Status === 'checking') hint = '正在查重…';
      else if (d.mi7Status === 'dup') hint = '这个七色米单号已经开过单了';
    }
    this.setData({ mi7Hint: hint });
  },
  onDraftMi7Input(e) {
    const code = retailRules.normalizeMi7Code(e.detail.value);
    this._mi7Seq = (this._mi7Seq || 0) + 1;
    let status = 'empty';
    if (code) status = retailRules.isValidMi7Code(code) ? 'unchecked' : 'invalid';
    this.setData({ 'retailDraft.mi7Code': code, 'retailDraft.mi7Status': status });
    this._refreshMi7Hint();
    return code;
  },
  onDraftMi7Blur() {
    this._checkDraftMi7();
  },
  // 查重时排除本单自己的那一行（同后端 CheckMi7Code(mi7Code, retailId)）；查询失败放行，保存时服务端再查
  _checkDraftMi7() {
    const that = this;
    const d = this.data.retailDraft;
    if (!d || d.mi7Status !== 'unchecked') return;
    const selfId = (this.data.retail && this.data.retail.id) || 0;
    this._mi7Seq = (this._mi7Seq || 0) + 1;
    const seq = this._mi7Seq;
    this.setData({ 'retailDraft.mi7Status': 'checking' });
    this._refreshMi7Hint();
    data.getRetailOrderByMi7CodePromise(d.mi7Code, app.globalData.sessionKey).then((retails) => {
      if (seq !== that._mi7Seq) return;
      const others = (retails || []).filter((r) => r.id !== selfId && r.valid == 1);
      that.setData({ 'retailDraft.mi7Status': others.length > 0 ? 'dup' : 'ok' });
      that._refreshMi7Hint();
    }).catch(() => {
      if (seq !== that._mi7Seq) return;
      that.setData({ 'retailDraft.mi7Status': 'unchecked' });
      that._refreshMi7Hint();
    });
  },
  onDraftTypeTap(e) {
    const value = e.currentTarget.dataset.value;
    if (retailRules.isDisabledRetailType(value)) {
      wx.showToast({ title: retailRules.DISABLED_TYPE_TIP, icon: 'none' });
      return;
    }
    this.setData({ 'retailDraft.retailType': value, typeOptions: retailRules.retailTypeOptions(value) });
  },
  onDraftAmountInput(e) {
    this.setData({ 'retailDraft.amountInput': e.detail.value || '' });
  },
  onDraftMemoInput(e) {
    this.data.retailDraft.memo = e.detail.value || '';
  },
  onDraftPhotoRead(e) {
    const that = this;
    const uploadFile = e.detail.file;
    const key = 'u' + Date.now();
    const pending = {
      _key: key, id: 0, image_id: 0, status: 'uploading', message: '上传中',
      url: uploadFile.tempFilePath, thumb: uploadFile.thumb || uploadFile.tempFilePath,
    };
    this.setData({ 'retailDraft.images': (this.data.retailDraft.images || []).concat([pending]) });
    data.uploadFilePromise(null, uploadFile.tempFilePath, '零售开单', uploadFile.type, app.globalData.sessionKey)
      .then((uploaded) => data.uploadFilePromise(uploaded.id, uploadFile.thumb || uploadFile.tempFilePath, null, null, app.globalData.sessionKey))
      .then((withThumb) => {
        if (!that.data.retailDraft) return;
        const imgs = (that.data.retailDraft.images || []).map((im) => (im._key !== key ? im : {
          _key: key, id: 0, image_id: withThumb.id, status: 'success',
          url: fullUrl(withThumb.file_path_name),
          thumb: fullUrl(withThumb.thumbUrl || withThumb.file_path_name),
        }));
        that.setData({ 'retailDraft.images': imgs });
      })
      .catch(() => {
        wx.showToast({ title: '照片上传失败', icon: 'none' });
        if (!that.data.retailDraft) return;
        that.setData({ 'retailDraft.images': (that.data.retailDraft.images || []).filter((im) => im._key !== key) });
      });
  },
  onDraftPhotoDelete(e) {
    const index = e.detail.index;
    this.setData({ 'retailDraft.images': (this.data.retailDraft.images || []).filter((im, i) => i !== index) });
  },
  onRetailSave() {
    const that = this;
    if (this.data.savingRetail) return;
    const d = this.data.retailDraft;
    if (!d) return;
    if (d.mi7Status === 'invalid') { wx.showToast({ title: '七色米单号格式不对', icon: 'none' }); return; }
    if (d.mi7Status === 'dup') { wx.showToast({ title: '七色米单号重复', icon: 'none' }); return; }
    if (d.mi7Status === 'checking') { wx.showToast({ title: '正在查重，请稍候', icon: 'none' }); return; }
    if ((d.images || []).some((im) => im.status === 'uploading')) { wx.showToast({ title: '照片还在上传', icon: 'none' }); return; }
    let newAmount = null;
    const amountRaw = String(d.amountInput || '').trim();
    if (this.data.view.canEditAmount && amountRaw !== '') {
      const v = parseFloat(amountRaw);
      if (isNaN(v) || v < 0) { wx.showToast({ title: '请输入有效金额', icon: 'none' }); return; }
      newAmount = Math.round(v * 100) / 100;
    }
    this.setData({ savingRetail: true });
    // 同顾客信息：以最新订单为基底，只改本次编辑的字段
    data.getOrderByStaffPromise(this.data.id, app.globalData.sessionKey).then((latest) => {
      const retail = (latest.retails || [])[0];
      if (!retail) throw new Error('零售明细不存在');
      const stillUnpaid = latest.valid == 1 && latest.dealed != 1 && (latest.paidAmount || 0) === 0;
      if (newAmount !== null && !stillUnpaid) {
        const err = new Error('订单已收款，金额不能再改');
        err._toastMsg = err.message;
        throw err;
      }
      const payload = stripForDetailUpdate(latest);
      const r = payload.retails[0];
      r.mi7_code = d.mi7Code ? d.mi7Code : null;
      r.retail_type = d.retailType;
      r.memo = d.memo || '';
      if (newAmount !== null) {
        r.deal_price = newAmount;
        payload.total_amount = newAmount;
        payload.paying_amount = newAmount;
      }
      payload.retailImages = (d.images || [])
        .filter((im) => im.status === 'success' && im.image_id)
        .map((im) => ({ id: im.id || 0, order_id: latest.id, image_id: im.image_id, valid: true }));
      return data.updateOrderWithDetailPromise(payload, '零售详情页修改', app.globalData.sessionKey);
    }).then(() => {
      that.setData({ savingRetail: false, retailEditing: false, retailDraft: null });
      wx.showToast({ title: '已保存', icon: 'success' });
      that.loadOrder();
    }).catch((err) => {
      that.setData({ savingRetail: false });
      if (err && err._toastMsg) wx.showToast({ title: err._toastMsg, icon: 'none' });
      // 其余失败 performWebRequest 已 toast 后端 message（如「七色米重复」）
    });
  },
});
