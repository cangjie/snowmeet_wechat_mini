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
    bizLabel: {
      type: String,
      value: '',
      // 业务类型变了要重排资产 chip（卡是按当前业务线显示的），
      // 否则会停留在上一个业务的口径上
      observer() { this.rebuildAssetChips(); },
    },
  },

  data: {
    cellMasked: '',
    memberFlagText: '顾客',
    lastLookupCell: '',
    // 服务端原始资产数字，chip 由 rebuildAssetChips 派生
    assetsRaw: null,
    // 资产速览 chip：[{ key, icon, text, cls }]，空数组=不显示
    assetChips: [],
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
        if (this.data.assetsRaw || this.data.lastAssetsMemberId) {
          this.setData({ assetsRaw: null, assetChips: [], lastAssetsMemberId: 0 });
        }
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
        that.setData({ assetsRaw: r });
        that.rebuildAssetChips();
      }).catch(() => {});
    },

    // 把服务端资产数字排成 chip。卡按**当前业务线**显示：养护开单只显示养护卡、租赁开单只显示租赁卡，
    // 否则店员看到「次卡 20 次」（其实是租赁次卡）会以为这单能用。业务类型未知时显示合计。
    // 券不分业务线（券模板的 biz_type 未映射到模型），显示可用总张数。
    rebuildAssetChips() {
      const r = this.data.assetsRaw;
      if (!r) {
        if (this.data.assetChips.length) this.setData({ assetChips: [] });
        return;
      }
      const biz = (this.properties.bizLabel || '').trim();
      let punch = 0;
      let season = 0;
      let cardBizName = '';
      if (biz === '养护') {
        punch = r.carePunchRemaining || 0;
        season = r.careSeasonCount || 0;
        cardBizName = '养护';
      } else if (biz === '租赁') {
        punch = r.rentPunchRemaining || 0;
        season = r.rentSeasonCount || 0;
        cardBizName = '租赁';
      } else {
        punch = r.punchRemaining || 0;
        season = (r.rentSeasonCount || 0) + (r.careSeasonCount || 0);
        cardBizName = '';
      }

      const chips = [];
      if (r.depositTotal > 0) {
        chips.push({ key: 'deposit', icon: 'gold-coin-o', text: '储值 ' + util.showAmount(r.depositTotal), cls: 'tag-deposit' });
      }
      if (r.ticketCount > 0) {
        chips.push({ key: 'ticket', icon: 'coupon-o', text: '券 ' + r.ticketCount + ' 张', cls: 'tag-ticket' });
      }
      if (punch > 0) {
        chips.push({ key: 'punch', icon: 'card', text: cardBizName + '次卡 ' + punch + ' 次', cls: 'tag-punch' });
      }
      if (season > 0) {
        // 季卡不限次数，报张数；1 张时不写数量，读起来更顺
        chips.push({
          key: 'season', icon: 'medal-o',
          text: cardBizName + '季卡' + (season > 1 ? ' ' + season + ' 张' : ''),
          cls: 'tag-season',
        });
      }
      if (r.points > 0) {
        chips.push({ key: 'points', icon: 'diamond-o', text: '龙珠 ' + r.points, cls: 'tag-points' });
      }
      this.setData({ assetChips: chips });
    },

    onMemberDetail() {
      const memberId = this.properties.customer && this.properties.customer.memberId;
      if (!memberId) return;
      this.triggerEvent('memberDetail', { memberId });
    },
  },
});
