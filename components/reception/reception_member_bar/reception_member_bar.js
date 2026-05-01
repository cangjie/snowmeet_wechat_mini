// components/reception/reception_member_bar/reception_member_bar.js
// 业务开单 / 接待页顶部的顾客信息条
const data = require('../../../utils/data.js');

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  properties: {
    /**
     * customer: { memberId, name, cell, gender }
     * 父页只需要把对象塞进来，组件内部负责手机号脱敏
     */
    customer: {
      type: Object,
      value: {},
      observer() {
        this.refreshMask();
        this.lookupMemberByCell();
      },
    },
    shop: { type: String, value: '' },
    bizLabel: { type: String, value: '' },
  },

  data: {
    cellMasked: '',
    memberFlagText: '顾客',
    lastLookupCell: '',
  },

  lifetimes: {
    attached() {
      this.refreshMask();
      this.lookupMemberByCell();
    },
  },

  methods: {
    refreshMask() {
      const cell = (this.properties.customer && this.properties.customer.cell) || '';
      const masked = cell && cell.length === 11
        ? cell.slice(0, 3) + '****' + cell.slice(7)
        : (cell || '');
      const memberId = this.properties.customer && this.properties.customer.memberId;
      this.setData({
        cellMasked: masked,
        memberFlagText: memberId ? '会员' : '顾客',
      });
    },

    lookupMemberByCell() {
      const customer = this.properties.customer || {};
      const cellRaw = (customer.cell || '').trim();
      const cell = cellRaw.replace(/[\s\-()]/g, '');

      if (!cell) {
        this.setData({ lastLookupCell: '', memberFlagText: customer.memberId ? '会员' : '顾客' });
        return;
      }
      if (cell === this.data.lastLookupCell) {
        return;
      }

      this.setData({ lastLookupCell: cell });
      data.getMemberByNumPromise(cell).then((member) => {
        const memberId = member && (member.id || member.member_id || member.memberId);
        if (!memberId) {
          this.setData({ memberFlagText: customer.memberId ? '会员' : '顾客' });
          return;
        }

        this.setData({ memberFlagText: '会员' });
        this.triggerEvent('memberInfoFound', {
          memberId,
          member,
        });
      }).catch(() => {
        this.setData({ memberFlagText: customer.memberId ? '会员' : '顾客' });
      });
    },

    onMemberDetail() {
      const memberId = this.properties.customer && this.properties.customer.memberId;
      if (!memberId) return;
      this.triggerEvent('memberDetail', { memberId });
    },
  },
});
