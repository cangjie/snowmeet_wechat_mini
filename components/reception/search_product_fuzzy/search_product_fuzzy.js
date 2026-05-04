const data = require('../../../utils/data.js');

Component({
  properties: {
    show: { type: Boolean, value: false },
    categoryId: { type: null, value: null },
    categoryName: { type: String, value: '' },
  },

  data: {
    keyword: '',
    products: [],
    selectedIndex: -1,
    hasSearched: false,
    loading: false,
  },

  observers: {
    'show': function (show) {
      if (show) {
        this.setData({ keyword: '', products: [], selectedIndex: -1, hasSearched: false, loading: false });
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
          this.setData({
            products: list,
            selectedIndex: list.length === 1 ? 0 : -1,
            hasSearched: true,
            loading: false,
          });
        })
        .catch(() => {
          this.setData({ products: [], selectedIndex: -1, hasSearched: true, loading: false });
          wx.showToast({ title: '搜索失败', icon: 'none' });
        });
    },
    onSelect(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      this.setData({ selectedIndex: idx });
    },
    onConfirm() {
      const idx = this.data.selectedIndex;
      const product = idx >= 0 ? this.data.products[idx] : null;
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
