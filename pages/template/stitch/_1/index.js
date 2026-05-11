// pages/template/stitch/_1/index.js
// 开始开单（现场开单流程入口）
// 对应 PRD 1.4.5 现场开单流程：
//   第一步：获取订单标识信息（姓名 / 手机号非必填）
//   输入手机号后系统自动触发会员查询（仅显示基础信息，不影响开单）
//   第二步：选择业务类型 → 进入对应业务开单
const app = getApp();

Page({
  data: {
    currentShop: '雪遇崇礼万龙店',
    customerName: '',
    gender: '',
    customerCell: '',
    matchedMember: null,   // 命中会员则填充：{ id, name, hasWechat, hasAlipay }
    cellLooked: false,     // 是否已经按手机号查询过
    bizType: 'rent',       // 默认选中租赁
  },

  /* ---------- 表单输入 ---------- */
  onNameInput(e) {
    this.setData({ customerName: e.detail.value });
  },
  onGenderTap(e) {
    this.setData({ gender: e.currentTarget.dataset.value });
  },
  onCellInput(e) {
    const cell = e.detail.value;
    this.setData({ customerCell: cell });
    if (cell.length !== 11) {
      // 重置查询状态，避免显示过期的会员卡
      if (this.data.matchedMember || this.data.cellLooked) {
        this.setData({ matchedMember: null, cellLooked: false });
      }
    }
  },
  onCellBlur(e) {
    const cell = e.detail.value;
    if (cell && cell.length === 11) {
      this.lookupMember(cell);
    }
  },

  /* ---------- 输入手机号后自动会员查询 ---------- */
  lookupMember(cell) {
    // TODO: 替换为真实接口
    // util.performWebRequest(app.globalData.requestPrefix + 'Member/QueryByCell?cell=' + cell, null)
    //   .then(res => this.setData({ matchedMember: res || null, cellLooked: true }))
    //   .catch(() => this.setData({ matchedMember: null, cellLooked: true }));
    // mock：以 138 开头视为已注册会员
    const isMember = /^138\d{8}$/.test(cell);
    this.setData({
      matchedMember: isMember ? { id: 'M0042189', name: '张三', hasWechat: true, hasAlipay: false } : null,
      cellLooked: true,
    });
  },

  /* ---------- 业务类型 ---------- */
  onBizTap(e) {
    this.setData({ bizType: e.currentTarget.dataset.type });
  },

  /* ---------- 进入开单 ---------- */
  onStartTap() {
    if (!this.data.bizType) {
      wx.showToast({ title: '请选择业务类型', icon: 'none' });
      return;
    }
    // 暂存订单标识信息（PRD：开单中断可凭手机号 / 姓名 / 订单号找回）
    const draft = {
      shop: this.data.currentShop,
      name: this.data.customerName,
      gender: this.data.gender,
      cell: this.data.customerCell,
      matchedMemberId: this.data.matchedMember ? this.data.matchedMember.id : '',
      bizType: this.data.bizType,
      createdAt: Date.now(),
    };
    wx.setStorageSync('rent_draft', draft);

    if (this.data.bizType === 'rent') {
      wx.navigateTo({ url: '/pages/template/stitch/_2/index' });
    } else if (this.data.bizType === 'maintain') {
      wx.showToast({ title: '养护开单（待实现）', icon: 'none' });
    } else if (this.data.bizType === 'retail') {
      wx.showToast({ title: '零售开单（待实现）', icon: 'none' });
    }
  },

  /* ---------- 其他交互 ---------- */
  onPickShop() {
    wx.showActionSheet({
      itemList: ['雪遇崇礼万龙店', '雪遇崇礼云顶店', '雪遇北京南山店'],
      success: (res) => {
        const shops = ['雪遇崇礼万龙店', '雪遇崇礼云顶店', '雪遇北京南山店'];
        this.setData({ currentShop: shops[res.tapIndex] });
      },
    });
  },
  onShopTap() { this.onPickShop(); },
  onScanTap() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        wx.showToast({ title: '已扫码：' + (res.result || '').slice(0, 16), icon: 'none' });
      },
    });
  },
  onRecoverOrder() {
    wx.showToast({ title: '订单找回（待实现）', icon: 'none' });
  },
  onTabTap(e) {
    wx.showToast({ title: '切换：' + e.currentTarget.dataset.tab, icon: 'none' });
  },

  /* ---------- 生命周期 ---------- */
  onLoad() {},
  onShow() {},
});
