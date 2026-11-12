// components/reception/ticket_card_selector/ticket_card_selector.js
// 养护开单「优惠券 / 会员卡」双 tab 选择弹层（自带 van-popup）
// - 优惠券 tab：列 code / 名称 / 到期日 / 来源(create_memo)
// - 会员卡 tab：卡名含「季卡」显示上次使用时间，其余按次卡显示已用/剩余
// - 全局单选：券与券、卡与卡、券与卡互斥，外加「不使用」；确认时三者最多一个非空
//   学员卡（2026-10-30）：「会员卡」标签里并入某某教练的学员卡（chip「教练」），数据来自 CoachCard/ListUsableCards，
//   条目显示本单预计优惠；与券、次卡、季卡同样单选互斥。租赁开单页传 coachOnly，弹层里只列学员卡。
//   事件契约：triggerEvent('Event', {action:'cancel'})
//   / {action:'confirm', selectedTicket, selectedCard, selectedCoachCard}（都为 null 表示清除所选；selectedCoachCard 仅选学员卡时有值）
const app = getApp();
const util = require('../../../utils/util.js');
const data = require('../../../utils/data.js');

function fmtDateTime(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
      observer(v) {
        // nextTick：等同批 setData 的 selectedCode/disabledCodes 先落到 properties 再加载
        if (v) wx.nextTick(() => this._load());
      },
    },
    ticketType: { type: String, value: '养护' },
    memberId: { type: Number, value: 0 },
    selectedCode: { type: String, value: null },
    selectedCardId: { type: null, value: null },
    disabledCodes: { type: Array, value: [] },
    // 学员卡：已选的卡 id；本单的门店 / 档位（单项、双项）/ 该件服务费 / 单双项基础价（不含加急）/ 租赁金额，用来算预计优惠
    selectedCoachCardId: { type: null, value: null },
    shop: { type: String, value: '' },
    tier: { type: String, value: '' },
    commonCharge: { type: Number, value: 0 },
    basePrice: { type: Number, value: 0 },
    urgent: { type: Number, value: 0 },
    rentalAmount: { type: Number, value: 0 },
    // 只列学员卡（租赁开单页用）
    coachOnly: { type: Boolean, value: false },
  },
  data: {
    activeTab: 'ticket', // ticket | card
    ticketsLoading: false,
    cardsLoading: false,
    tickets: [],
    cards: [],
    pickedCode: null,    // 当前选中券 code（与 pickedCardId/pickedNone 互斥）
    pickedCardId: null,  // 当前选中卡 id
    pickedNone: false,   // 选中「不使用」
    coachCards: [],      // 该会员可用的学员卡（含本单预计优惠）
    coachLoading: false,
    pickedCoachCardId: null, // 当前选中学员卡 id（与 pickedCode/pickedCardId/pickedNone 互斥）
  },
  methods: {
    _load() {
      const that = this;
      const memberId = this.data.memberId;
      const coachPicked = this.data.selectedCoachCardId || null;
      const coachOnly = !!this.data.coachOnly;
      this.setData({
        activeTab: (this.data.selectedCardId || coachPicked || coachOnly) ? 'card' : 'ticket',
        pickedCode: (this.data.selectedCardId || coachPicked) ? null : (this.data.selectedCode || null),
        pickedCardId: coachPicked ? null : (this.data.selectedCardId || null),
        pickedCoachCardId: coachPicked,
        pickedNone: false,
        tickets: [],
        cards: [],
        coachCards: [],
        ticketsLoading: !!memberId && !coachOnly,
        cardsLoading: !!memberId && !coachOnly,
        coachLoading: !!memberId,
      });
      if (!memberId) return;
      this._loadCoachCards(memberId);
      if (coachOnly) return;
      data.getMemberTicketsPromise(memberId, this.data.ticketType, true, app.globalData.sessionKey)
        .then((tickets) => {
          const disabled = that.data.disabledCodes || [];
          const list = (tickets || []).map((t) => {
            let expire = t.expire_date ? util.formatDate(new Date(t.expire_date)) : '--';
            if (expire === '9999-12-31') expire = '--';
            return Object.assign(t, {
              _expire: expire,
              _memo: (t.create_memo || '').trim(),
              _disabled: disabled.indexOf(t.code) >= 0,
            });
          });
          that.setData({ tickets: list, ticketsLoading: false });
        })
        .catch(() => that.setData({ ticketsLoading: false }));
      // 只列本业务线的卡（养护开单不显示租赁次卡），ticketType 与券的 bizType 同值复用
      data.getMemberCardsPromise(memberId, this.data.ticketType, app.globalData.sessionKey)
        .then((cards) => {
          // 季卡判定以数据为准：total=NULL 即不限次数季卡（2026-07-09 起）；卡名含「季卡」作旧数据兜底
          const list = (cards || []).map((c) => Object.assign(c, {
            _isSeason: !!(c.isSeason || c.total == null || (c.card_name || '').indexOf('季卡') >= 0),
            _lastUsed: fmtDateTime(c.lastUsedDate) || '未使用',
            // 限装备季卡：显示绑定装备一行（品牌按 / 前段显示，与表单一致）
            _equipDisp: c.equipBound
              ? [c.equip_type, String(c.equip_brand || '').split('/')[0], c.equip_scale + 'cm'].join(' · ')
              : null,
          }));
          that.setData({ cards: list, cardsLoading: false });
        })
        .catch(() => that.setData({ cardsLoading: false }));
    },
    // 学员卡：按本单的门店 / 档位 / 金额算预计优惠；接口失败不影响券和次卡的选择
    _loadCoachCards(memberId) {
      const that = this;
      const d = this.data;
      data.listUsableCoachCardsPromise(memberId, d.ticketType, {
        shop: d.shop, tier: d.tier, commonCharge: d.commonCharge, basePrice: d.basePrice, rentalAmount: d.rentalAmount, urgent: d.urgent,
      }, app.globalData.sessionKey).then((res) => {
        const list = ((res && res.cards) || []).map((c) => Object.assign({}, c, {
          _until: c.validUntil ? util.formatDate(new Date(c.validUntil)) : '--',
        }));
        that.setData({ coachCards: list, coachLoading: false });
      }).catch(() => that.setData({ coachLoading: false }));
    },
    onCoachCardTap(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      const c = this.data.coachCards[idx];
      if (!c) return;
      // 这张卡在本单的门店 / 档位没有优惠：说明原因，不让选（选了也不会优惠，还会挤掉券）
      if (!c.applicable) {
        wx.showToast({ title: '这张学员卡在本单没有优惠', icon: 'none' });
        return;
      }
      this.setData({ pickedCoachCardId: c.cardId, pickedCode: null, pickedCardId: null, pickedNone: false });
    },
    onTabTap(e) {
      this.setData({ activeTab: e.currentTarget.dataset.tab });
    },
    onTicketTap(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      const t = this.data.tickets[idx];
      if (!t || t._disabled) return;
      this.setData({ pickedCode: t.code, pickedCardId: null, pickedCoachCardId: null, pickedNone: false });
    },
    onCardTap(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      const c = this.data.cards[idx];
      if (!c) return;
      // 季卡每天限用一次：今天已核销过的直接拦下并说明原因，
      // 只置灰不给反馈的话店员会以为是点击没生效、反复戳
      if (c.usedToday) {
        wx.showToast({ title: '该季卡今天已使用过，每天限一次', icon: 'none' });
        return;
      }
      this.setData({ pickedCardId: c.id, pickedCode: null, pickedCoachCardId: null, pickedNone: false });
    },
    onNoneTap() {
      this.setData({ pickedCode: null, pickedCardId: null, pickedCoachCardId: null, pickedNone: true });
    },
    onClose() {
      this.triggerEvent('Event', { action: 'cancel' });
    },
    onConfirm() {
      if (this.data.pickedNone) {
        this.triggerEvent('Event', { action: 'confirm', selectedTicket: null, selectedCard: null });
        return;
      }
      if (this.data.pickedCode) {
        const code = this.data.pickedCode;
        const ticket = this.data.tickets.filter((t) => t.code === code)[0] || null;
        this.triggerEvent('Event', { action: 'confirm', selectedTicket: ticket, selectedCard: null });
        return;
      }
      if (this.data.pickedCoachCardId) {
        const coachCard = this.data.coachCards.filter((c) => c.cardId === this.data.pickedCoachCardId)[0] || null;
        this.triggerEvent('Event', { action: 'confirm', selectedTicket: null, selectedCard: null, selectedCoachCard: coachCard });
        return;
      }
      if (this.data.pickedCardId) {
        const card = this.data.cards.filter((c) => c.id === this.data.pickedCardId)[0] || null;
        this.triggerEvent('Event', { action: 'confirm', selectedTicket: null, selectedCard: card });
        return;
      }
      // 没做任何选择，等同取消
      this.triggerEvent('Event', { action: 'cancel' });
    },
  },
});
