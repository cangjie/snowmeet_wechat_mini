// pages/template/stitch/_4/index.js
// 已选装备 - 套餐 / 单品详情录入
// 对应 PRD 2.4.1 租赁开单流程：
//   选择租赁商品 → 选择租赁物（合规）→ 选择租赁形式 → 提交订单 → 支付押金
// 同时承接 2.3 租赁形式：立即租赁 / 先租后取 / 延时租赁
const app = getApp();

const RENT_MODES = [
  { key: 'now',    name: '立即租赁' },
  { key: 'later',  name: '先租后取' },
  { key: 'delay',  name: '延时租赁' },
];

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

// 默认演示数据（首次进入或无购物车时使用，方便走通流程）
function defaultPackages() {
  return [
    {
      id: 'pkg-mid-snowboard-9',
      name: '中级单板9件套',
      kindLabel: '套装',
      mixedDispatch: true,
      rentMode: 'now',
      deposit: '1500.00',
      dailyRate: '299.00',
      startDate: todayStr(),
      startTime: '09:00',
      collapsed: false,
      items: [
        {
          id: 'rentobj-fis-snowboard',
          icon: 'gift-o',
          title: 'FIS 专业级单板',
          spec: '规格：155cm / 全能型',
          itemName: 'FIS 专业级单板',
          code: 'SNW-2023-0045',
          codeFlag: '',
          note: '',
          rentMode: 'now',
          entered: true,
          expanded: true,
        },
        {
          id: 'rentobj-boot-42',
          icon: 'shoe-o',
          title: '高级滑雪鞋',
          spec: '待处理 · 码数: 42',
          itemName: '高级滑雪鞋',
          code: '',
          codeFlag: '',
          note: '',
          rentMode: 'now',
          entered: false,
          expanded: false,
        },
      ],
    },
    {
      id: 'pkg-helmet-goggle',
      name: '专业滑雪头盔 + 护目镜',
      kindLabel: '单品',
      mixedDispatch: false,
      rentMode: 'now',
      deposit: '300.00',
      dailyRate: '50.00',
      startDate: todayStr(),
      startTime: '09:00',
      collapsed: true,
      items: [],
    },
  ];
}

