// pages/admin/care/care_order_detail/care_order_detail.js
// 新版养护订单详情页（Alpine Operational Minimalist，对标 rent_order_detail）
// 功能：订单信息 + 支付摘要 + 每件装备卡（装备信息 / 服务 / 照片 / 任务时间线）
//       任务操作（开始/结束/强行中止）、安全检查录入确认、寄存或快递、
//       发板核销（发送取板码 + 验证码 + 店长确认）、打印标签/小票（复用旧 print-care 组件）
// 业务逻辑对齐旧版 pages/admin/care/order_detail（扫码取板/拍照凭证两种核销方式仍在旧页，后续迁移）
const app = getApp();
const util = require('../../../../utils/util.js');
const data = require('../../../../utils/data.js');

// 2026-07-08 暂时与 data.js uploadFilePromise 的上传域名保持一致（新流程照片落在 mini 那台磁盘）
const IMG_HOST = 'https://mini.snowmeet.top';

function fullUrl(p) {
  if (!p) return '';
  return p.indexOf('http') === 0 ? p : IMG_HOST + p;
}

Page({
  data: {
    orderId: 0,
    order: null,
    cares: [],
    payment: { totalStr: '', paidStr: '', refundStr: '', payingStr: '', rows: [], expanded: false },
    veriCode: '',
    printShow: false,
    printType: 'label',
    careToBePrinted: null,
    isMaster: false,
  },

  async onLoad(options) {
    await app.loginPromiseNew;
    const orderId = parseInt(options.id || options.orderId, 10) || 0;
    const staff = app.globalData.staff || {};
    this.setData({ orderId, isMaster: (staff.title_level || 0) >= 200 });
    this.loadOrder();
  },

  loadOrder() {
    const that = this;
    if (!this.data.orderId) return;
    data.getOrderByStaffPromise(this.data.orderId, app.globalData.sessionKey).then((order) => {
      that.renderOrder(order);
    }).catch((e) => {
      console.warn('load care order failed', e);
    });
  },

  renderOrder(order) {
    const bizDate = order.biz_date ? new Date(order.biz_date) : null;
    order.bizDateStr = bizDate ? util.formatDate(bizDate) : '';
    const cares = (order.cares || []).map((care) => this._renderCare(care));
    const rows = (order.payments || []).map((p) => ({
      id: p.id,
      method: p.pay_method || (p.is_debt === 1 ? '挂账' : '未知'),
      amountStr: util.showAmount(p.amount || 0),
      status: p.status || '',
      dateStr: p.paid_date ? util.formatDate(new Date(p.paid_date)) : '',
    }));
    this.setData({
      order,
      cares,
      payment: {
        ...this.data.payment,
        totalStr: util.showAmount(order.totalCharge || 0),
        paidStr: util.showAmount(order.paidAmount || 0),
        refundStr: util.showAmount(order.refundAmount || 0),
        payingStr: util.showAmount(order.paying_amount || 0),
        rows,
      },
    });
  },

  _renderCare(raw) {
    const care = { ...raw };
    const brandDisp = care.brand ? String(care.brand).split('/')[0] : '';
    const titleParts = [care.equipment || '装备'];
    if (brandDisp) titleParts.push(brandDisp);
    if (care.scale) titleParts.push(care.scale + 'cm');
    care._title = titleParts.join(' · ');
    // 服务 chips
    const chips = [];
    if (care.biz_type === '非雪季养护') chips.push('非雪季');
    if (care.need_edge === 1) chips.push('修刃' + (care.edge_degree ? care.edge_degree + '°' : ''));
    if (care.need_wax === 1) chips.push('热蜡');
    if (care.free_wax === 1) chips.push('机打蜡');
    if (care.need_unwax === 1) chips.push('刮蜡');
    if (care.urgent === 1) chips.push('立等');
    if (care.repair_memo) chips.push('维修:' + care.repair_memo);
    if (care.entertain) chips.push('招待');
    if (care.warranty) chips.push('质保');
    care._chips = chips;
    // 金额
    care._commonStr = util.showAmount(care.common_charge || 0);
    care._repairStr = util.showAmount(care.repair_charge || 0);
    care._discountStr = util.showAmount((care.discount || 0) + (care.ticket_discount || 0));
    let summary = (care.common_charge || 0) + (care.repair_charge || 0)
      - (care.discount || 0) - (care.ticket_discount || 0);
    if (care.warranty || care.entertain) summary = 0;
    care._summaryStr = util.showAmount(Math.round(summary * 100) / 100);
    // 照片展示地址
    care._photos = (care.careImages || []).map((im) => {
      const img = im.image || {};
      return {
        id: im.id,
        thumb: fullUrl(img.thumbUrl || img.file_path_name),
        url: fullUrl(img.file_path_name),
      };
    });
    // 序列号左右拆分展示
    care._serialText = care.serials || '';
    // 任务时间线：第一个未完成（且非中止）的任务为 current，可操作
    let currentFound = false;
    care._tasks = (care.tasks || []).map((t) => {
      const task = { ...t };
      task._startStr = t.start_time ? util.formatDate(new Date(t.start_time)) + ' ' + this._timeStr(t.start_time) : '';
      task._endStr = t.end_time ? util.formatDate(new Date(t.end_time)) + ' ' + this._timeStr(t.end_time) : '';
      task._staffName = (t.staff && t.staff.name) || '';
      const done = t.status === '已完成' || t.status === '强行中止';
      task._current = !done && !currentFound;
      if (task._current) currentFound = true;
      switch (t.task_name) {
        case '修刃': task._title = '修刃 角度：' + (care.edge_degree || '89'); break;
        case '维修': task._title = '维修 ' + (care.repair_memo || ''); break;
        default: task._title = t.task_name;
      }
      return task;
    });
    // 安检可录入：品牌长度已填 + 首任务未完成
    const t0 = care._tasks[0];
    care._safeChecking = !!(t0 && t0.task_name === '安全检查' && t0.status !== '已完成');
    care._status = care.status || (care._tasks.length === 0 ? '未开始' : '进行中');
    care._expanded = care._status !== '已完成';
    return care;
  },

  _timeStr(d) {
    const dt = new Date(d);
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  },

  _careIdx(e) { return Number(e.currentTarget.dataset.cidx); },

  onToggleCare(e) {
    const cidx = this._careIdx(e);
    this.setData({ ['cares[' + cidx + ']._expanded']: !this.data.cares[cidx]._expanded });
  },

  onTogglePayment() {
    this.setData({ 'payment.expanded': !this.data.payment.expanded });
  },

  onCall() {
    const num = this.data.order && this.data.order.contact_num;
    if (num) wx.makePhoneCall({ phoneNumber: num });
  },

  onPhotoTap(e) {
    const cidx = this._careIdx(e);
    const idx = Number(e.currentTarget.dataset.idx);
    const urls = this.data.cares[cidx]._photos.map((p) => p.url);
    wx.previewImage({ urls, current: urls[idx] });
  },

  /* ---------- 安全检查 ---------- */
  onSafeFieldBlur(e) {
    const cidx = this._careIdx(e);
    const field = e.currentTarget.dataset.field; // height/weight/gap/front_din/rear_din/left_angle/right_angle
    this.setData({ ['cares[' + cidx + '].' + field]: e.detail.value });
  },

  onSafeCheck(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    if (!care._photos || care._photos.length === 0) {
      wx.showToast({ title: '必须传照片', icon: 'error' });
      return;
    }
    if (!care.height) {
      wx.showToast({ title: '身高必填', icon: 'error' });
      return;
    }
    if (care.equipment === '双板' && (!care.front_din || !care.rear_din)) {
      wx.showToast({ title: '脱落值必填', icon: 'error' });
      return;
    }
    wx.showModal({
      title: '安全检查确认',
      content: '确认所填参数皆为真实准确的数值，您将成为顾客本次养护的安全负责人。',
      success(res) {
        if (!res.confirm) return;
        // 先落安检数据，再置任务完成（对齐旧页流程）
        const payload = { ...care };
        // 去掉派生字段，避免后端 diff 日志噪音
        Object.keys(payload).forEach((k) => { if (k.indexOf('_') === 0) delete payload[k]; });
        payload.tasks = care.tasks;
        data.updateCarePromise(payload, '安全检查', app.globalData.sessionKey).then(() => {
          return data.updateCareTaskStatusPromise(care.tasks[0].id, '已完成', '养护详情页安全检查',
            app.globalData.sessionKey, null, null);
        }).then(() => {
          wx.showToast({ title: '安全确认完成', icon: 'success' });
          that.loadOrder();
        }).catch(() => {});
      },
    });
  },

  /* ---------- 任务开始 / 结束 ---------- */
  onTaskStart(e) {
    const that = this;
    const taskId = Number(e.currentTarget.dataset.taskId);
    wx.showModal({
      title: '确认开始？',
      content: '',
      success(res) {
        if (!res.confirm) return;
        data.updateCareTaskStatusPromise(taskId, '已开始', '养护详情页', app.globalData.sessionKey, null, null)
          .then(() => { that.loadOrder(); }).catch(() => {});
      },
    });
  },

  onTaskEnd(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const taskId = Number(e.currentTarget.dataset.taskId);
    const care = this.data.cares[cidx];
    const task = (care._tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const myStaffId = (app.globalData.staff || {}).id;
    // 他人执行中的任务只能强行中止（对齐旧页）
    const interrupt = task.staff_id && task.staff_id !== myStaffId;
    const status = interrupt ? '强行中止' : '已完成';
    const minutes = task.start_time
      ? ((Date.now() - new Date(task.start_time).valueOf()) / 60000).toFixed(2) : '0';
    wx.showModal({
      title: interrupt ? '确认强行中止任务' : '确认任务结束',
      content: interrupt
        ? ('本任务是 ' + (task._staffName || '他人') + ' 在执行，确认强行中止吗？')
        : ('本任务共耗时 ' + minutes + ' 分钟'),
      success(res) {
        if (!res.confirm) return;
        data.updateCareTaskStatusPromise(taskId, status, '养护详情页', app.globalData.sessionKey, null, null)
          .then(() => { that.loadOrder(); }).catch(() => {});
      },
    });
  },

  /* ---------- 寄存或快递（非雪季） ---------- */
  onDealMethodTap(e) {
    const cidx = this._careIdx(e);
    const tidx = Number(e.currentTarget.dataset.tidx);
    const method = e.currentTarget.dataset.method;
    this.setData({ ['cares[' + cidx + ']._tasks[' + tidx + '].deal_method']: method });
  },

  onStoreMemoBlur(e) {
    const cidx = this._careIdx(e);
    const tidx = Number(e.currentTarget.dataset.tidx);
    this.setData({ ['cares[' + cidx + ']._tasks[' + tidx + '].store_memo']: e.detail.value });
  },

  onStoreConfirm(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const tidx = Number(e.currentTarget.dataset.tidx);
    const task = this.data.cares[cidx]._tasks[tidx];
    if (!task.deal_method) {
      wx.showToast({ title: '必须选择寄存方式', icon: 'error' });
      return;
    }
    if (task.deal_method === '快递' && !task.store_memo) {
      wx.showToast({ title: '必须填写快递单号', icon: 'error' });
      return;
    }
    wx.showModal({
      title: '确认',
      content: '寄存方式为：' + task.deal_method + (task.deal_method === '快递' ? '，快递单号：' + task.store_memo : ''),
      success(res) {
        if (!res.confirm) return;
        data.updateCareTaskStatusPromise(task.id, '已完成', '非雪季养护',
          app.globalData.sessionKey, task.deal_method, task.store_memo)
          .then(() => { that.loadOrder(); }).catch(() => {});
      },
    });
  },

  /* ---------- 发板核销 ---------- */
  onSendVeriCode(e) {
    const care = this.data.cares[this._careIdx(e)];
    const url = app.globalData.requestPrefix + 'Care/CreateVerifyCode/' + care.id
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, null).then(() => {
      wx.showToast({ title: '发送成功', icon: 'success' });
    }).catch(() => {});
  },

  onVeriCodeInput(e) {
    this.setData({ veriCode: e.detail.value });
  },

  onVeriCodeConfirm(e) {
    const that = this;
    const care = this.data.cares[this._careIdx(e)];
    const code = (this.data.veriCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入取板码', icon: 'none' });
      return;
    }
    const url = app.globalData.requestPrefix + 'Care/VeriCareFinishCode/' + care.id
      + '?code=' + encodeURIComponent(code)
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    this.setData({ veriCode: '' });
    util.performWebRequest(url, null).then(() => {
      wx.showToast({ title: '验证通过', icon: 'success' });
      that.loadOrder();
    }).catch(() => {});
  },

  onMasterFinish(e) {
    const that = this;
    const care = this.data.cares[this._careIdx(e)];
    const finishTask = (care._tasks || []).filter((t) => t.task_name === '发板')[0];
    if (!finishTask) return;
    wx.showModal({
      title: '确认发板',
      content: '请核实取板人和会员本人的关系。',
      success(res) {
        if (!res.confirm) return;
        data.updateCareTaskStatusPromise(finishTask.id, '已完成', '店长确认',
          app.globalData.sessionKey, null, null)
          .then(() => {
            wx.showToast({ title: '发板完成', icon: 'success' });
            that.loadOrder();
          }).catch(() => {});
      },
    });
  },

  /* ---------- 打印 ---------- */
  onPrintLabel(e) {
    const care = this.data.cares[this._careIdx(e)];
    this.setData({ printShow: true, printType: 'label', careToBePrinted: care });
  },

  onPrintInvoice(e) {
    const care = this.data.cares[this._careIdx(e)];
    this.setData({ printShow: true, printType: 'invoice', careToBePrinted: care });
  },

  onPrinterClose() {
    this.setData({ printShow: false });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },
});
