// pages/admin/care/care_order_detail/care_order_detail.js
// 新版养护订单详情页（Alpine Operational Minimalist，对标 rent_order_detail）
// 功能：非雪季醒目横幅 + 订单信息 + 支付摘要 + 每件装备卡（装备信息/编辑 / 服务 / 照片 / 任务时间线）
//       任务操作（开始/结束/强行中止，按实际时间引导：进行中计时 + 结束显示耗时 + 耗时过短二次确认）、
//       安全检查录入确认、寄存或快递、发板核销（扫码取板 / 验证码 / 拍照凭证 / 店长确认）、
//       装备基础信息编辑（品牌/长度/序列号/附件/招待质保/照片增删）、打印标签/小票（复用旧 print-care 组件）
// 业务逻辑对齐旧版 pages/admin/care/order_detail（能力已全量迁入，旧页仅作历史标签二维码兼容入口）
const app = getApp();
const util = require('../../../../utils/util.js');
const data = require('../../../../utils/data.js');

// 与 data.js uploadFilePromise 的上传域名保持一致（照片落在处理上传那台服务器的磁盘）
const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com';

function fullUrl(p) {
  if (!p) return '';
  return p.indexOf('http') === 0 ? p : IMG_HOST + p;
}

// 手机号脱敏：保留前 3 后 4，中间打码；空值返回 '—'（与 rent_order_detail 同款）
function maskCell(cell) {
  if (!cell && cell !== 0) return '—';
  const s = String(cell).trim();
  if (!s) return '—';
  if (/^\d{11}$/.test(s)) return s.substr(0, 3) + '****' + s.substr(7);
  if (s.length > 7) return s.substr(0, 3) + '****' + s.substr(s.length - 4);
  if (s.length > 4) return s.substr(0, s.length - 4) + '****';
  return '****';
}

function taskOrderValue(task) {
  if (!task) return 999999;
  if (task.task_name === '安全检查') return -1000;
  return task.sort === undefined || task.sort === null ? 999999 : Number(task.sort);
}

function sortCareTasks(tasks) {
  return (tasks || []).slice().sort((a, b) => {
    const orderDiff = taskOrderValue(a) - taskOrderValue(b);
    if (orderDiff !== 0) return orderDiff;
    return (a.id || 0) - (b.id || 0);
  });
}