Page({
  data: {
    customer: { name: '张三', cellMasked: '138****8888' },
    groupBy: 'time',
    rentModes: RENT_MODES,
    packages: [],
    summary: { deposit: '0', depositReduce: '0', rent: '0.00' },
  },

  /* ---------- 生命周期 ---------- */
  onLoad() {
    this.hydrate();
  },
  onShow() {
    this.refreshSummary();
  },

  hydrate() {
    const draft = wx.getStorageSync('rent_draft') || {};
    const cell = draft.cell || '13888888888';
    const cart = wx.getStorageSync('rent_cart') || [];
    let packages;
    if (cart.length === 0) {
      packages = defaultPackages();
    } else {
      // 将购物车映射为可编辑包装
      packages = cart.map((c, i) => ({
        id: c.id || ('pkg-' + i),
        name: c.name,
        kindLabel: c.source === 'package' ? '套装' : '单品',
        mixedDispatch: c.source === 'package',
        rentMode: 'now',
        deposit: String(c.deposit || 0),
        dailyRate: String(c.dailyRate || 0),
        startDate: todayStr(),
        startTime: '09:00',
        collapsed: i !== 0,
        items: [],
      }));
    }
    this.setData({
      customer: {
        name: draft.name || '张三',
        cellMasked: cell ? cell.slice(0, 3) + '****' + cell.slice(7) : '未提供',
      },
      packages,
    });
    this.refreshSummary();
  },

  /* ---------- 汇总 ---------- */
  refreshSummary() {
    let deposit = 0;
    let rent = 0;
    this.data.packages.forEach((p) => {
      deposit += Number(p.deposit) || 0;
      rent += Number(p.dailyRate) || 0;
    });
    this.setData({
      summary: {
        deposit: deposit.toLocaleString('en-US'),
        depositReduce: '500',  // 演示：押金减免 500
        rent: rent.toFixed(2),
      },
    });
  },

  /* ---------- 套餐级 ---------- */
  onTogglePkg(e) {
    const idx = e.currentTarget.dataset.idx;
    const key = `packages[${idx}].collapsed`;
    this.setData({ [key]: !this.data.packages[idx].collapsed });
  },
  onPkgModeTap(e) {
    const { pkg, mode } = e.currentTarget.dataset;
    const key = `packages[${pkg}].rentMode`;
    this.setData({ [key]: mode });
  },
  onPkgFieldInput(e) {
    const { pkg, field } = e.currentTarget.dataset;
    const key = `packages[${pkg}].${field}`;
    this.setData({ [key]: e.detail.value });
    this.refreshSummary();
  },
  onPkgDateChange(e) {
    const idx = e.currentTarget.dataset.pkg;
    this.setData({ [`packages[${idx}].startDate`]: e.detail.value });
  },
  onPkgTimeChange(e) {
    const idx = e.currentTarget.dataset.pkg;
    this.setData({ [`packages[${idx}].startTime`]: e.detail.value });
  },

  /* ---------- 单品级 ---------- */
  onToggleItem(e) {
    const { pkg, item } = e.currentTarget.dataset;
    const key = `packages[${pkg}].items[${item}].expanded`;
    const cur = this.data.packages[pkg].items[item].expanded;
    this.setData({ [key]: !cur });
  },
  onItemFieldInput(e) {
    const { pkg, item, field } = e.currentTarget.dataset;
    const key = `packages[${pkg}].items[${item}].${field}`;
    this.setData({ [key]: e.detail.value });
    if (field === 'code' && e.detail.value) {
      this.setData({ [`packages[${pkg}].items[${item}].entered`]: true });
    }
  },
  onItemCodeFlag(e) {
    const { pkg, item, flag } = e.currentTarget.dataset;
    const cur = this.data.packages[pkg].items[item].codeFlag;
    this.setData({
      [`packages[${pkg}].items[${item}].codeFlag`]: cur === flag ? '' : flag,
      [`packages[${pkg}].items[${item}].entered`]: cur !== flag,
    });
  },
  onItemModeTap(e) {
    const { pkg, item, mode } = e.currentTarget.dataset;
    this.setData({ [`packages[${pkg}].items[${item}].rentMode`]: mode });
  },
  onItemScan(e) {
    const { pkg, item } = e.currentTarget.dataset;
    wx.scanCode({
      success: (res) => {
        const code = res.result || '';
        this.setData({
          [`packages[${pkg}].items[${item}].code`]: code,
          [`packages[${pkg}].items[${item}].entered`]: true,
        });
      },
    });
  },

  /* ---------- 通用 ---------- */
  onGroupChange(e) {
    this.setData({ groupBy: e.currentTarget.dataset.value });
  },
  onMemberDetail() {
    wx.showToast({ title: '会员详情（待实现）', icon: 'none' });
  },
  onAddPackage() {
    wx.navigateTo({ url: '/pages/template/stitch/_3/index' });
  },
  onScan() {
    wx.scanCode({
      success: (res) => wx.showToast({ title: '扫码：' + (res.result || '').slice(0, 12), icon: 'none' }),
    });
  },
  onSearchItem() { wx.showToast({ title: '搜索单品（待实现）', icon: 'none' }); },
  onNoCode() { wx.showToast({ title: '无码物品（待实现）', icon: 'none' }); },
  onCheckout() {
    // 校验 PRD 2.4.1：所有租赁物已选合规 + 已选租赁形式
    const allEntered = this.data.packages.every((p) =>
      p.items.length === 0 || p.items.every((i) => i.entered)
    );
    if (!allEntered) {
      wx.showModal({
        title: '存在未录入装备',
        content: '部分租赁物尚未完成编码 / 状态确认，仍要前往支付吗？',
        success: (res) => res.confirm && wx.navigateTo({ url: '/pages/template/stitch/_5/index' }),
      });
      return;
    }
    // 暂存订单要点供支付页使用
    wx.setStorageSync('rent_pending_order', {
      packages: this.data.packages,
      summary: this.data.summary,
      createdAt: Date.now(),
    });
    wx.navigateTo({ url: '/pages/template/stitch/_5/index' });
  },
  onBack() { wx.navigateBack({ delta: 1 }); },
});
