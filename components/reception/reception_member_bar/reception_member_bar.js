// components/reception/reception_member_bar/reception_member_bar.js
// 业务开单 / 接待页顶部的顾客信息条

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
      observer() { this.refreshMask(); },
    },
    shop: { type: String, value: '' },
    bizLabel: { type: String, value: '' },
  },

  data: {
    cellMasked: '',
  },

  lifetimes: {
    attached() { this.refreshMask(); },
  },

  methods: {
    refreshMask() {
      const cell = (this.properties.customer && this.properties.customer.cell) || '';
      const masked = cell && cell.length === 11
        ? cell.slice(0, 3) + '****' + cell.slice(7)
        : (cell || '');
      this.setData({ cellMasked: masked });
    },

    onMemberDetail() {
      const memberId = this.properties.customer && this.properties.customer.memberId;
      if (!memberId) return;
      this.triggerEvent('memberDetail', { memberId });
    },
  },
});
