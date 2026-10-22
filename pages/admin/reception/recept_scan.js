// pages/admin/reception/recept_scan.js
// 扫码接待（管理员菜单默认进入的开单入口，对应旧版 recept_entry）
//   店员手机出一次性接待码（120 秒过期自动换新）→ 顾客用微信扫码直接进小程序（pages/order/recept_checkin）
//   → 本页一发现有人扫码，就跳到顾客信息页（recept_member）：老顾客直接显示会员信息，
//     新顾客在手机上授权手机号后那边弹窗提示，再选店铺和业务开单。
//   顾客不扫码时点「散客进入」，同样到顾客信息页选店铺和业务。
//   也可以输会员手机号进入（同旧版）：店长及以上直接进入；普通店员要等店长在「【接待】接待授权」
//   （recept_auth_list）里授权，本页查到授权后进入顾客信息页。
// 手动录入顾客信息的入口 recept_entry 保留，由页面底部链接进入。
//
// 后端依赖（SnowmeetApi QrCodeController）：
//   CreateReceptCheckinByStaff / GetReceptCheckinByStaff / QueryCell / StopQeryScan
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');
const { normalizePhone, shouldLookupPhone } = require('../../../utils/phone.js');

const POLL_INTERVAL = 1500;
const MEMBER_PAGE = '/pages/admin/reception/recept_member';
// 有了顾客、交给顾客信息页的阶段：顾客扫码（待授权手机号 / 已验证），店员输手机号已授权
const HANDOFF_STAGES = ['need_phone', 'verified', 'phone_authed'];

