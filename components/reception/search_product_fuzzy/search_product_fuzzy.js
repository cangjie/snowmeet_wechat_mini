const data = require('../../../utils/data.js');

Component({
  properties: {
    show: { type: Boolean, value: false },
    categoryId: { type: null, value: null },
    categoryName: { type: String, value: '' },
  },

  data: {
    keyword: '',
    products: [],            // 原始搜索结果（不含筛选）
    displayProducts: [],     // 经品类筛选后渲染用列表
    categoryFilters: [],     // 结果集去重的品类列表 [{ id, name, count }]
    activeFilterCatId: null, // null = 「全部」
    selectedIndex: -1,       // displayProducts 里的索引
    hasSearched: false,
    loading: false,
  },

  observers: {
    'show': function (show) {
      if (show) {
        this.setData({
          keyword: '',
          products: [],
          displayProducts: [],
          categoryFilters: [],
          activeFilterCatId: null,
          selectedIndex: -1,
          hasSearched: false,
          loading: false,
        });
      }
    },
  },

  methods: {
    onInput(e) {
      this.setData({ keyword: e.detail.value });
    },
    onSearch() {
      const key = String(this.data.keyword || '').trim();
      if (!key) {
        wx.showToast({ title: '请输入搜索关键词', icon: 'none' });
        return;
      }
      this.setData({ loading: true });
      data.searchBarCodeFuzzyPromise(key, this.data.categoryId || null)
        .then(products => {
          const list = Array.isArray(products) ? products : [];
          // 派生品类筛选项：按 category.id 去重 + 计数
          const map = new Map();
          list.forEach(p => {
            const cat = p && p.category;
            if (!cat || cat.id == null) return;
            const cur = map.get(cat.id);
            if (cur) cur.count += 1;
            else map.set(cat.id, { id: cat.id, name: cat.name || '', count: 1 });
          });
          const filters = Array.from(map.values());
          this.setData({
            products: list,
            displayProducts: list,
            categoryFilters: filters,
            activeFilterCatId: null,
            selectedIndex: list.length === 1 ? 0 : -1,
            hasSearched: true,
            loading: false,
          });
        })
        .catch(() => {
          this.setData({
            products: [],
            displayProducts: [],
            categoryFilters: [],
            activeFilterCatId: null,
            selectedIndex: -1,
            hasSearched: true,
            loading: false,
          });
          wx.showToast({ title: '搜索失败', icon: 'none' });
        });
    },
    onFilterTap(e) {
      const raw = e.currentTarget.dataset.cid;
      const next = (raw === '' || raw == null) ? null : Number(raw);
      if (next === this.data.activeFilterCatId) return;
      const filtered = next == null
        ? this.data.products
        : this.data.products.filter(p => p && p.category && p.category.id === next);
      this.setData({
        activeFilterCatId: next,
        displayProducts: filtered,
        selectedIndex: filtered.length === 1 ? 0 : -1,
      });
    },
    onSelect(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      this.setData({ selectedIndex: idx });
    },
    onConfirm() {
      const idx = this.data.selectedIndex;
      const product = idx >= 0 ? this.data.displayProducts[idx] : null;
      if (!product) {
        wx.showToast({ title: '请选择一个租赁物', icon: 'none' });
        return;
      }
      this.triggerEvent('select', { product });
    },
    onClose() {
      this.triggerEvent('close');
    },
  },
});
