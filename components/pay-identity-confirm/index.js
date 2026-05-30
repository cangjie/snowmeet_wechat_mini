// components/pay-identity-confirm/index.js
// 支付前身份验证 UI：渲染 phone_required / direct_to_scanner / choose_identity 三种状态
// 父组件传入 paymentId / payerType / scannerId / status / result，本组件处理用户交互后
// 调 PaymentIdentity/ConfirmPayIdentity 落库，再通过 `refreshed` 事件回传最新结果。
const app = getApp();
const data = require('../../utils/data.js');

Component({
  properties: {
    paymentId: { type: Number, value: 0 },
    payerType: { type: String, value: 'wechat' },
    scannerId: { type: String, value: '' },
    status:    { type: String, value: '' },
    result:    { type: Object, value: null }
  },

  data: {
    busy: false,
    // choose_identity 状态下、scanner 没绑手机号时，先盖一层"验证手机号"软授权 gate；
    // 用户授权或跳过后置为 true，露出 正常支付/替人代付 按钮。与 direct_to_scanner 的软授权流程对齐。
    phoneGateDone: false
  },

  // status 切换时（如父页 setData refresh 后）重置 gate，避免上次 done 状态污染新决策
  observers: {
    status() {
      if (this.data.phoneGateDone) this.setData({ phoneGateDone: false });
    }
  },

  methods: {
    // 手机号一键授权（status == 'phone_required'）
    onGetPhoneNumber(e) {
      if (this.data.busy) return;
      if (!e || !e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
        wx.showToast({ title: '未授权手机号', icon: 'none' });
        return;
      }
      this._confirm({
        action: 'submit_phone',
        encData: e.detail.encryptedData,
        iv: e.detail.iv
      });
    },

    // 直接归扫码方（status == 'direct_to_scanner'）
    onConfirmDirect() {
      if (this.data.busy) return;
      this._confirm({ action: 'confirm_direct' });
    },

    // 散客 / 无 cell 会员 在 direct_to_scanner 状态点「确认并继续」(open-type=getPhoneNumber)
    // 流程: 拿手机号 → submit_phone(后端按 scanner 自动分流: null→_createNewMember, 非null→BindMemberMainCellNum) → confirm_direct → 触发 pay
    // 用户拒绝授权 → 仍尝试 confirm_direct(沿用现有会员或在散客分支建无cell会员完成支付)
    onGetPhoneNumberAndConfirmDirect(e) {
      console.log('[pay-identity-confirm] onGetPhoneNumberAndConfirmDirect entry', { errMsg: e && e.detail && e.detail.errMsg })
      if (this.data.busy) return;
      if (!e || !e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
        console.log('[pay-identity-confirm] user denied or cancelled getPhoneNumber → fall back to confirm_direct')
        // 用户取消/拒绝授权 → 直接走原 confirm_direct(沿用 MemberLogin 自动建的 stub)
        this._confirm({ action: 'confirm_direct' });
        return;
      }
      const that = this;
      this.setData({ busy: true });
      wx.showLoading({ title: '处理中...', mask: true });
      // 第一步: submit_phone → 后端 _submitPhone 自动 _createNewMember/绑 cell
      data.confirmPayIdentityPromise({
        paymentId: this.data.paymentId,
        payerType: this.data.payerType,
        scannerId: this.data.scannerId,
        action: 'submit_phone',
        encData: e.detail.encryptedData,
        iv: e.detail.iv
      }, app.globalData.sessionKey).then(function (r1) {
        console.log('[pay-identity-confirm] submit_phone OK', { status: r1 && r1.status, scannerMemberId: r1 && r1.scannerMemberId, scannerHasCell: r1 && r1.scannerHasCell })
        // 第二步: confirm_direct → 写 op.member_id = scannerMemberId + 返 status='direct'
        return data.confirmPayIdentityPromise({
          paymentId: that.data.paymentId,
          payerType: that.data.payerType,
          scannerId: that.data.scannerId,
          action: 'confirm_direct'
        }, app.globalData.sessionKey);
      }).then(function (finalResult) {
        console.log('[pay-identity-confirm] confirm_direct OK', { status: finalResult && finalResult.status, scannerMemberId: finalResult && finalResult.scannerMemberId })
        wx.hideLoading();
        that.setData({ busy: false });
        that.triggerEvent('refreshed', { result: finalResult });
      }).catch(function (err) {
        console.warn('[pay-identity-confirm] submit_phone or confirm_direct failed', err)
        wx.hideLoading();
        that.setData({ busy: false });
        // performWebRequest 已 toast 错误信息(如手机号冲突),无需重复
      });
    },

    // choose_identity gate: 拿到手机号 → submit_phone 落库 → 露选身份按钮。
    // 若 submit_phone 之后后端 _resolveStatus 把 scanner 解析成与 order 同一会员（边界场景），
    // 返回 status='direct'，父页 onIdentityRefreshed 会自动 _doWepay()，无需再选身份。
    onGetPhoneNumberAndPassGate(e) {
      if (this.data.busy) return;
      if (!e || !e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
        // 用户拒绝/取消授权 → 不拦支付，gate 放行让选身份
        this.setData({ phoneGateDone: true });
        return;
      }
      const that = this;
      this.setData({ busy: true });
      wx.showLoading({ title: '处理中...', mask: true });
      data.confirmPayIdentityPromise({
        paymentId: this.data.paymentId,
        payerType: this.data.payerType,
        scannerId: this.data.scannerId,
        action: 'submit_phone',
        encData: e.detail.encryptedData,
        iv: e.detail.iv
      }, app.globalData.sessionKey).then(function (result) {
        wx.hideLoading();
        that.setData({ busy: false, phoneGateDone: true });
        // 把 submit_phone 返回的最新身份结果给父页：若 status 转 direct（scanner 解析成 orderMember）
        // 父页会自动支付；否则父页仅刷新 identity（scannerHasCell=true / scannerMaskedCell 更新），
        // 本组件因 status 仍是 choose_identity 走 gate 已 done 分支，露选身份按钮。
        that.triggerEvent('refreshed', { result });
      }).catch(function () {
        wx.hideLoading();
        // 失败也放行 gate（与 direct_to_scanner 的容错一致），用户仍可选身份继续支付
        that.setData({ busy: false, phoneGateDone: true });
      });
    },

    // choose_identity gate: 用户跳过授权，直接进入选身份
    onPhoneGateSkip() {
      if (this.data.busy) return;
      this.setData({ phoneGateDone: true });
    },

    // 归我（status == 'choose_identity'，"正常支付"）
    onChooseSelf() {
      if (this.data.busy) return;
      this._confirm({ action: 'choose', choice: 'self' });
    },

    // 替人代付（status == 'choose_identity'）
    onChooseProxy() {
      if (this.data.busy) return;
      wx.showModal({
        title: '替人代付',
        content: '订单将继续归于原会员名下，仅本笔付款记为代付。是否确认？',
        success: (res) => {
          if (res.confirm) {
            this._confirm({ action: 'choose', choice: 'proxy' });
          }
        }
      });
    },

    // 内部统一 confirm 调用
    _confirm(extra) {
      const body = Object.assign({
        paymentId: this.data.paymentId,
        payerType: this.data.payerType,
        scannerId: this.data.scannerId
      }, extra);
      this.setData({ busy: true });
      wx.showLoading({ title: '处理中...', mask: true });
      data.confirmPayIdentityPromise(body, app.globalData.sessionKey).then((result) => {
        wx.hideLoading();
        this.setData({ busy: false });
        // performWebRequest 已对 code!=0 自动 toast 并 reject，所以这里走到说明 code==0
        this.triggerEvent('refreshed', { result });
      }).catch(() => {
        wx.hideLoading();
        this.setData({ busy: false });
        // toast 已在 performWebRequest 内显示，这里不再处理
      });
    }
  }
});
