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
