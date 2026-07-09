// components/reception/ticket_card_selector/ticket_card_selector.js
// 养护开单「优惠券 / 会员卡」双 tab 选择弹层（自带 van-popup）
// - 优惠券 tab：列 code / 名称 / 到期日 / 来源(create_memo)，单选 + 「不使用优惠券」
//   事件契约与旧 ticket_list 一致：triggerEvent('Event', {action:'cancel'})
//   / {action:'confirm', selectedTicket}（selectedTicket=null 表示清除所选券）
// - 会员卡 tab：纯展示不可选。卡名含「季卡」显示上次使用时间，其余按次卡显示已用/剩余
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
    disabledCodes: { type: Array, value: [] },
  },
  data: {
    activeTab: 'ticket', // ticket | card
    ticketsLoading: false,
    cardsLoading: false,
    tickets: [],
    cards: [],
    pickedCode: null,    // 当前选中券 code
    pickedNone: false,   // 选中「不使用优惠券」
  },
  methods: {
    _load() {
      const that = this;
      const memberId = this.data.memberId;
      this.setData({
        activeTab: 'ticket',
        pickedCode: this.data.selectedCode || null,
        pickedNone: false,
        tickets: [],
        cards: [],
        ticketsLoading: !!memberId,
        cardsLoading: !!memberId,
      });
      if (!memberId) return;
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
      data.getMemberCardsPromise(memberId, app.globalData.sessionKey)
        .then((cards) => {
          const list = (cards || []).map((c) => Object.assign(c, {
            _isSeason: (c.card_name || '').indexOf('季卡') >= 0,
            _lastUsed: fmtDateTime(c.lastUsedDate) || '未使用',
          }));
          that.setData({ cards: list, cardsLoading: false });
        })
        .catch(() => that.setData({ cardsLoading: false }));
    },
    onTabTap(e) {
      this.setData({ activeTab: e.currentTarget.dataset.tab });
    },
    onTicketTap(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      const t = this.data.tickets[idx];
      if (!t || t._disabled) return;
      this.setData({ pickedCode: t.code, pickedNone: false });
    },
    onNoneTap() {
      this.setData({ pickedCode: null, pickedNone: true });
    },
    onClose() {
      this.triggerEvent('Event', { action: 'cancel' });
    },
    onConfirm() {
      if (this.data.pickedNone) {
        this.triggerEvent('Event', { action: 'confirm', selectedTicket: null });
        return;
      }
      const code = this.data.pickedCode;
      if (!code) {
        // 没做任何选择，等同取消
        this.triggerEvent('Event', { action: 'cancel' });
        return;
      }
      const ticket = this.data.tickets.filter((t) => t.code === code)[0] || null;
      this.triggerEvent('Event', { action: 'confirm', selectedTicket: ticket });
    },
  },
});