Page({
  data: {
    orderId: 0,
    order: null,
    orderMemoDraft: '',
    orderMemoEditing: false,
    savingOrderMemo: false,
    cares: [],
    payment: { paidStr: '', refundStr: '', payRows: [], refundRows: [], expanded: false },
    refundPopup: {
      show: false,
      amount: '',
      memo: '',
      refunding: false,
    },
    summerBanner: { show: false, desc: '' },
    veriCode: '',
    scanQr: { careId: 0, url: '', status: '' }, // status: loading / ready / broken
    addBrand: { show: false, cidx: -1, name: '', chineseName: '' },
    skiBrandList: [],
    boardBrandList: [],
    printShow: false,
    printType: 'label',
    careToBePrinted: null,
    isMaster: false,
  },

  async onLoad(options) {
    await app.loginPromiseNew;
    // 标签二维码「扫普通链接二维码打开小程序」进入时，原始 URL 在 options.q（URL-encoded）
    let orderId = 0;
    let careId = 0;
    if (options.q) {
      orderId = parseInt(util.parseQuery(options.q, 'orderId'), 10) || 0;
      careId = parseInt(util.parseQuery(options.q, 'careId'), 10) || 0;
    }
    if (!orderId) orderId = parseInt(options.id || options.orderId, 10) || 0;
    if (!careId) careId = parseInt(options.careId, 10) || 0;
    const staff = app.globalData.staff || {};
    // 页面级 UI 状态（loadOrder 全量重渲染时按 care.id 回填，避免打断用户操作）
    // safeCheck：安检数值/备注在"确认安全"提交前只存在于本地，任何无关操作触发的 loadOrder() 都会
    // 用服务端原始数据重建 care（该字段服务端此时仍为空）；此 map 是这些草稿值的唯一持久来源，
    // 见 _renderCare 的合并逻辑。
    this._uiState = { expanded: {}, veriType: {}, safeCheck: {} };
    this._targetCareId = careId;
    this.setData({ orderId, isMaster: (staff.title_level || 0) >= 200 });
    this._loadBrandLists();
    this.loadOrder();
    this._loadedOnce = true;
  },

  onShow() {
    if (!this._loadedOnce) return;
    // 编辑中不自动刷新（相机/相册返回可能触发 onShow，整页重载会丢编辑内容）
    const editing = (this.data.cares || []).some((c) => c._editing);
    if (editing) {
      if ((this._runningPaths || []).length > 0) this._startElapsedTimer();
      return;
    }
    this.loadOrder();
  },

  onHide() {
    this._stopElapsedTimer();
    this._closeScan();
  },

  onUnload() {
    this._stopElapsedTimer();
    this._closeScan();
  },

  _loadBrandLists() {
    const that = this;
    const addNewItem = (type) => ({
      brand_type: type, brand_name: 'Add New', chinese_name: '新增品牌', origin: '', displayedName: '新增品牌',
    });
    data.getEquipBrandsPromise('双板').then((list) => {
      list.push(addNewItem('双板'));
      that.setData({ skiBrandList: list });
    }).catch(() => {});
    data.getEquipBrandsPromise('单板').then((list) => {
      list.push(addNewItem('单板'));
      that.setData({ boardBrandList: list });
    }).catch(() => {});
  },

  loadOrder() {
    const that = this;
    if (!this.data.orderId) return;
    data.getOrderByStaffPromise(this.data.orderId, app.globalData.sessionKey).then((order) => {
      that._rawCares = order.cares || [];
      that.renderOrder(order);
      that._applyTargetCare();
      that._syncScanWithOrder();
    }).catch((e) => {
      console.warn('load care order failed', e);
    });
  },

  renderOrder(order) {
    const bizDate = order.biz_date ? new Date(order.biz_date) : null;
    order.bizDateStr = bizDate ? util.formatDate(bizDate) : '';
    const cares = (order.cares || []).map((care) => this._renderCare(care));
    // 首次进入且没有 deep-link 参数时，默认展开第一件装备。
    if (!this._targetCareId && cares.length > 0) {
      const hasExpandedMemory = Object.keys((this._uiState && this._uiState.expanded) || {}).length > 0;
      if (!hasExpandedMemory) {
        cares[0]._expanded = true;
      }
    }
    // 非雪季订单醒目横幅（任一 care 是非雪季即显示，按 summer 汇总）
    let nowCount = 0;
    let laterCount = 0;
    let summerTotal = 0;
    (order.cares || []).forEach((c) => {
      if (c.biz_type === '非雪季养护') {
        summerTotal += 1;
        if (c.summer === 'now') nowCount += 1;
        else if (c.summer === 'later') laterCount += 1;
      }
    });
    const parts = [];
    if (nowCount > 0) parts.push('立等现修 ' + nowCount + ' 件');
    if (laterCount > 0) parts.push('寄存后修 ' + laterCount + ' 件');
    const otherCount = summerTotal - nowCount - laterCount;
    if (otherCount > 0) parts.push('非雪季养护 ' + otherCount + ' 件');
    const summerBanner = {
      show: summerTotal > 0,
      desc: parts.length > 0 ? parts.join(' · ') : '本单含非雪季养护装备',
    };
    // 支付明细（与租赁详情页同款）：成功支付 + 退款两组行，代付标红 + 脱敏手机号
    const payRows = (order.availablePayments || []).map((p) => {
      // paid_date 为空时回退 create_date（历史储值支付未写 paid_date，否则显示 1970-01-01）
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
    // 退款记录无 paid_date，用 create_date 作日期/时间；方式取原支付方式
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
      // 编辑中保留草稿，防 onShow 等后台刷新把正在输入的内容冲掉
      orderMemoDraft: this.data.orderMemoEditing ? this.data.orderMemoDraft : (order.memo || ''),
      cares,
      summerBanner,
      payment: {
        ...this.data.payment,
        paidStr: util.showAmount(order.paidAmount || 0),
        refundStr: util.showAmount(order.refundAmount || 0),
        payRows,
        refundRows,
      },
    });
    this._collectRunning(cares);
    // 会员 + 安检未完成 + 本装备身高尚未录入 → 拉该会员该装备类型的最近一次安检数据默认预填
    if (order.member_id) {
      cares.forEach((c) => {
        if (c._safeChecking && !c.height) {
          this._fetchSafeCheckHistory(c.id, c.equipment, order.member_id);
        }
      });
    }
  },

  // 每张 care 只拉一次（页面级记忆，避免 loadOrder 重复轮询时反复请求/反复覆盖用户已录入的值）
  _fetchSafeCheckHistory(careId, equipment, memberId) {
    const that = this;
    this._safeHistoryFetched = this._safeHistoryFetched || {};
    if (this._safeHistoryFetched[careId]) return;
    this._safeHistoryFetched[careId] = true;
    data.getMemberLatestSafeCheckPromise(memberId, equipment, app.globalData.sessionKey).then((hist) => {
      if (!hist) return;
      const cares = that.data.cares;
      const cidx = cares.findIndex((c) => c.id === careId);
      if (cidx < 0) return;
      const care = cares[cidx];
      const ui = that._uiState || (that._uiState = { expanded: {}, veriType: {}, safeCheck: {} });
      const draft = ui.safeCheck[careId] || (ui.safeCheck[careId] = {});
      // 只填当前仍为空的字段，不覆盖已录入/服务端已存的值；同步写页面级草稿，跨无关操作重载不丢
      const fields = ['height', 'weight', 'gap', 'front_din', 'rear_din', 'left_angle', 'right_angle'];
      const patch = {};
      fields.forEach((f) => {
        if (!care[f] && hist[f]) {
          patch['cares[' + cidx + '].' + f] = hist[f];
          draft[f] = hist[f];
        }
      });
      if (Object.keys(patch).length > 0) {
        that.setData(patch);
        const dateStr = hist.last_care_date ? util.formatDate(new Date(hist.last_care_date)) : '';
        wx.showToast({ title: '已带入' + dateStr + '的历史安检数据', icon: 'none' });
      }
    }).catch(() => {});
  },

  _renderCare(raw) {
    const care = { ...raw };
    const ui = this._uiState || { expanded: {}, veriType: {}, safeCheck: {} };
    ui.safeCheck = ui.safeCheck || {};
    const brandDisp = care.brand ? String(care.brand).split('/')[0] : '';
    const titleParts = [care.equipment || '装备'];
    if (brandDisp) titleParts.push(brandDisp);
    if (care.scale) titleParts.push(care.scale + 'cm');
    care._title = titleParts.join(' · ');
    // 服务 chips（对象数组：非雪季用醒目琥珀 chip，其余 outline）
    const chips = [];
    if (care.biz_type === '非雪季养护') {
      const t = care.summer === 'now' ? '非雪季·立等现修' : (care.summer === 'later' ? '非雪季·寄存后修' : '非雪季');
      chips.push({ text: t, cls: 'chip-summer' });
    }
    if (care.need_edge === 1) chips.push({ text: '修刃' + (care.edge_degree ? care.edge_degree + '°' : ''), cls: 'chip-outline' });
    if (care.need_wax === 1) chips.push({ text: '热蜡', cls: 'chip-outline' });
    if (care.free_wax === 1) chips.push({ text: '机打蜡', cls: 'chip-outline' });
    if (care.need_unwax === 1) chips.push({ text: '刮蜡', cls: 'chip-outline' });
    if (care.urgent === 1) chips.push({ text: '立等', cls: 'chip-outline' });
    if (care.repair_memo) chips.push({ text: '维修:' + care.repair_memo, cls: 'chip-outline' });
    if (care.entertain) chips.push({ text: '招待', cls: 'chip-outline' });
    if (care.warranty) chips.push({ text: '质保', cls: 'chip-outline' });
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
    // 取板凭证（拍照核销后展示）
    if (care.pickImage) {
      care._pickThumb = fullUrl(care.pickImage.thumbUrl || care.pickImage.file_path_name);
      care._pickUrl = fullUrl(care.pickImage.file_path_name);
    }
    // 序列号展示
    care._serialText = care.serials || '';
    // 任务时间线：第一个未完成（且非中止）的任务为 current；已开始的任务始终可操作
    const myStaffId = (app.globalData.staff || {}).id;
    const now = Date.now();
    let currentFound = false;
    const orderedTasks = sortCareTasks(care.tasks);
    care.tasks = orderedTasks;
    care._tasks = orderedTasks.map((t) => {
      const task = { ...t };
      task._startStr = t.start_time ? util.formatDate(new Date(t.start_time)) + ' ' + this._timeStr(t.start_time) : '';
      task._endStr = t.end_time ? util.formatDate(new Date(t.end_time)) + ' ' + this._timeStr(t.end_time) : '';
      task._staffName = (t.staff && t.staff.name) || '';
      const done = t.status === '已完成' || t.status === '强行中止';
      task._done = done;
      task._running = t.status === '已开始';
      task._isMine = !!(t.staff_id && myStaffId && t.staff_id === myStaffId);
      task._current = (!done && !currentFound) || task._running;
      if (!done && !currentFound) currentFound = true;
      if (task._running && t.start_time) {
        task._elapsedStr = this._fmtDuration(now - new Date(t.start_time).valueOf());
      }
      if (done && t.start_time && t.end_time) {
        if (t.task_name !== '安全检查') {
          task._durationStr = this._fmtDuration(new Date(t.end_time).valueOf() - new Date(t.start_time).valueOf());
        }
      }
      // 引导文案：让店员按实际操作时间点按钮
      if (task._current && !done) {
        if (t.task_name === '安全检查' && t.status === '未开始') {
          task._hint = '填写单双板检查项后，点击“确认安全”即可';
        } else if (t.status === '未开始') {
          task._hint = '请在实际开始操作时点击，系统将记录真实开始时间';
        } else if (task._running) {
          task._hint = task._isMine
            ? '完成后请及时点击结束，系统将记录真实结束时间'
            : ((task._staffName || '他人') + ' 执行中');
        }
      }
      switch (t.task_name) {
        case '修刃': task._title = '修刃 角度：' + (care.edge_degree || '89'); break;
        case '维修': task._title = '维修 ' + (care.repair_memo || ''); break;
        default: task._title = t.task_name;
      }
      return task;
    });
    // 安检是养护单的第一道任务，按 care_task 记录查找，不依赖数组原始顺序。
    const safeTask = care._tasks.find((t) => t.task_name === '安全检查');
    care._safeChecking = !!(safeTask && safeTask.status !== '已完成' && safeTask.status !== '强行中止');
    if (care._safeChecking) {
      // 安检未确认期间：数值/备注只存在本地，任何无关操作触发的 loadOrder() 都会用服务端原始数据
      // （此时仍为空）重建 care。合并规则——服务端已落库的值优先（一旦落库即代表已确认，用它覆盖草稿
      // 并同步回草稿）；否则用草稿（用户已填/已改、或历史预填的值），跨重载保留；都没有则留空。
      const draft = ui.safeCheck[care.id] || (ui.safeCheck[care.id] = {});
      ['height', 'weight', 'gap', 'front_din', 'rear_din', 'left_angle', 'right_angle'].forEach((f) => {
        if (care[f]) {
          draft[f] = care[f];
        } else if (draft[f]) {
          care[f] = draft[f];
        }
      });
      const memoDraft = (safeTask && safeTask.memo) || draft.memo || '';
      draft.memo = memoDraft;
      care._safeMemoDraft = memoDraft;
    } else {
      delete ui.safeCheck[care.id]; // 已核验完成/终止，草稿不再需要
      care._safeMemoDraft = (safeTask && safeTask.memo) || '';
    }
    care._status = care.status || (care._tasks.length === 0 ? '未开始' : '进行中');
    // 展开态 / 发板核销方式：按 care.id 回填页面级记忆
    care._expanded = ui.expanded[care.id] !== undefined ? ui.expanded[care.id] : (care._status !== '已完成');
    const finishTask = care._tasks.find((t) => t.task_name === '发板');
    if (!finishTask || finishTask.status !== '未开始') delete ui.veriType[care.id];
    care._veriType = ui.veriType[care.id] || '';
    care._editing = false;
    return care;
  },

  _timeStr(d) {
    const dt = new Date(d);
    return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  },

  _careIdx(e) { return Number(e.currentTarget.dataset.cidx); },

  /* ---------- 进行中任务计时（30s 一跳，不做高频 setData） ---------- */
  _fmtDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + ' 秒';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + ' 分钟';
    return Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分';
  },

  _collectRunning(cares) {
    const paths = [];
    cares.forEach((c, ci) => {
      (c._tasks || []).forEach((t, ti) => {
        if (t._running && t.start_time) {
          paths.push({ ci, ti, start: new Date(t.start_time).valueOf() });
        }
      });
    });
    this._runningPaths = paths;
    if (paths.length > 0) this._startElapsedTimer();
    else this._stopElapsedTimer();
  },

  _startElapsedTimer() {
    this._stopElapsedTimer();
    const that = this;
    this._elapsedTimer = setInterval(() => { that._tickElapsed(); }, 30000);
  },

  _stopElapsedTimer() {
    if (this._elapsedTimer) {
      clearInterval(this._elapsedTimer);
      this._elapsedTimer = null;
    }
  },

  _tickElapsed() {
    const paths = this._runningPaths || [];
    if (paths.length === 0) { this._stopElapsedTimer(); return; }
    const nowTs = Date.now();
    const patch = {};
    paths.forEach((p) => {
      patch['cares[' + p.ci + ']._tasks[' + p.ti + ']._elapsedStr'] = this._fmtDuration(nowTs - p.start);
    });
    this.setData(patch);
  },

  /* ---------- careId 深链定位（标签二维码 / 列表带入） ---------- */
  _applyTargetCare() {
    if (!this._targetCareId || this._targetApplied) return;
    const cid = this._targetCareId;
    const cares = this.data.cares || [];
    const idx = cares.findIndex((c) => c.id === cid);
    if (idx < 0) return;
    this._targetApplied = true;
    const patch = {};
    cares.forEach((c, i) => {
      this._uiState.expanded[c.id] = (c.id === cid);
      patch['cares[' + i + ']._expanded'] = (c.id === cid);
    });
    this.setData(patch);
    setTimeout(() => {
      wx.pageScrollTo({ selector: '#care-' + cid, offsetTop: -20, duration: 300 });
    }, 300);
  },

  onToggleCare(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const next = !care._expanded;
    this._uiState.expanded[care.id] = next;
    if (!next && this._scan && this._scan.careId === care.id) this._closeScan();
    this.setData({ ['cares[' + cidx + ']._expanded']: next });
  },

  onTogglePayment() {
    this.setData({ 'payment.expanded': !this.data.payment.expanded });
  },

  onOrderMemoEditTap() {
    const order = this.data.order;
    this.setData({ orderMemoEditing: true, orderMemoDraft: (order && order.memo) || '' });
  },

  onOrderMemoCancel() {
    const order = this.data.order;
    this.setData({ orderMemoEditing: false, orderMemoDraft: (order && order.memo) || '' });
  },

  onOrderMemoInput(e) {
    this.setData({ orderMemoDraft: e.detail.value || '' });
  },

  onSaveOrderMemo() {
    const that = this;
    const order = this.data.order;
    if (!order || this.data.savingOrderMemo) return;
    const nextMemo = (this.data.orderMemoDraft || '').trim();
    const currentMemo = (order.memo || '').trim();
    if (nextMemo === currentMemo) {
      this.setData({ orderMemoEditing: false });
      return;
    }
    const payload = { ...order, memo: nextMemo };
    this.setData({ savingOrderMemo: true });
    data.updateOrderPromise(payload, '养护订单详情页修改备注', app.globalData.sessionKey)
      .then((updated) => {
        that.setData({ savingOrderMemo: false, orderMemoEditing: false });
        that._rawCares = updated.cares || [];
        that.renderOrder(updated);
        wx.showToast({ title: '备注已保存', icon: 'success' });
      })
      .catch(() => {
        that.setData({ savingOrderMemo: false });
      });
  },

  onOpenRefundPopup() {
    this.setData({
      refundPopup: {
        show: true,
        amount: '',
        memo: '',
        refunding: false,
      },
    });
  },

  onCloseRefundPopup() {
    if (this.data.refundPopup.refunding) return;
    this.setData({
      'refundPopup.show': false,
      'refundPopup.amount': '',
      'refundPopup.memo': '',
    });
  },

  onRefundAmountInput(e) {
    this.setData({ 'refundPopup.amount': e.detail.value || '' });
  },

  onRefundMemoInput(e) {
    this.setData({ 'refundPopup.memo': e.detail.value || '' });
  },

  _buildRefundPayload(order, refundAmount, memo) {
    const payments = (order.availablePayments || []).filter((p) => p.status === '支付成功');
    const refunds = [];
    let remain = Math.round(refundAmount * 100) / 100;
    for (let i = 0; i < payments.length && remain > 0; i++) {
      const p = payments[i];
      const unRefunded = Math.round((Number(p.unRefundedAmount) || 0) * 100) / 100;
      if (unRefunded <= 0) continue;
      const splitAmount = Math.min(unRefunded, remain);
      if (splitAmount <= 0) continue;
      refunds.push({
        id: 0,
        payment_id: p.id,
        amount: Math.round(splitAmount * 100) / 100,
        reason: memo,
      });
      remain = Math.round((remain - splitAmount) * 100) / 100;
    }
    if (remain > 0) return null;
    return refunds;
  },

  onConfirmRefund() {
    const that = this;
    const order = this.data.order;
    if (!order || this.data.refundPopup.refunding) return;
    const amountText = (this.data.refundPopup.amount || '').trim();
    const memo = (this.data.refundPopup.memo || '').trim();
    const refundAmount = Number(amountText);
    if (!amountText || Number.isNaN(refundAmount) || refundAmount <= 0) {
      wx.showToast({ title: '请填写正确退款金额', icon: 'none' });
      return;
    }
    if (!memo) {
      wx.showToast({ title: '请填写退款备注', icon: 'none' });
      return;
    }
    const remain = Math.round(((order.paidAmount || 0) - (order.refundAmount || 0)) * 100) / 100;
    if (refundAmount > remain) {
      wx.showToast({ title: '超额退款', icon: 'none' });
      return;
    }
    const refunds = this._buildRefundPayload(order, refundAmount, memo);
    if (!refunds || refunds.length === 0) {
      wx.showToast({ title: '无可退款支付记录', icon: 'none' });
      return;
    }
    this.setData({ 'refundPopup.refunding': true });
    data.refundPromise(order.id, refunds, app.globalData.sessionKey)
      .then(() => {
        that.setData({
          'refundPopup.refunding': false,
          'refundPopup.show': false,
          'refundPopup.amount': '',
          'refundPopup.memo': '',
        });
        wx.showToast({ title: '退款成功', icon: 'success' });
        that.loadOrder();
      })
      .catch(() => {
        that.setData({ 'refundPopup.refunding': false });
      });
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

  onPickProofTap(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    if (care && care._pickUrl) wx.previewImage({ urls: [care._pickUrl] });
  },

  // careImages 去导航（防后端 EF 图附加撞键；既有行保留全部标量字段，create_date 等不被冲掉）
  _stripImageNavs(careImages, careId) {
    return (careImages || []).map((im) => {
      const keep = { ...im };
      delete keep.image;
      delete keep.care;
      keep.care_id = careId;
      keep.image_id = keep.image_id || (im.image && im.image.id) || 0;
      return keep;
    });
  },

  /* ---------- 安全检查 ---------- */
  onSafeFieldBlur(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const field = e.currentTarget.dataset.field; // height/weight/gap/front_din/rear_din/left_angle/right_angle
    const value = e.detail.value;
    this.setData({ ['cares[' + cidx + '].' + field]: value });
    // 同步写入页面级草稿：确认安全前的无关操作（如保存装备信息）触发的重载不会冲掉这次编辑
    if (care && this._uiState) {
      const draft = this._uiState.safeCheck[care.id] || (this._uiState.safeCheck[care.id] = {});
      draft[field] = value;
    }
  },

  onSafeMemoBlur(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const value = e.detail.value;
    this.setData({ ['cares[' + cidx + ']._safeMemoDraft']: value });
    if (care && this._uiState) {
      const draft = this._uiState.safeCheck[care.id] || (this._uiState.safeCheck[care.id] = {});
      draft.memo = value;
    }
  },

  onSafeCheck(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    if (!String(care.brand || '').trim()) {
      wx.showToast({ title: '请先补全品牌', icon: 'none' });
      return;
    }
    if (!String(care.scale || '').trim()) {
      wx.showToast({ title: '请先补全长度', icon: 'none' });
      return;
    }
    if (!care._photos || care._photos.length === 0) {
      wx.showToast({ title: '请先补全照片', icon: 'none' });
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
        payload.careImages = that._stripImageNavs(care.careImages, care.id);
        payload.tasks = care.tasks;
        const safeTask = (care.tasks || []).find((t) => t.task_name === '安全检查');
        if (!safeTask) {
          wx.showToast({ title: '缺少安检任务', icon: 'error' });
          return;
        }
        data.updateCarePromise(payload, '安全检查', app.globalData.sessionKey).then(() => {
          // taskMemo 显式带上（哪怕空串），落进 CareTask.memo；scene 仍保留场景字符串供审计日志用
          return data.updateCareTaskStatusPromise(safeTask.id, '已完成', '养护详情页安全检查',
            app.globalData.sessionKey, null, null, care._safeMemoDraft || '');
        }).then(() => {
          wx.showToast({ title: '安全确认完成', icon: 'success' });
          that.loadOrder();
        }).catch(() => {});
      },
    });
  },

  /* ---------- 任务开始 / 结束（按实际时间引导；安全检查除外） ---------- */
  onTaskStart(e) {
    const that = this;
    const taskId = Number(e.currentTarget.dataset.taskId);
    const taskName = e.currentTarget.dataset.taskName || '任务';
    // 安全检查不记录开始耗时：直接填写检查项后点「确认安全」。
    if (taskName === '安全检查') {
      wx.showToast({ title: '请填写后点确认安全', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '开始任务',
      content: '点击确定后将记录「' + taskName + '」的实际开始时间，请确保现在开始操作。',
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
    if (task.staff_id && task.staff_id !== myStaffId) {
      wx.showModal({
        title: '确认强行中止任务',
        content: '本任务是 ' + (task._staffName || '他人') + ' 在执行，确认强行中止吗？',
        success(res) {
          if (res.confirm) that._commitTaskEnd(taskId, '强行中止');
        },
      });
      return;
    }
    const elapsedMs = task.start_time ? (Date.now() - new Date(task.start_time).valueOf()) : 0;
    const durStr = this._fmtDuration(elapsedMs);
    wx.showModal({
      title: '确认任务结束',
      content: '「' + task.task_name + '」实际耗时 ' + durStr + '。',
      success(res) {
        if (!res.confirm) return;
        that._commitTaskEnd(taskId, '已完成');
      },
    });
  },

  _commitTaskEnd(taskId, status) {
    const that = this;
    data.updateCareTaskStatusPromise(taskId, status, '养护详情页', app.globalData.sessionKey, null, null)
      .then(() => { that.loadOrder(); }).catch(() => {});
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

  /* ---------- 发板核销：四方式（扫码取板 / 验证码 / 拍照凭证 / 店长确认） ---------- */
  onVeriTypeTap(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const type = e.currentTarget.dataset.type;
    const care = this.data.cares[cidx];
    if (!care || care._veriType === type) return;
    // 切走扫码态先关闭会话
    if (care._veriType === '扫码取板') this._closeScan();
    this._uiState.veriType[care.id] = type;
    this.setData({ ['cares[' + cidx + ']._veriType']: type });
    if (type === '扫码取板') {
      this._openScan(cidx);
    } else if (type === '验证码') {
      const order = this.data.order || {};
      const m = order.member || {};
      const name = m.title || order.contact_name || '顾客';
      const cell = m.cell || order.contact_num || '';
      wx.showModal({
        title: '即将发送取板码',
        content: '取板码将通过公众号消息发送给【' + name + '】手机号【' + cell + '】',
        success(res) {
          if (res.confirm) that._sendVeriCode(cidx);
        },
      });
    }
  },

  // 取消发板：叠加在四种核验方式之上的模式开关（非互斥 tab）。开启后需先填原因，
  // 核验通过时随对应方式一起提交 isCancel=true + cancelReason，而不是走正常完成。
  onCancelModeToggle(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    if (!care) return;
    const next = !care._cancelMode;
    this.setData({
      ['cares[' + cidx + ']._cancelMode']: next,
      ['cares[' + cidx + ']._cancelReason']: next ? (care._cancelReason || '') : '',
    });
  },

  onCancelReasonBlur(e) {
    const cidx = this._careIdx(e);
    this.setData({ ['cares[' + cidx + ']._cancelReason']: e.detail.value });
  },

  // 非取消模式：{ ok:true, isCancel:false }；取消模式下原因必填，未填返回 { ok:false }（已 toast）
  _resolveCancelParams(care) {
    if (!care._cancelMode) return { ok: true, isCancel: false, reason: undefined };
    const reason = (care._cancelReason || '').trim();
    if (!reason) {
      wx.showToast({ title: '请填写取消原因', icon: 'none' });
      return { ok: false };
    }
    return { ok: true, isCancel: true, reason };
  },

  _sendVeriCode(cidx) {
    const care = this.data.cares[cidx];
    data.createCareVerifyCodePromise(care.id, app.globalData.sessionKey).then(() => {
      wx.showToast({ title: '发送成功', icon: 'success' });
    }).catch(() => {});
  },

  onSendVeriCode(e) {
    // 「重新发送」按钮（进入验证码面板时已确认过一次）
    this._sendVeriCode(this._careIdx(e));
  },

  onVeriCodeInput(e) {
    this.setData({ veriCode: e.detail.value });
  },

  onVeriCodeConfirm(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const code = (this.data.veriCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入取板码', icon: 'none' });
      return;
    }
    const cp = this._resolveCancelParams(care);
    if (!cp.ok) return;
    this.setData({ veriCode: '' });
    data.veriCareFinishCodePromise(care.id, code, app.globalData.sessionKey, cp.isCancel, cp.reason).then(() => {
      wx.showToast({ title: cp.isCancel ? '已取消' : '验证通过', icon: 'success' });
      that.loadOrder();
    }).catch(() => {});
  },

  onMasterFinish(e) {
    const that = this;
    const care = this.data.cares[this._careIdx(e)];
    const finishTask = (care._tasks || []).find((t) => t.task_name === '发板');
    if (!finishTask) return;
    const cp = this._resolveCancelParams(care);
    if (!cp.ok) return;
    wx.showModal({
      title: cp.isCancel ? '确认取消' : '确认发板',
      content: cp.isCancel ? ('确认取消本件养护？原因：' + cp.reason) : '请核实取板人和会员本人的关系。',
      success(res) {
        if (!res.confirm) return;
        data.updateCareTaskStatusPromise(finishTask.id, '已完成', '店长确认',
          app.globalData.sessionKey, null, null, null, cp.isCancel, cp.reason)
          .then(() => {
            wx.showToast({ title: cp.isCancel ? '已取消' : '发板完成', icon: 'success' });
            that.loadOrder();
          }).catch(() => {});
      },
    });
  },

  // 拍照凭证：两段上传原图+缩略图 → 绑定取板凭证 → 完成发板（取消模式同样走这条链，仅末尾状态不同）
  onPickPhotoRead(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const finishTask = (care._tasks || []).find((t) => t.task_name === '发板');
    if (!finishTask) return;
    const cp = this._resolveCancelParams(care);
    if (!cp.ok) return;
    const uploadFile = e.detail.file;
    wx.showLoading({ title: '上传中', mask: true });
    data.uploadFilePromise(null, uploadFile.tempFilePath, '养护取板', uploadFile.type, app.globalData.sessionKey)
      .then((uploaded) => data.uploadFilePromise(uploaded.id, uploadFile.thumb || uploadFile.tempFilePath,
        null, null, app.globalData.sessionKey))
      .then((withThumb) => data.setCarePickImagePromise(care.id, withThumb.id, app.globalData.sessionKey))
      .then(() => data.updateCareTaskStatusPromise(finishTask.id, '已完成', '上传照片取板',
        app.globalData.sessionKey, null, null, null, cp.isCancel, cp.reason))
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: cp.isCancel ? '已取消' : '拍照发板完成', icon: 'success' });
        that.loadOrder();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      });
  },

  /* ---------- 扫码取板（页面级单例 WebSocket 会话） ---------- */
  _openScan(cidx) {
    const that = this;
    const care = this.data.cares[cidx];
    if (!care) return;
    const cp = this._resolveCancelParams(care);
    if (!cp.ok) return;
    this._closeScan();
    // 供 _onScanMessage 扫码成功回调读取（含重新生成二维码场景，每次 open 都重新取当前值）
    this._scanCancelParams = cp;
    this._scan = { careId: care.id, qrCode: null, socketTask: null, replied: false };
    this.setData({ scanQr: { careId: care.id, url: '', status: 'loading' } });
    data.createScanQrCodeByStaffPromise('care_veri_' + care.id, '店铺接待', '养护取板', app.globalData.sessionKey)
      .then((qrCode) => {
        if (!that._scan || that._scan.careId !== care.id) return null; // 已被切走
        that._scan.qrCode = qrCode;
        return data.getOAQrCodeUrlPromise(qrCode.code).then((url) => {
          if (!that._scan || that._scan.careId !== care.id) return;
          that.setData({ scanQr: { careId: care.id, url, status: 'ready' } });
          that._startSocket();
        });
      })
      .catch(() => {
        if (!that._scan || that._scan.careId !== care.id) return;
        that.setData({ 'scanQr.status': 'broken' });
      });
  },

  _startSocket() {
    const that = this;
    const scan = this._scan;
    if (!scan || !scan.qrCode) return;
    const socketTask = wx.connectSocket({
      url: 'wss://' + app.globalData.domainName + '/ws',
      header: { 'content-type': 'application/json' },
    });
    scan.socketTask = socketTask;
    socketTask.onOpen(() => {
      socketTask.send({ data: JSON.stringify({ command: 'queryqrscan', id: scan.qrCode.id }) });
    });
    socketTask.onMessage((res) => { that._onScanMessage(res); });
    socketTask.onClose(() => { that._onScanClosed(); });
    socketTask.onError(() => { that._onScanClosed(); });
  },

  _onScanMessage(res) {
    const that = this;
    const scan = this._scan;
    if (!scan) return;
    let msg = null;
    try { msg = JSON.parse(res.data); } catch (err) { return; }
    const scanQrCode = (msg && msg.data) || {};
    scan.replied = true;
    const order = this.data.order || {};
    const scanCareId = scan.careId;
    // 先取出，_closeScan() 会清掉 this._scanCancelParams
    const cp = this._scanCancelParams || { isCancel: false, reason: undefined };
    if (order.member_id && order.member_id === scanQrCode.scaner_member_id) {
      const care = (this.data.cares || []).find((c) => c.id === scanCareId);
      const finishTask = care ? (care._tasks || []).find((t) => t.task_name === '发板') : null;
      this._closeScan();
      if (!finishTask) return;
      data.updateCareTaskStatusPromise(finishTask.id, '已完成', '扫码取板',
        app.globalData.sessionKey, null, null, null, cp.isCancel, cp.reason)
        .then(() => {
          wx.showToast({ title: cp.isCancel ? '已取消' : '扫码发板完成', icon: 'success' });
          that.loadOrder();
        }).catch(() => {});
    } else {
      this._closeScan();
      wx.showToast({ title: '顾客非本人', icon: 'error' });
      // 二维码已被消费，面板给「重新生成二维码」入口
      this.setData({ scanQr: { careId: scanCareId, url: '', status: 'broken' } });
    }
  },

  _onScanClosed() {
    const scan = this._scan;
    if (!scan) return; // 主动关闭
    if (!scan.replied) {
      scan.socketTask = null;
      this.setData({ 'scanQr.status': 'broken' });
    }
  },

  _closeScan() {
    const scan = this._scan;
    this._scanCancelParams = null;
    if (!scan) return;
    this._scan = null;
    if (scan.qrCode && !scan.replied) {
      data.stopScanQrCodePromise(scan.qrCode.id, app.globalData.sessionKey).catch(() => {});
    }
    if (scan.socketTask) {
      try { scan.socketTask.close({}); } catch (err) { /* 已关闭 */ }
    }
    this.setData({ scanQr: { careId: 0, url: '', status: '' } });
  },

  onScanRetry(e) {
    this._openScan(this._careIdx(e));
  },

  // loadOrder 后校准扫码会话：对应 care 的发板任务已不是待核销态时清理
  _syncScanWithOrder() {
    const scan = this._scan;
    if (!scan) return;
    const care = (this.data.cares || []).find((c) => c.id === scan.careId);
    const finishTask = care ? (care._tasks || []).find((t) => t.task_name === '发板') : null;
    if (!care || !finishTask || finishTask.status !== '未开始') this._closeScan();
  },

  /* ---------- 装备基础信息编辑 ---------- */
  onEditTap(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const raw = (this._rawCares || [])[cidx] || {};
    // 品牌选中下标预派生（WXML 不能 indexOf）
    const list = care.equipment === '双板' ? this.data.skiBrandList : this.data.boardBrandList;
    let brandIndex = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].displayedName === care.brand) { brandIndex = i; break; }
    }
    const serials = care.serials || '';
    const diff = serials.indexOf('|') >= 0;
    const arr = serials.split('|');
    // 编辑照片列表（van-uploader file-list 格式，image_id 对齐服务端）
    const photoFiles = (raw.careImages || []).map((im) => {
      const img = im.image || {};
      return {
        id: im.id,
        image_id: im.image_id || img.id || 0,
        url: fullUrl(img.file_path_name),
        thumb: fullUrl(img.thumbUrl || img.file_path_name),
        status: 'success',
      };
    });
    this.setData({
      ['cares[' + cidx + ']._editing']: true,
      ['cares[' + cidx + ']._brandIndex']: brandIndex,
      ['cares[' + cidx + ']._diffSerial']: diff,
      ['cares[' + cidx + ']._leftSerial']: diff ? arr[0] : '',
      ['cares[' + cidx + ']._rightSerial']: diff && arr.length > 1 ? arr[1] : '',
      ['cares[' + cidx + ']._photoFiles']: photoFiles,
    });
  },

  onEditCancel() {
    // 丢弃本地改动，服务端为真理之源
    this.loadOrder();
  },

  onEditFieldBlur(e) {
    const cidx = this._careIdx(e);
    const field = e.currentTarget.dataset.field; // scale/boot_length/serials/_leftSerial/_rightSerial/others_associates/memo
    this.setData({ ['cares[' + cidx + '].' + field]: e.detail.value });
  },

  onBrandChange(e) {
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const list = care.equipment === '双板' ? this.data.skiBrandList : this.data.boardBrandList;
    const idx = parseInt(e.detail.value, 10);
    const item = list[idx];
    if (!item) return;
    if (idx === list.length - 1) {
      // 末项「新增品牌」→ 弹层
      this.setData({ addBrand: { show: true, cidx, name: '', chineseName: '' } });
      return;
    }
    this.setData({
      ['cares[' + cidx + '].brand']: item.displayedName,
      ['cares[' + cidx + ']._brandIndex']: idx,
    });
  },

  onBoardFrontTap(e) {
    const cidx = this._careIdx(e);
    const v = e.currentTarget.dataset.value; // 左 / 右
    this.setData({ ['cares[' + cidx + '].board_front']: v });
  },

  onSerialDiffTap(e) {
    const cidx = this._careIdx(e);
    const next = !this.data.cares[cidx]._diffSerial;
    this.setData({
      ['cares[' + cidx + ']._diffSerial']: next,
      ['cares[' + cidx + '].serials']: '',
      ['cares[' + cidx + ']._leftSerial']: '',
      ['cares[' + cidx + ']._rightSerial']: '',
    });
  },

  onWithPoleTap(e) {
    const cidx = this._careIdx(e);
    this.setData({ ['cares[' + cidx + '].with_pole']: !this.data.cares[cidx].with_pole });
  },

  onEditPhotoRead(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const uploadFile = e.detail.file;
    const pending = {
      id: 0, image_id: 0,
      url: uploadFile.tempFilePath,
      thumb: uploadFile.thumb || uploadFile.tempFilePath,
      status: 'uploading', message: '上传中',
    };
    const files = (this.data.cares[cidx]._photoFiles || []).concat([pending]);
    this.setData({ ['cares[' + cidx + ']._photoFiles']: files });
    data.uploadFilePromise(null, uploadFile.tempFilePath, '养护开单', uploadFile.type, app.globalData.sessionKey)
      .then((uploaded) => data.uploadFilePromise(uploaded.id, uploadFile.thumb || uploadFile.tempFilePath,
        null, null, app.globalData.sessionKey))
      .then((withThumb) => {
        const cur = (that.data.cares[cidx]._photoFiles || []).slice();
        const i = cur.findIndex((f) => f.status === 'uploading');
        if (i >= 0) {
          cur[i] = {
            id: 0,
            image_id: withThumb.id,
            url: fullUrl(withThumb.file_path_name),
            thumb: fullUrl(withThumb.thumbUrl || withThumb.file_path_name),
            status: 'success',
          };
        }
        that.setData({ ['cares[' + cidx + ']._photoFiles']: cur });
      })
      .catch(() => {
        wx.showToast({ title: '照片上传失败', icon: 'none' });
        const cur = (that.data.cares[cidx]._photoFiles || []).filter((f) => f.status !== 'uploading');
        that.setData({ ['cares[' + cidx + ']._photoFiles']: cur });
      });
  },

  onEditPhotoDelete(e) {
    const cidx = this._careIdx(e);
    const index = e.detail.index;
    const cur = (this.data.cares[cidx]._photoFiles || []).filter((f, i) => i !== index);
    this.setData({ ['cares[' + cidx + ']._photoFiles']: cur });
  },

  onEditSave(e) {
    const that = this;
    const cidx = this._careIdx(e);
    const care = this.data.cares[cidx];
    const raw = (this._rawCares || [])[cidx];
    if (!raw) return;
    // 以原始 care 为基底合成 payload（保存别整体覆盖本地状态的反向应用：提交时以服务端原对象为基底）
    const payload = { ...raw };
    payload.brand = care.brand || null;
    payload.scale = care.scale || null;
    payload.boot_length = care.boot_length || null;
    payload.board_front = care.board_front || null;
    payload.others_associates = care.others_associates || null;
    payload.memo = care.memo || null;
    payload.serials = care._diffSerial
      ? ((care._leftSerial || '') + '|' + (care._rightSerial || ''))
      : (care.serials || '');
    // bool 字段 coerce，不发 null（后端非可空 bool，null 反序列化 400）
    payload.with_pole = !!care.with_pole;
    payload.entertain = !!care.entertain;
    payload.warranty = !!care.warranty;
    payload.use_card = !!raw.use_card;
    // careImages：以编辑面板照片为准；既有行保留原对象标量（去导航），新照片 id=0 插入，删掉的行后端按 id diff 物理删
    payload.careImages = [];
    (care._photoFiles || []).forEach((f) => {
      if (f.status !== 'success' || !f.image_id) return;
      if (f.id > 0) {
        const ori = (raw.careImages || []).find((im) => im.id === f.id);
        if (ori) {
          const keep = { ...ori };
          delete keep.image;
          delete keep.care;
          keep.image_id = f.image_id;
          keep.care_id = raw.id;
          payload.careImages.push(keep);
          return;
        }
      }
      payload.careImages.push({ id: 0, care_id: raw.id, image_id: f.image_id, valid: true });
    });
    payload.tasks = raw.tasks;
    data.updateCarePromise(payload, '养护订单详情页修改装备信息', app.globalData.sessionKey).then(() => {
      wx.showToast({ title: '更新成功', icon: 'success' });
      that.loadOrder();
    }).catch(() => {});
  },

  /* ---------- 新增品牌 ---------- */
  onAddBrandInput(e) {
    const field = e.currentTarget.dataset.field; // name / chineseName
    this.setData({ ['addBrand.' + field]: e.detail.value });
  },

  onAddBrandCancel() {
    this.setData({ addBrand: { show: false, cidx: -1, name: '', chineseName: '' } });
  },

  onAddBrandConfirm() {
    const that = this;
    const { cidx, name, chineseName } = this.data.addBrand;
    const care = this.data.cares[cidx];
    if (!care) return;
    if (!name) {
      wx.showToast({ title: '必须填写英文名称', icon: 'error' });
      return;
    }
    data.updateCareBrandPromise(care.equipment, name, chineseName || '', app.globalData.sessionKey)
      .then((brandList) => {
        brandList.push({
          brand_type: care.equipment, brand_name: 'Add New', chinese_name: '新增品牌', origin: '', displayedName: '新增品牌',
        });
        let brand = care.brand;
        let brandIndex = care._brandIndex;
        for (let i = 0; i < brandList.length; i++) {
          if (brandList[i].brand_name === name) {
            brand = brandList[i].displayedName;
            brandIndex = i;
            break;
          }
        }
        const patch = { addBrand: { show: false, cidx: -1, name: '', chineseName: '' } };
        patch[care.equipment === '双板' ? 'skiBrandList' : 'boardBrandList'] = brandList;
        patch['cares[' + cidx + '].brand'] = brand;
        patch['cares[' + cidx + ']._brandIndex'] = brandIndex;
        that.setData(patch);
      })
      .catch(() => {
        wx.showToast({ title: '新增品牌失败', icon: 'none' });
      });
  },

  /* ---------- 打印 ---------- */
  _preparePrint(cidx) {
    const care = this.data.cares[cidx];
    const order = this.data.order || {};
    const m = order.member;
    // print-care 组件依赖 care 上的 customerName/customerCell/shop（对齐旧页 showPrintBackDrop）
    care.customerName = m ? m.title : (order.contact_name || '散客');
    care.customerCell = m ? m.cell : (order.contact_num || '');
    care.shop = order.shop;
    return care;
  },

  onPrintLabel(e) {
    const care = this._preparePrint(this._careIdx(e));
    this.setData({ printShow: true, printType: 'label', careToBePrinted: care });
  },

  onPrintInvoice(e) {
    const care = this._preparePrint(this._careIdx(e));
    this.setData({ printShow: true, printType: 'invoice', careToBePrinted: care });
  },

  onPrinterClose() {
    this.setData({ printShow: false });
  },
});
