// components/reception/reception_member_bar/reception_member_bar.js
// 业务开单 / 接待页顶部的顾客信息条
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');

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
        this.syncAssets();
      },
    },
    shop: { type: String, value: '' },
    bizLabel: { type: String, value: '' },
  },

  data: {
    cellMasked: '',
    memberFlagText: '顾客',
    lastLookupCell: '',
    // 会员资产速览（有则显示）：{ depositStr, punchRemaining, points }
    assets: null,
    lastAssetsMemberId: 0,
  },

  lifetimes: {
    attached() {
      this.refreshMask();
      this.lookupMemberByCell();
      this.syncAssets();
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
        this._loadAssets(memberId);
        this.triggerEvent('memberInfoFound', {
          memberId,
          member,
        });
      }).catch(() => {
        this.setData({ memberFlagText: customer.memberId ? '会员' : '顾客' });
      });
    },

    // customer.memberId 变化时同步资产速览
    syncAssets() {
      const memberId = this.properties.customer && this.properties.customer.memberId;
      if (!memberId) {
        if (this.data.assets || this.data.lastAssetsMemberId) this.setData({ assets: null, lastAssetsMemberId: 0 });
        return;
      }
      this._loadAssets(memberId);
    },

    _loadAssets(memberId) {
      const that = this;
      if (!memberId || memberId === that.data.lastAssetsMemberId) return;
      that.setData({ lastAssetsMemberId: memberId });
      const app = getApp();
      Promise.resolve(app.loginPromiseNew).then(() => {
        return data.getMemberAssetsByStaffPromise(memberId, app.globalData.sessionKey);
      }).then((r) => {
        if (!r || that.data.lastAssetsMemberId !== memberId) return;
        that.setData({
          assets: {
            depositStr: (r.depositTotal > 0) ? util.showAmount(r.depositTotal) : '',
            punchRemaining: r.punchRemaining || 0,
            points: r.points || 0,
          },
        });
      }).catch(() => {});
    },

    onMemberDetail() {
      const memberId = this.properties.customer && this.properties.customer.memberId;
      if (!memberId) return;
      this.triggerEvent('memberDetail', { memberId });
    },
  },
});
