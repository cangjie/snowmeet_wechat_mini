// pages/template/stitch/_2/index.js
// 租赁开单 - 租赁购物车 / 添加入口
// 对应 PRD 2.4.1（开单）+ 2.4.5（套餐 / 租赁物来源）+ 2.4.6（查询）。
// 设计要求：
//   - 顶部展示客户信息（来自 _1 页的草稿）
//   - 中部分组方式：按时间 / 按品种
//   - 底部 4 个快捷入口：添加套餐 / 扫描条码 / 搜索单品 / 无码物品
//   - 押金合计 + 去结算
const app = getApp();

Page({
  data: {
    customer: { name: '散客', cell: '', cellMasked: '' },
    groupBy: 'time',
    packages: [],          // 已加入购物车的套餐 / 单品
    summary: { deposit: '0', depositReduce: '0', rent: '0.00' },
  },

  /* ---------- 生命周期 ---------- */
  onLoad() {
    this.hydrateFromDraft();
  },
  onShow() {
    this.hydrateFromDraft();   // 从子页面返回时刷新
    this.refreshSummary();
  },

  /* ---------- 数据 ---------- */
  hydrateFromDraft() {
    const draft = wx.getStorageSync('rent_draft') || {};
    const cell = draft.cell || '';
    this.setData({
      customer: {
        name: draft.name || '散客',
        cell,
        cellMasked: cell ? cell.slice(0, 3) + '****' + cell.slice(7) : '未提供',
      },
      packages: wx.getStorageSync('rent_cart') || [],
    });
  },

  refreshSummary() {
    const items = this.data.packages || [];
    let deposit = 0;
    let rent = 0;
    items.forEach((p) => {
      deposit += Number(p.deposit) || 0;
      rent += Number(p.dailyRate) || 0;
    });
    this.setData({
      summary: {
        deposit: deposit.toLocaleString('en-US'),
        depositReduce: '0',
        rent: rent.toFixed(2),
      },
    });
  },

  /* ---------- 交互 ---------- */
  onGroupChange(e) {
    this.setData({ groupBy: e.currentTarget.dataset.value });
  },
  onMemberDetail() {
    wx.showToast({ title: '会员详情（待实现）', icon: 'none' });
  },
  onAddPackage() {
    wx.navigateTo({ url: '/pages/template/stitch/_3/index' });
  },
  onScanCode() {
    wx.scanCode({
      success: (res) => {
        wx.showToast({ title: '扫码：' + (res.result || '').slice(0, 12), icon: 'none' });
      },
    });
  },
  onSearchItem() {
    wx.showToast({ title: '搜索单品（待实现）', icon: 'none' });
  },
  onNoCodeItem() {
    wx.showToast({ title: '无码物品（待实现）', icon: 'none' });
  },
  onOpenPackage(e) {
    wx.navigateTo({
      url: '/pages/template/stitch/_4/index?id=' + e.currentTarget.dataset.id,
    });
  },
  onCheckout() {
    if ((this.data.packages || []).length === 0) {
      // 仍允许进入"已选装备"页查看流程；演示数据由 _4 页内置
      wx.navigateTo({ url: '/pages/template/stitch/_4/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/template/stitch/_5/index' });
  },
  onBack() { wx.navigateBack({ delta: 1 }); },
});
