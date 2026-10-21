// components/reception/retail_recept_form/retail_recept_form.js
// 零售接待开单表单（业务字段对齐旧版 components/retail/retail_recept，2026-08-12 随旧接待页删除；
// 交互/视觉对齐 rent_recept_form / care_recept_form）
// 一单一笔：一个七色米单号 + 一个金额（与旧版、零售订单详情页 retails[0] 的结构一致）。
// 不存草稿：零售只有几个字段，点「去结算」时父页才调 Order/PlaceOrder 下单（2026-10-21 用户决定）。
// 组件契约：
//   - properties.shop       店铺名
//   - properties.memberId   会员 id（决定能否积龙珠）
//   - triggerEvent('checkout', { retail, retailImages })   点击去结算，校验已全部通过
//   - reset()               父页下单成功后调用，清空表单准备下一单
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');
const retailRules = require('../../../utils/retail.js');

// 与 data.js uploadFilePromise 的上传域名保持一致
const UPLOAD_HOST = data.IMAGE_HOST;
const MAX_IMAGES = 5;

function fullUrl(p) {
  if (!p) return '';
  return p.indexOf('http') === 0 ? p : UPLOAD_HOST + p;
}

function blankForm() {
  return {
    dealPrice: null,          // 支付金额（数字）；null = 未填
    urgent: false,            // 紧急开单：先不填七色米单号，之后在详情页补
    mi7Code: '',
    mi7Status: 'empty',       // empty / invalid / checking / dup / ok / unchecked
    retailType: '零售',
    entertain: false,         // 招待：金额不计入应收
    giveupScore: false,       // 放弃龙珠
    memo: '',
    images: [],
  };
}

