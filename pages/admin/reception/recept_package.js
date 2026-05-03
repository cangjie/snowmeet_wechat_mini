// pages/admin/reception/recept_package.js
// 添加套餐 — 选择页
// 调用方（recept_new）via navigateTo + eventChannel:
//   events: { rentalsSelected: (rentals) => { ... } }
// 本页确认后 emit rentalsSelected，父页追加到购物车并调 SaveRentRecept
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');

// 需要编码（扫码 / 录入条码）的品类。其余品类（如雪服、护具、雪镜等）默认 noCode=true。
const CODE_REQUIRED_CATS = ['双板', '单板', '双板鞋', '单板鞋'];

Page({
  data: {
    shop: '',
    shopObj: null,
    packages: [],
    visiblePackages: [],
    categories: [
      { key: 'all',   name: '全部' },
      { key: '双板',  name: '双板' },
      { key: '单板',  name: '单板' },
      { key: '雪服',  name: '雪服' },
      { key: '护具',  name: '护具' },
      { key: 'other', name: '其他' },
    ],
    activeCat: 'all',
    loading: true,
    selectedCount: 0,
    selectedQty: 0,
  },

  onLoad(options) {
    const shop = options.shop ? decodeURIComponent(options.shop) : '';
    this.setData({ shop });
    this._eventChannel = this.getOpenerEventChannel();

    app.loginPromiseNew.then(() => {
      Promise.all([
        data.getPackageListPromise(shop),
        data.getShopByNamePromise(shop),
      ]).then(([packages, shopObj]) => {
        const pkgList = (packages || []).map(p => ({ ...p, qty: 0 }));
        this.setData({ packages: pkgList, shopObj, loading: false });
        this._applyFilter();
      }).catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '套餐加载失败', icon: 'error' });
      });
    });
  },

  onCatTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeCat) return;
    this.setData({ activeCat: key }, () => this._applyFilter());
  },

  _applyFilter() {
    const { activeCat, packages } = this.data;
    let visible;
    if (activeCat === 'all') {
      visible = packages;
    } else if (activeCat === 'other') {
      visible = packages.filter(p => !p.package_type);
    } else {
      visible = packages.filter(p => p.package_type === activeCat);
    }
    this.setData({ visiblePackages: visible });
    this._refreshSummary();
  },

  onTogglePackage(e) {
    const id = e.currentTarget.dataset.id;
    const packages = this.data.packages.map(p =>
      p.id === id ? { ...p, qty: p.qty > 0 ? 0 : 1 } : p
    );
    this.setData({ packages }, () => this._applyFilter());
  },

  onPlus(e) {
    const id = e.currentTarget.dataset.id;
    const packages = this.data.packages.map(p =>
      p.id === id ? { ...p, qty: p.qty + 1 } : p
    );
    this.setData({ packages }, () => this._applyFilter());
  },

  onMinus(e) {
    const id = e.currentTarget.dataset.id;
    const packages = this.data.packages.map(p =>
      p.id === id ? { ...p, qty: Math.max(0, p.qty - 1) } : p
    );
    this.setData({ packages }, () => this._applyFilter());
  },

  _refreshSummary() {
    let count = 0;
    let qty = 0;
    this.data.packages.forEach(p => {
      if (p.qty > 0) { count++; qty += p.qty; }
    });
    this.setData({ selectedCount: count, selectedQty: qty });
  },

  onClose() {
    wx.navigateBack({ delta: 1 });
  },

  onConfirm() {
    const selected = this.data.packages.filter(p => p.qty > 0);
    if (selected.length === 0) {
      wx.showToast({ title: '请先选择套餐', icon: 'none' });
      return;
    }
    const shopObj = this.data.shopObj;
    if (!shopObj) {
      wx.showToast({ title: '店铺信息未加载，请稍候', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加载中...' });
    const startDate = util.formatDate(new Date());
    const startDateIsWeekend = util.isWeekend(new Date());

    // 每个套餐 × qty 份 → 并行加载完整套餐信息 + 价格列表
    const tasks = [];
    selected.forEach(pkg => {
      for (let i = 0; i < pkg.qty; i++) {
        tasks.push(Promise.all([
          data.getPackagePromise(pkg.id),
          data.getRentPriceListPromise(shopObj.id, '套餐', pkg.id, '门市'),
        ]));
      }
    });

    Promise.all(tasks).then(results => {
      wx.hideLoading();
      const rentals = results.map(([fullPkg, priceList]) => {
        const rental = {
          id: 0,
          order_id: null,
          package_id: fullPkg.id,
          name: fullPkg.name,
          valid: 0,
          expectDays: 1,
          guaranty: fullPkg.deposit,
          realGuaranty: fullPkg.deposit,
          guaranty_discount: 0,
          startDate,
          startDateIsWeekend,
          priceList: priceList || [],
          memo: '',
          timeStamp: Date.now(),
        };
        rental.rentItems = (fullPkg.rentPackageItemCategories || []).map(itemCat => {
          const cats = itemCat.categories || [];
          const allCatNames = cats.map(c => c && c.name).filter(Boolean).join('/');
          // 槽位的全部可选品类都不在编码白名单内 → 默认勾选「无编码」
          const requiresCode = cats.some(c => c && CODE_REQUIRED_CATS.indexOf(c.name) >= 0);
          return {
            id: 0,
            rental_id: 0,
            noCode: !requiresCode,
            canChooseCategory: cats.length > 1,
            chooseCategories: cats,
            chooseingCategory: false,
            categoryName: allCatNames,
            class_name: allCatNames,
            name: null,
            code: null,
            rent_product_id: null,
            category_id: cats[0] ? cats[0].id : null,
            memo: '',
            category: cats[0] || null,
          };
        });
        util.createRentalDetail(rental, new Date(startDate), new Date(startDate));
        return rental;
      });

      this._eventChannel.emit('rentalsSelected', rentals);
      wx.navigateBack({ delta: 1 });
    }).catch(err => {
      wx.hideLoading();
      console.warn('recept_package confirm failed', err);
      wx.showToast({ title: '加载套餐失败，请重试', icon: 'error' });
    });
  },
});