Page({
  data: {
    // 当前接待码 { id, code, qrText, stage, expireTime }
    checkin: null,
    qrCodeUrl: '',
    loadingQr: false,
    stageText: '',

    // 输手机号进入
    cell: '',
    // 已提交手机号、等店长授权；authText 说明是哪位会员
    waitingAuth: false,
    authText: '',

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
    // 切回前台：继续查原来那张码（已过期会自动换新）；从顾客信息页返回：码已交出去，出一张新码
    if (this.data.checkin) {
      this.pollCheckin();
      this._startPolling();
      return;
    }
    this.refreshCheckin();
  },

  // 切到后台只暂停轮询、不作废码：店员看一眼别的应用回来还要接得上
  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
    this._discardUnusedCode();
  },

  /* ---------- 接待码 ---------- */
  refreshCheckin() {
    const that = this;
    if (that._creating) return;
    that._creating = true;
    that._stopPolling();
    that._discardUnusedCode();
    that.setData({ loadingQr: true, checkin: null, qrCodeUrl: '', stageText: '', cell: '', waitingAuth: false, authText: '' });
    Promise.resolve(app.loginPromiseNew).then(function () {
      return data.createReceptCheckinByStaffPromise(app.globalData.sessionKey);
    }).then(function (checkin) {
      that._creating = false;
      const qrCodeUrl = app.globalData.requestPrefix + 'MediaHelper/GetQRCode?qrCodeText='
        + encodeURIComponent(checkin.qrText);
      that.setData({ checkin, qrCodeUrl, loadingQr: false, stageText: '请顾客用微信扫码' });
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
    if (!checkin) {
      this._stopPolling();
      return;
    }
    data.getReceptCheckinByStaffPromise(checkin.id, app.globalData.sessionKey).then((res) => {
      // 网络抖动 / 偶发错误：等下一轮再查
      if (!res || res.code !== 0 || !res.data) return;
      // 返回时已经换了码 / 已交给顾客信息页，丢弃
      if (!this.data.checkin || this.data.checkin.id !== checkin.id) return;
      this.applyCheckin(res.data);
    });
  },

  applyCheckin(view) {
    if (view.stage === 'expired' || view.stage === 'stopped') {
      this.refreshCheckin();
      return;
    }
    if (view.stage === 'need_auth') {
      this._showWaitingAuth(view);
      return;
    }
    if (HANDOFF_STAGES.indexOf(view.stage) >= 0) {
      // 有了顾客：这张码交给顾客信息页继续跟进，本页回来时重新出码
      this._stopPolling();
      const checkinId = this.data.checkin.id;
      this.setData({ checkin: null, qrCodeUrl: '', stageText: '', cell: '', waitingAuth: false, authText: '' });
      wx.navigateTo({ url: MEMBER_PAGE + '?checkinId=' + checkinId + '&stage=' + view.stage });
    }
  },

  /* ---------- 输手机号进入 ---------- */
  onCellInput(e) {
    this.setData({ cell: (e.detail.value || '').trim() });
  },

  onSubmitCell() {
    const checkin = this.data.checkin;
    const cell = normalizePhone(this.data.cell);
    if (!checkin) {
      wx.showToast({ title: '二维码还没生成好，请稍候', icon: 'none' });
      return;
    }
    if (!shouldLookupPhone(cell)) {
      wx.showToast({ title: '请输入完整手机号', icon: 'none' });
      return;
    }
    // QueryCell 只认已登记手机号的会员，查不到时 performWebRequest 会提示「用户不存在」
    data.queryReceptCellPromise(checkin.id, cell, app.globalData.sessionKey).then((sq) => {
      if (!this.data.checkin || this.data.checkin.id !== checkin.id) return;
      if (sq && sq.authed === 1) {
        this.applyCheckin({ stage: 'phone_authed' });
        return;
      }
      this._showWaitingAuth({ maskedCell: cell.length === 11 ? cell.slice(0, 3) + '****' + cell.slice(7) : cell });
      wx.showToast({ title: '需要店长授权', icon: 'none' });
    }).catch(() => {});
  },

  _showWaitingAuth(view) {
    const who = ((view.name || '') + ' ' + (view.maskedCell || '')).trim();
    this.setData({
      waitingAuth: true,
      authText: '已提交' + (who ? ' ' + who : '') + '，等店长在「【接待】接待授权」里授权…',
    });
    if (!this._pollTimer) this._startPolling();
  },

  // 不等授权了：作废这次提交，重新出码
  onCancelAuthTap() {
    this.refreshCheckin();
  },

  // 作废还没人扫的码，免得过后有人扫到、一直等不到开单
  _discardUnusedCode() {
    const checkin = this.data.checkin;
    if (!checkin) return;
    data.stopScanQrCodePromise(checkin.id, app.globalData.sessionKey).catch(() => {});
  },

  /* ---------- 散客进入 ---------- */
  onWalkInTap() {
    this._stopPolling();
    this._discardUnusedCode();
    this.setData({ checkin: null, qrCodeUrl: '', stageText: '', cell: '', waitingAuth: false, authText: '' });
    wx.navigateTo({ url: MEMBER_PAGE + '?walkin=1' });
  },

  /* ---------- 手动录入入口 ---------- */
  onManualEntryTap() {
    wx.navigateTo({ url: '/pages/admin/reception/recept_entry' });
  },

  /* ---------- 其他交互 ---------- */
  onTabChange() {},

  // 本页不选店铺，找回今天所有店铺中断的订单
  onRecoverOrder() {
    const that = this
    that.setData({ showRecoverPanel: true, recoverLoading: true, recoverOrders: [] })
    data.getRentReceptingOrdersPromise(null, app.globalData.sessionKey).then(function (orders) {
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

  // 中断单自带店铺，recept_new 按单子上的店铺恢复
  onRecoverOrderTap(e) {
    const orderId = e.currentTarget.dataset.id
    this.setData({ showRecoverPanel: false })
    wx.navigateTo({
      url: '/pages/admin/reception/recept_new?orderId=' + orderId + '&bizType=rent',
    })
  },

  onCloseRecoverPanel() {
    this.setData({ showRecoverPanel: false })
  },
});
