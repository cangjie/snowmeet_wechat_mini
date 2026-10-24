const cards = require('../../../utils/careCardSale.js');

const initialData = {
  careCardSelections: [], careCardPreview: null, careCardError: '', careCardMode: '',
  cardSaleShow: false, cardSaleProducts: [], cardSalePreview: null,
  cardSaleLoading: false, cardSaleBusy: false, cardSaleError: ''
};

const methods = {
  _cardApi(action, body, orderId) { return cards.request(action, body, orderId); },

  async _restoreCareCardDraft() {
    if (this.data.bizType !== 'maintain' || !this.data.order.id) return;
    try {
      const draft = await this._cardApi('GetDraft', null, this.data.order.id);
      this._hadCareCardDraft = !!(draft.selections && draft.selections.length);
      this.setData({ careCardSelections: draft.selections || [] });
      if (this._hadCareCardDraft) this._applyCareCardPreview(draft.preview);
    } catch (e) { console.warn('load care card draft failed', e); }
  },

  _applyCareCardPreview(preview) {
    const projects = preview.projects || [];
    const cares = this.data.order.cares.map(c => {
      const project = projects.find(p => p.careId === c.id);
      if (!project) return c;
      const { careId, ...flags } = project;
      return Object.assign({}, c, flags, { use_card: false, card_id: null, card_name: null,
        ticket_code: null, ticket: null, card_equip_lock: false, card_pending_open: false,
        common_charge: 0, discount: 0, ticket_discount: 0 });
    });
    this.setData({ 'order.cares': cares, careCardMode: cards.serviceMode(preview.items && preview.items[0]),
      careCardPreview: cards.displayPreview(preview, cares), careCardError: (preview.errors || []).join('；') });
  },

  _invalidateCareCardTrial() {
    this._careCardRevision = (this._careCardRevision || 0) + 1;
    if (this.data.careCardSelections.length) this.setData({ careCardPreview: null, careCardError: '装备或项目已变更，正在重新试算' });
    if (this.data.cardSaleShow) this.setData({ cardSalePreview: null });
  },

  async _refreshSavedCareCards() {
    if (this._careCardSubmitting) return;
    if (this.data.cardSaleShow) { await this.onCardRecalculate(); return; }
    if (!this.data.careCardSelections.length) return;
    const revision = this._careCardRevision;
    try {
      const preview = await this._cardApi('SaveDraft', { orderId: this.data.order.id, selections: this.data.careCardSelections });
      if (revision !== this._careCardRevision) return;
      this._applyCareCardPreview(preview);
    } catch (e) {
      if (revision === this._careCardRevision) this.setData({ careCardError: String(e.message || e || '请重新选择卡类') });
    }
  },

  async onAddCareCard() {
    if (this.data.cardSaleBusy) return;
    if (!this.data.customer.memberId) { wx.showToast({ title: '请先匹配会员', icon: 'none' }); return; }
    if (!(this.data.order.cares || []).length) { wx.showToast({ title: '请先添加装备', icon: 'none' }); return; }
    this.setData({ cardSaleShow: true, cardSaleLoading: true, cardSaleError: '', cardSalePreview: null });
    try {
      await this.saveCareReceptOrder();
      const result = await this._cardApi('GetProducts');
      if (!result.enabled) throw new Error('服务器尚未启用养护购卡，请先使用原有开单流程');
      const selected = this.data.careCardSelections;
      this.setData({ cardSaleProducts: (result.products || []).map(p => Object.assign({}, p, {
        quantity: selected.some(s => s.productId === p.id) ? 1 : 0,
        priceLabel: Number(p.price || 0).toFixed(2),
        ruleLabel: p.total == null ? '季卡 · 不限总次数' : p.total + '次',
        bindingLabel: p.requiresBinding ? '限本次绑定雪板' : '不绑定雪板',
        unavailable: cards.serviceMode(p) === 'machine' && this.data.order.cares.length !== 1
      })) });
      await this.onCardRecalculate();
    } catch (e) { this.setData({ cardSaleError: String(e.message || e || '加载卡类失败') }); }
    finally { this.setData({ cardSaleLoading: false }); }
  },

  onCareCardToggle(e) {
    if (this.data.cardSaleBusy) return;
    const id = Number(e.currentTarget.dataset.id);
    const target = this.data.cardSaleProducts.find(p => p.id === id);
    if (!target || target.unavailable) return;
    const products = this.data.cardSaleProducts.map(p => Object.assign({}, p, {
      quantity: p.id === id && !target.quantity ? 1 : 0
    }));
    this.setData({ cardSaleProducts: products });
    this.onCardRecalculate();
  },

  async onCardRecalculate() {
    if (this._careCardSubmitting) return;
    const revision = this._careCardRevision = (this._careCardRevision || 0) + 1;
    const selected = cards.selections(this.data.cardSaleProducts);
    this.setData({ cardSaleLoading: true, cardSalePreview: null, cardSaleError: '' });
    if (!selected.length) { this.setData({ cardSaleLoading: false }); return; }
    try {
      await this.saveCareReceptOrder();
      if (revision !== this._careCardRevision) return;
      const preview = await this._cardApi('Preview', { orderId: this.data.order.id, selections: selected });
      if (revision !== this._careCardRevision || !this.data.cardSaleShow) return;
      this.setData({ cardSalePreview: cards.displayPreview(preview, this.data.order.cares) });
    } catch (e) {
      if (revision === this._careCardRevision) this.setData({ cardSaleError: String(e.message || e || '试算失败') });
    } finally {
      if (revision === this._careCardRevision) this.setData({ cardSaleLoading: false });
    }
  },

  onCareCardClose() {
    if (this.data.cardSaleBusy) return;
    this._careCardRevision = (this._careCardRevision || 0) + 1;
    this.setData({ cardSaleShow: false, cardSaleLoading: false });
  },

  async onRemoveCareCards() {
    if (this.data.cardSaleBusy) return;
    this.setData({ cardSaleBusy: true });
    try {
      await this.saveCareReceptOrder();
      await this._cardApi('SaveDraft', { orderId: this.data.order.id, selections: [] });
      this._hadCareCardDraft = false;
      this.setData({ careCardSelections: [], careCardPreview: null, careCardError: '', careCardMode: '', cardSaleShow: false });
    } catch (e) { wx.showToast({ title: String(e.message || e || '移除失败'), icon: 'none' }); }
    finally { this.setData({ cardSaleBusy: false }); }
  },

  async onCareCardConfirm() {
    if (this.data.cardSaleBusy || this.data.cardSaleLoading || !this.data.cardSalePreview || this.data.cardSaleError) return;
    const displayed = this.data.cardSalePreview;
    const selected = cards.selections(this.data.cardSaleProducts);
    this._careCardSubmitting = true;
    this.setData({ cardSaleBusy: true });
    try {
      await this.saveCareReceptOrder();
      const orderId = this.data.order.id;
      const saved = await this._cardApi('SaveDraft', { orderId, selections: selected });
      this._hadCareCardDraft = true;
      this.setData({ careCardSelections: selected });
      this._applyCareCardPreview(saved);
      if (cards.signature(saved) !== cards.signature(displayed)) {
        this.setData({ cardSalePreview: cards.displayPreview(saved, this.data.order.cares) });
        wx.showToast({ title: '试算已更新，请重新确认', icon: 'none' }); return;
      }
      this.setData({ cardSaleShow: false });
    } catch (e) {
      this.setData({ cardSaleError: String(e.message || e || '保存选卡失败，请重试') });
    }
    finally { this._careCardSubmitting = false; this.setData({ cardSaleBusy: false }); }
  },

  async _checkoutCareCards() {
    if (this.data.cardSaleBusy || this._careCardSubmitting) return;
    this._careCardSubmitting = true;
    this.setData({ cardSaleBusy: true });
    let submitting = false;
    try {
      await this.saveCareReceptOrder();
      const displayed = this.data.careCardPreview;
      const orderId = this.data.order.id;
      const saved = await this._cardApi('SaveDraft', { orderId, selections: this.data.careCardSelections });
      this._applyCareCardPreview(saved);
      if (saved.canCheckout === false) throw new Error((saved.errors || []).join('；') || '请完整选择养护项目');
      if (!displayed || cards.signature(saved) !== cards.signature(displayed)) {
        this.setData({ cardSaleShow: true, cardSalePreview: cards.displayPreview(saved, this.data.order.cares) });
        wx.showToast({ title: '试算已更新，请重新确认选卡', icon: 'none' });
        // 重新打开选择器，以最新售价和权益再次确认。
        this._careCardSubmitting = false;
        this.setData({ cardSaleBusy: false });
        await this.onAddCareCard(); return;
      }
      submitting = true;
      const result = await this._cardApi('Submit', { orderId });
      this._openCareCardSettlement(result.orderId, result.careOrderId);
    } catch (e) {
      if (submitting) {
        try {
          const draft = await this._cardApi('GetDraft', null, this.data.order.id);
          if (draft.retailOrderId) { this._openCareCardSettlement(draft.retailOrderId, draft.careOrderId); return; }
        } catch (lookupError) { console.warn('recover card sale submission failed', lookupError); }
      }
      const message = String(e.message || e || '下单失败，请重试');
      this.setData({ careCardError: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally { this._careCardSubmitting = false; this.setData({ cardSaleBusy: false }); }
  },

  _openCareCardSettlement(retailOrderId, careOrderId) {
    this.setData({ cardSaleShow: false, careCardSelections: [], careCardPreview: null, careCardError: '', careCardMode: '',
      order: Object.assign({}, this.data.order, { id: 0, code: null, valid: 0, recepting: 1, cares: [], retails: [] }) });
    this._hadCareCardDraft = false;
    wx.navigateTo({ url: '/pages/payment/settle/index?orderId=' + retailOrderId + '&careOrderId=' + careOrderId });
  }
};

module.exports = { initialData, methods };