Component({
  properties: {
    shop: { type: String, value: '' },
    memberId: {
      type: null,
      value: null,
      observer(v) { this._loadMember(v); },
    },
  },
  data: {
    form: blankForm(),
    typeOptions: retailRules.retailTypeOptions('零售'),
    // 能否积龙珠：会员且关注了公众号（旧版口径：member.following_wechat == 1）
    canKeepScore: false,
    dealPriceStr: '',
    mi7Hint: '',
    summary: { amountStr: '¥0.00', canCheckout: false, missing: '' },
    amountModal: { show: false, value: '' },
    maxImages: MAX_IMAGES,
  },
  lifetimes: {
    attached() {
      this._refresh();
    },
  },
  methods: {
    /* ---------- 对外 ---------- */
    reset() {
      this._mi7Seq = (this._mi7Seq || 0) + 1; // 丢弃还在飞的查重结果
      const form = blankForm();
      form.giveupScore = !this.data.canKeepScore;
      this.setData({ form, typeOptions: retailRules.retailTypeOptions(form.retailType) });
      this._refresh();
    },

    /* ---------- 派生数据 ---------- */
    _refresh() {
      const f = this.data.form;
      const hasPrice = f.dealPrice !== null && f.dealPrice !== undefined && !isNaN(f.dealPrice);
      let mi7Hint = '';
      if (!f.urgent) {
        if (f.mi7Status === 'invalid') mi7Hint = '格式不对：XSD 开头，14 位，或 15 位以 I/A 结尾';
        else if (f.mi7Status === 'checking') mi7Hint = '正在查重…';
        else if (f.mi7Status === 'dup') mi7Hint = '这个七色米单号已经开过单了';
        else if (f.mi7Status === 'ok') mi7Hint = '单号可用';
      }
      // 第一个缺项：按钮不置死，点了 toast 告诉店员还差什么
      let missing = '';
      if (!hasPrice) missing = '请填写支付金额';
      else if (!f.urgent && f.mi7Status === 'empty') missing = '请填写七色米单号，或选「紧急开单」';
      else if (!f.urgent && f.mi7Status === 'invalid') missing = '七色米单号格式不对';
      else if (!f.urgent && f.mi7Status === 'checking') missing = '正在查重，请稍候';
      else if (!f.urgent && f.mi7Status === 'dup') missing = '七色米单号重复';
      else if ((f.images || []).some((im) => im.status === 'uploading')) missing = '照片还在上传';
      const amount = hasPrice && !f.entertain ? f.dealPrice : 0;
      this.setData({
        dealPriceStr: hasPrice ? util.showAmount(f.dealPrice) : '',
        mi7Hint,
        summary: {
          amountStr: util.showAmount(amount),
          canCheckout: !missing,
          missing,
        },
      });
    },

    _patch(patch) {
      const form = { ...this.data.form, ...patch };
      this.setData({ form });
      this._refresh();
    },

    /* ---------- 会员：能否积龙珠 ---------- */
    _loadMember(memberId) {
      const that = this;
      that._memberSeq = (that._memberSeq || 0) + 1;
      const seq = that._memberSeq;
      if (!memberId) {
        // 散客不积龙珠（旧版：非会员默认放弃且不可改）
        that.setData({ canKeepScore: false, 'form.giveupScore': true });
        return;
      }
      Promise.resolve(app.loginPromiseNew).then(() => {
        return data.getMemberPromise(memberId, app.globalData.sessionKey);
      }).then((member) => {
        if (seq !== that._memberSeq) return; // 已换人
        const canKeep = !!(member && member.following_wechat == 1);
        that.setData({ canKeepScore: canKeep, 'form.giveupScore': !canKeep });
      }).catch(() => {
        if (seq !== that._memberSeq) return;
        that.setData({ canKeepScore: false, 'form.giveupScore': true });
      });
    },

    onToggleGiveupScore() {
      if (!this.data.canKeepScore) {
        wx.showToast({ title: '散客或未关注公众号的会员不积龙珠', icon: 'none' });
        return;
      }
      this._patch({ giveupScore: !this.data.form.giveupScore });
    },

    /* ---------- 支付金额 ---------- */
    onAmountTap() {
      // 点开即空：直接输新金额，不用先删原值（同租赁/养护的金额弹窗）
      this.setData({ amountModal: { show: true, value: '' } });
    },
    onAmountModalInput(e) {
      this.setData({ 'amountModal.value': e.detail.value });
    },
    onAmountModalCancel() {
      this.setData({ 'amountModal.show': false });
    },
    onAmountModalConfirm() {
      const raw = String(this.data.amountModal.value || '').trim();
      if (raw === '') {
        this.setData({ 'amountModal.show': false });
        return;
      }
      const v = parseFloat(raw);
      if (isNaN(v) || v < 0) {
        wx.showToast({ title: '请输入有效金额', icon: 'none' });
        return;
      }
      this.setData({ 'amountModal.show': false });
      this._patch({ dealPrice: Math.round(v * 100) / 100 });
    },

    /* ---------- 七色米单号 ---------- */
    onToggleUrgent() {
      const urgent = !this.data.form.urgent;
      if (urgent) {
        this._mi7Seq = (this._mi7Seq || 0) + 1;
        this._patch({ urgent: true, mi7Code: '', mi7Status: 'empty' });
      } else {
        this._patch({ urgent: false });
      }
    },
    onMi7Input(e) {
      const code = retailRules.normalizeMi7Code(e.detail.value);
      this._mi7Seq = (this._mi7Seq || 0) + 1;
      let status = 'empty';
      if (code) status = retailRules.isValidMi7Code(code) ? 'unchecked' : 'invalid';
      this._patch({ mi7Code: code, mi7Status: status });
      return code;
    },
    onMi7Blur() {
      this._checkMi7Duplicate();
    },
    onMi7Scan() {
      if (this.data.form.urgent) return;
      const that = this;
      wx.scanCode({
        success(res) {
          const code = retailRules.normalizeMi7Code(res.result);
          that._mi7Seq = (that._mi7Seq || 0) + 1;
          that._patch({
            mi7Code: code,
            mi7Status: code ? (retailRules.isValidMi7Code(code) ? 'unchecked' : 'invalid') : 'empty',
          });
          that._checkMi7Duplicate();
        },
      });
    },
    // 格式正确才查重；查询失败时放行（PlaceOrder 服务端还会再查一次）
    _checkMi7Duplicate() {
      const that = this;
      const f = this.data.form;
      if (f.urgent || f.mi7Status !== 'unchecked') return;
      const code = f.mi7Code;
      that._mi7Seq = (that._mi7Seq || 0) + 1;
      const seq = that._mi7Seq;
      that._patch({ mi7Status: 'checking' });
      data.getRetailOrderByMi7CodePromise(code, app.globalData.sessionKey).then((retails) => {
        if (seq !== that._mi7Seq) return;
        that._patch({ mi7Status: retails && retails.length > 0 ? 'dup' : 'ok' });
      }).catch(() => {
        if (seq !== that._mi7Seq) return;
        that._patch({ mi7Status: 'unchecked' });
      });
    },

    /* ---------- 订单类型 / 招待 / 备注 ---------- */
    onTypeTap(e) {
      const value = e.currentTarget.dataset.value;
      if (retailRules.isDisabledRetailType(value)) {
        wx.showToast({ title: retailRules.DISABLED_TYPE_TIP, icon: 'none' });
        return;
      }
      this.setData({ typeOptions: retailRules.retailTypeOptions(value) });
      this._patch({ retailType: value });
    },
    onSpecialTap(e) {
      this._patch({ entertain: e.currentTarget.dataset.special === 'entertain' });
    },
    onMemoInput(e) {
      // 只写数据不触发重渲染，避免输入时光标跳动
      this.data.form.memo = e.detail.value || '';
    },

    /* ---------- 照片（即传即得 image_id，同养护开单） ---------- */
    onPhotoRead(e) {
      const that = this;
      const uploadFile = e.detail.file;
      const key = 'u' + Date.now();
      const pending = {
        _key: key,
        id: 0,
        image_id: 0,
        status: 'uploading',
        message: '上传中',
        url: uploadFile.tempFilePath,
        thumb: uploadFile.thumb || uploadFile.tempFilePath,
      };
      this._patch({ images: (this.data.form.images || []).concat([pending]) });
      data.uploadFilePromise(null, uploadFile.tempFilePath, '零售开单', uploadFile.type, app.globalData.sessionKey)
        .then((uploaded) => data.uploadFilePromise(uploaded.id, uploadFile.thumb || uploadFile.tempFilePath, null, null, app.globalData.sessionKey))
        .then((withThumb) => {
          const imgs = (that.data.form.images || []).map((im) => {
            if (im._key !== key) return im;
            return {
              _key: key,
              id: 0,
              image_id: withThumb.id,
              status: 'success',
              url: fullUrl(withThumb.file_path_name),
              thumb: fullUrl(withThumb.thumbUrl || withThumb.file_path_name),
            };
          });
          that._patch({ images: imgs });
        })
        .catch(() => {
          wx.showToast({ title: '照片上传失败', icon: 'none' });
          that._patch({ images: (that.data.form.images || []).filter((im) => im._key !== key) });
        });
    },
    onPhotoDelete(e) {
      const index = e.detail.index;
      this._patch({ images: (this.data.form.images || []).filter((im, i) => i !== index) });
    },

    /* ---------- 结算 ---------- */
    onCheckout() {
      const s = this.data.summary;
      if (!s.canCheckout) {
        wx.showToast({ title: s.missing || '信息未填完整', icon: 'none' });
        return;
      }
      const f = this.data.form;
      // 字段名对齐后端 Models/Order/Retail.cs。order_type 必须给值：
      // Order.haveEntertain 对 retails[i].order_type 直接 Trim()，为 null 会让订单序列化 500
      const retail = {
        id: 0,
        order_id: 0,
        mi7_code: f.urgent ? null : f.mi7Code,
        sale_price: null,
        deal_price: f.dealPrice,
        order_type: f.entertain ? '招待' : '普通',
        retail_type: f.retailType,
        giveup_score: f.giveupScore ? 1 : 0,
        memo: f.memo || '',
        valid: 1,
      };
      const retailImages = (f.images || [])
        .filter((im) => im.status === 'success' && im.image_id)
        .map((im) => ({ id: 0, order_id: 0, image_id: im.image_id, valid: true }));
      this.triggerEvent('checkout', { retail, retailImages });
    },
  },
});
