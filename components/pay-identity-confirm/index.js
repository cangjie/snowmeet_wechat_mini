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
    busy: false
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

    // choose_identity 的软授权变体：scanner 未绑手机号时按钮 open-type=getPhoneNumber 触发本回调
    // 用户同意 → submit_phone（建会员/绑 cell）→ choose:self → status='direct' → 父页自动 _doWepay
    // 用户拒绝 → 沿用 stub/旧会员直接 choose:self（与 onGetPhoneNumberAndConfirmDirect 容错一致）
    onGetPhoneNumberAndChooseSelf(e) {
      if (this.data.busy) return;
      if (!e || !e.detail || e.detail.errMsg !== 'getPhoneNumber:ok') {
        this._confirm({ action: 'choose', choice: 'self' });
        return;
      }
      this._submitPhoneThenChoose(e.detail.encryptedData, e.detail.iv, 'self');
    },

    // 替人代付的软授权变体：tap → 手机号授权 → 「替人代付」确认 modal → submit_phone+choose:proxy
    // 顺序「手机号 → 代付确认 → 落库」是 plan 里用户拍板的（保留与已绑路径相同的 modal 二次确认）
    onGetPhoneNumberAndChooseProxy(e) {
      if (this.data.busy) return;
      const phoneOK = e && e.detail && e.detail.errMsg === 'getPhoneNumber:ok';
      const encData = phoneOK ? e.detail.encryptedData : null;
      const iv = phoneOK ? e.detail.iv : null;
      wx.showModal({
        title: '替人代付',
        content: '订单将继续归于原会员名下，仅本笔付款记为代付。是否确认？',
        success: (res) => {
          if (!res.confirm) return;
          if (phoneOK) {
            this._submitPhoneThenChoose(encData, iv, 'proxy');
          } else {
            // 拒绝授权 → 不带 phone 走 choose:proxy
            this._confirm({ action: 'choose', choice: 'proxy' });
          }
        }
      });
    },

    // 内部 helper：submit_phone → choose → triggerEvent refreshed
    // 与 onGetPhoneNumberAndConfirmDirect 的双 Promise 链结构一致
    _submitPhoneThenChoose(encData, iv, choice) {
      const that = this;
      this.setData({ busy: true });
      wx.showLoading({ title: '处理中...', mask: true });
      data.confirmPayIdentityPromise({
        paymentId: this.data.paymentId,
        payerType: this.data.payerType,
        scannerId: this.data.scannerId,
        action: 'submit_phone',
        encData, iv
      }, app.globalData.sessionKey).then(function () {
        return data.confirmPayIdentityPromise({
          paymentId: that.data.paymentId,
          payerType: that.data.payerType,
          scannerId: that.data.scannerId,
          action: 'choose',
          choice
        }, app.globalData.sessionKey);
      }).then(function (finalResult) {
        wx.hideLoading();
        that.setData({ busy: false });
        that.triggerEvent('refreshed', { result: finalResult });
      }).catch(function () {
        wx.hideLoading();
        that.setData({ busy: false });
      });
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
