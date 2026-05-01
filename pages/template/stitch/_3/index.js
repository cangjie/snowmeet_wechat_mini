// pages/template/stitch/_3/index.js
// 选择套餐
// 对应 PRD 2.4.5 租赁物分类 / 套餐：分类筛选 + 多选 + 数量步进
const app = getApp();

const ALL_PACKAGES = [
  {
    id: 'pkg-mid-snowboard-9',
    name: '中级单板9件套',
    cat: 'snowboard',
    description: '包含中级单板、雪鞋、头盔、雪镜、护具套装（护臀、护膝、护腕）、雪服套装',
    weekdayPrice: 299,
    weekendPrice: 359,
    memberPrice: 259,
    deposit: 1500,
    qty: 0,
  },
  {
    id: 'pkg-junior-ski-5',
    name: '初级双板5件套',
    cat: 'ski',
    description: '包含初级双板、雪鞋、雪杖、头盔、雪镜',
    weekdayPrice: 199,
    weekendPrice: 249,
    memberPrice: 169,
    deposit: 1000,
    qty: 0,
  },
  {
    id: 'pkg-pro-alpine',
    name: '专业高山速降套装',
    cat: 'ski',
    description: '包含高级竞技双板、专业雪鞋、碳纤维雪杖、竞技头盔、全天候雪镜',
    weekdayPrice: 499,
    weekendPrice: 599,
    memberPrice: 459,
    deposit: 2500,
    qty: 0,
  },
  {
    id: 'pkg-protective-set',
    name: '专业护具套装',
    cat: 'protective',
    description: '护臀、护膝、护腕、护肘、雪盔',
    weekdayPrice: 89,
    weekendPrice: 109,
    memberPrice: 69,
    deposit: 300,
    qty: 0,
  },
];

const CATEGORIES = [
  { key: 'all',        name: '全部' },
  { key: 'ski',        name: '双板' },
  { key: 'snowboard',  name: '单板' },
  { key: 'protective', name: '护具' },
];

Page({
  data: {
    categories: CATEGORIES,
    activeCat: 'all',
    packages: ALL_PACKAGES,
    visiblePackages: ALL_PACKAGES,
    selectedTypes: 0,
    selectedQty: 0,
    selectedAmount: 0,
  },

  onLoad() {
    // 进入页面时优先以"中级单板9件套"作为示意预选
    const packages = this.data.packages.map((p) =>
      p.id === 'pkg-mid-snowboard-9' ? { ...p, qty: 1 } : p
    );
    this.setData({ packages });
    this.applyFilters();
  },

  onCatTap(e) {
    this.setData({ activeCat: e.currentTarget.dataset.key }, () => this.applyFilters());
  },

  applyFilters() {
    const { activeCat, packages } = this.data;
    const visiblePackages = activeCat === 'all'
      ? packages
      : packages.filter((p) => p.cat === activeCat);
    this.setData({ visiblePackages });
    this.refreshSummary();
  },

  onTogglePackage(e) {
    const id = e.currentTarget.dataset.id;
    const packages = this.data.packages.map((p) =>
      p.id === id ? { ...p, qty: p.qty > 0 ? 0 : 1 } : p
    );
    this.setData({ packages }, () => this.applyFilters());
  },
  onPlus(e) {
    const id = e.currentTarget.dataset.id;
    const packages = this.data.packages.map((p) =>
      p.id === id ? { ...p, qty: p.qty + 1 } : p
    );
    this.setData({ packages }, () => this.applyFilters());
  },
  onMinus(e) {
    const id = e.currentTarget.dataset.id;
    const packages = this.data.packages.map((p) =>
      p.id === id ? { ...p, qty: Math.max(0, p.qty - 1) } : p
    );
    this.setData({ packages }, () => this.applyFilters());
  },

  refreshSummary() {
    let types = 0;
    let qty = 0;
    let amount = 0;
    this.data.packages.forEach((p) => {
      if (p.qty > 0) types += 1;
      qty += p.qty;
      amount += p.qty * p.memberPrice;
    });
    this.setData({ selectedTypes: types, selectedQty: qty, selectedAmount: amount });
  },

  onClose() { wx.navigateBack({ delta: 1 }); },

  onConfirm() {
    if (this.data.selectedQty === 0) {
      wx.showToast({ title: '请先选择套餐', icon: 'none' });
      return;
    }
    const cart = wx.getStorageSync('rent_cart') || [];
    this.data.packages.filter((p) => p.qty > 0).forEach((p) => {
      // 简化合并：同 id 累加
      const existing = cart.find((c) => c.id === p.id);
      if (existing) {
        existing.qty += p.qty;
      } else {
        cart.push({
          id: p.id,
          name: p.name,
          deposit: p.deposit,
          dailyRate: p.memberPrice,
          qty: p.qty,
          source: 'package',
        });
      }
    });
    wx.setStorageSync('rent_cart', cart);
    wx.redirectTo({ url: '/pages/template/stitch/_4/index' });
  },
});
