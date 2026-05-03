// components/reception/rent_recept_form/rent_recept_form.js
// 租赁接待开单表单
// 视觉参考：pages/template/stitch/_4
// 数据契约：
//   - properties.rentals  父页购物车，每项保留旧版结构（rentItems/pricePresets/pick_type/...）
//   - triggerEvent('syncRent', { rentals, needUpdate })  购物车结构/字段变化时同步给父页
//   - triggerEvent('addAction', { action })              4 个快捷入口
//   - triggerEvent('checkout', { rentals })              点击去结算

const RENT_MODES = [
  { key: 'now',   name: '立即租赁' },
  { key: 'later', name: '先租后取' },
  { key: 'delay', name: '延时租赁' },
];

const PT_TO_KEY = { '立即租赁': 'now', '先租后取': 'later', '延时租赁': 'delay' };
const KEY_TO_PT = { now: '立即租赁', later: '先租后取', delay: '延时租赁' };

function pkgKey(r, idx) {
  if (r.id) return 'id_' + r.id;
  if (r.timeStamp) return 'ts_' + r.timeStamp;
  return 'idx_' + idx;
}
function itemKey(item, ridx, iidx) {
  if (item.id) return 'iid_' + item.id;
  return 'ri_' + ridx + '_' + iidx;
}
function getDailyRate(rental) {
  const presets = rental.pricePresets || [];
  if (presets.length > 0 && presets[0].price != null) return Number(presets[0].price);
  return 0;
}
// 估算字符串视觉宽度（汉字/全角=1，半角=0.5）。卡片标题列宽度大约能放 11~12 个汉字宽度。
function visualLen(s) {
  let n = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    n += (str.charCodeAt(i) < 128) ? 0.5 : 1;
  }
  return n;
}
const TITLE_MARQUEE_THRESHOLD = 11;

function stripUI(arr) {
  return (arr || []).map(r => {
    const out = {};
    Object.keys(r).forEach(k => { if (k.charAt(0) !== '_') out[k] = r[k]; });
    if (Array.isArray(out.rentItems)) {
      out.rentItems = out.rentItems.map(it => {
        const o = {};
        Object.keys(it).forEach(k => { if (k.charAt(0) !== '_') o[k] = it[k]; });
        return o;
      });
    }
    return out;
  });
}

Component({
  options: { addGlobalClass: true, multipleSlots: false },

  properties: {
    shop: { type: String, value: '' },
    memberId: { type: Number, value: 0 },
    rentals: {
      type: Array,
      value: [],
      observer(newVal) { this._refreshRentals(newVal || []); },
    },
  },

  data: {
    sort: 'time',
    rentModes: RENT_MODES,
    displayRentals: [],
    expandedPkg: {},
    expandedItem: {},
    summary: {
      depositLabel: '0',
      depositReduce: 0,
      depositReduceLabel: '0',
      rentLabel: '0.00',
    },
  },

  lifetimes: {
    attached() { this._refreshRentals(this.properties.rentals || []); },
  },

  methods: {
    /* ---------- 数据增强：原始 rentals → 渲染用 rentals ---------- */
    _refreshRentals(raw) {
      const expandedPkg = { ...(this.data.expandedPkg || {}) };
      const expandedItem = { ...(this.data.expandedItem || {}) };

      const augmented = raw.map((r, idx) => {
        const key = pkgKey(r, idx);
        if (expandedPkg[key] === undefined) expandedPkg[key] = (idx === 0);

        const dailyRate = getDailyRate(r);
        const realGuaranty = Number(r.realGuaranty != null ? r.realGuaranty : (r.guaranty || 0));

        const items = (r.rentItems || []).map((it, iidx) => {
          const ikey = itemKey(it, idx, iidx);
          if (expandedItem[ikey] === undefined) expandedItem[ikey] = false;
          const catName = it.class_name || it.categoryName || (it.category && it.category.name) || '';
          const title = catName || it.name || '待录入';
          return {
            ...it,
            _key: ikey,
            _expanded: expandedItem[ikey],
            _title: title,
            _marquee: visualLen(title) > TITLE_MARQUEE_THRESHOLD,
            _spec: it.name ? '名称：' + it.name : '',
            _entered: !!(it.code || it.name) || !!it.noCode || !!it.noNeed,
            _modeKey: PT_TO_KEY[it.pick_type] || '',
          };
        });

        return {
          ...r,
          _key: key,
          _expanded: expandedPkg[key],
          _displayName: r.name || (r.category && r.category.name) || '',
          _kindLabel: r.package_id ? '套装' : '单品',
          _depositLabel: realGuaranty,
          _dailyRate: dailyRate,
          _depositInput: String(realGuaranty || ''),
          _dailyRateInput: dailyRate ? dailyRate.toFixed(2) : '',
          _startDate: r.startDate || (r.start_date ? String(r.start_date).slice(0, 10) : ''),
          _startTime: r.startTime || '09:00',
          _modeKey: PT_TO_KEY[r.pick_type] || '',
          rentItems: items,
        };
      });

      this.setData({ displayRentals: augmented, expandedPkg, expandedItem }, () => this._refreshSummary());
    },

    _refreshSummary() {
      let deposit = 0, rent = 0, reduce = 0;
      (this.data.displayRentals || []).forEach(r => {
        deposit += Number(r._depositLabel) || 0;
        rent += Number(r._dailyRate) || 0;
        reduce += Number(r.guaranty_discount) || 0;
      });
      this.setData({
        summary: {
          depositLabel: deposit.toLocaleString('en-US'),
          depositReduce: reduce,
          depositReduceLabel: reduce.toLocaleString('en-US'),
          rentLabel: rent.toFixed(2),
        },
      });
    },

    _emitSync(needUpdate) {
      this.triggerEvent('syncRent', { rentals: stripUI(this.data.displayRentals), needUpdate: !!needUpdate });
    },

    /* ---------- 排序 ---------- */
    onSortChange(e) {
      const sort = e.currentTarget.dataset.value;
      if (sort === this.data.sort) return;
      this.setData({ sort });
      this.triggerEvent('sortChange', { sort });
    },

    /* ---------- 折叠 / 展开 ---------- */
    onTogglePkg(e) {
      const key = e.currentTarget.dataset.key;
      const idx = Number(e.currentTarget.dataset.idx);
      const next = !this.data.expandedPkg[key];
      this.setData({
        [`expandedPkg.${key}`]: next,
        [`displayRentals[${idx}]._expanded`]: next,
      });
    },
    onToggleItem(e) {
      const key = e.currentTarget.dataset.key;
      const ridx = Number(e.currentTarget.dataset.ridx);
      const iidx = Number(e.currentTarget.dataset.iidx);
      const next = !this.data.expandedItem[key];
      this.setData({
        [`expandedItem.${key}`]: next,
        [`displayRentals[${ridx}].rentItems[${iidx}]._expanded`]: next,
      });
    },

    /* ---------- 套餐字段 ---------- */
    onPkgModeTap(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const mode = e.currentTarget.dataset.mode;
      const pickType = KEY_TO_PT[mode];
      const items = (this.data.displayRentals[ridx].rentItems || []).map(it => ({
        ...it, pick_type: pickType, atOnce: mode !== 'delay', _modeKey: mode,
      }));
      this.setData({
        [`displayRentals[${ridx}].pick_type`]: pickType,
        [`displayRentals[${ridx}]._modeKey`]: mode,
        [`displayRentals[${ridx}].rentItems`]: items,
      });
      this._emitSync(false);
    },
    onPkgDepositBlur(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const v = parseFloat(e.detail.value);
      if (Number.isNaN(v)) return;
      const guaranty = Number(this.data.displayRentals[ridx].guaranty || 0);
      this.setData({
        [`displayRentals[${ridx}].realGuaranty`]: v,
        [`displayRentals[${ridx}].guaranty_discount`]: guaranty - v,
        [`displayRentals[${ridx}]._depositLabel`]: v,
        [`displayRentals[${ridx}]._depositInput`]: String(v),
      });
      this._refreshSummary();
      this._emitSync(false);
    },
    onPkgRateBlur(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const v = parseFloat(e.detail.value);
      if (Number.isNaN(v)) return;
      const presets = (this.data.displayRentals[ridx].pricePresets || []).slice();
      if (presets.length > 0) presets[0] = { ...presets[0], price: v };
      this.setData({
        [`displayRentals[${ridx}].pricePresets`]: presets,
        [`displayRentals[${ridx}]._dailyRate`]: v,
        [`displayRentals[${ridx}]._dailyRateInput`]: v.toFixed(2),
      });
      this._refreshSummary();
      this._emitSync(false);
    },
    onPkgDateChange(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const date = e.detail.value;
      this.setData({
        [`displayRentals[${ridx}].startDate`]: date,
        [`displayRentals[${ridx}].start_date`]: date,
        [`displayRentals[${ridx}]._startDate`]: date,
      });
      this._emitSync(false);
    },
    onPkgTimeChange(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const time = e.detail.value;
      this.setData({
        [`displayRentals[${ridx}].startTime`]: time,
        [`displayRentals[${ridx}]._startTime`]: time,
      });
      this._emitSync(false);
    },

    /* ---------- 单品字段 ---------- */
    onItemFieldBlur(e) {
      const { ridx, iidx, field } = e.currentTarget.dataset;
      const value = e.detail.value;
      const map = { itemName: 'name', code: 'code', note: 'memo' };
      const fld = map[field];
      if (!fld) return;
      this.setData({ [`displayRentals[${ridx}].rentItems[${iidx}].${fld}`]: value });
      if (field === 'code' && value) {
        this.setData({ [`displayRentals[${ridx}].rentItems[${iidx}]._entered`]: true });
      }
      this._emitSync(false);
    },
    onItemCodeFlag(e) {
      const { ridx, iidx, flag } = e.currentTarget.dataset;
      const item = this.data.displayRentals[ridx].rentItems[iidx];
      const path = `displayRentals[${ridx}].rentItems[${iidx}]`;
      const patch = {};

      let nextNoCode = !!item.noCode;
      let nextNoNeed = !!item.noNeed;
      let nextCode = item.code || '';
      let nextName = item.name || '';

      if (flag === 'no_code') {
        nextNoCode = !item.noCode;
        patch[`${path}.noCode`] = nextNoCode;
        if (nextNoCode) {
          nextCode = '';
          patch[`${path}.code`] = '';
        } else {
          nextName = '';
          patch[`${path}.name`] = '';
        }
      } else if (flag === 'not_required') {
        nextNoNeed = !item.noNeed;
        patch[`${path}.noNeed`] = nextNoNeed;
        if (nextNoNeed) {
          nextName = '';
          nextCode = '';
          patch[`${path}.name`] = '';
          patch[`${path}.code`] = '';
        }
      }

      patch[`${path}._entered`] = !!(nextCode || nextName) || nextNoCode || nextNoNeed;
      // 副标题派生（与 _refreshRentals 中保持一致：name 进副标题，主标题不依赖 name）
      patch[`${path}._spec`] = nextName ? '名称：' + nextName : '';

      this.setData(patch);
      this._emitSync(false);
    },
    onItemModeTap(e) {
      const { ridx, iidx, mode } = e.currentTarget.dataset;
      const item = this.data.displayRentals[ridx].rentItems[iidx];
      if (item.noNeed) return;
      const pickType = KEY_TO_PT[mode];
      this.setData({
        [`displayRentals[${ridx}].rentItems[${iidx}].pick_type`]: pickType,
        [`displayRentals[${ridx}].rentItems[${iidx}].atOnce`]: mode !== 'delay',
        [`displayRentals[${ridx}].rentItems[${iidx}]._modeKey`]: mode,
      });
      this._emitSync(false);
    },
    onItemScan(e) {
      const { ridx, iidx } = e.currentTarget.dataset;
      const item = this.data.displayRentals[ridx].rentItems[iidx];
      if (item.noNeed || item.noCode) return;
      wx.scanCode({
        success: (res) => {
          const code = res.result || '';
          this.setData({
            [`displayRentals[${ridx}].rentItems[${iidx}].code`]: code,
            [`displayRentals[${ridx}].rentItems[${iidx}]._entered`]: true,
          });
          this._emitSync(false);
        },
      });
    },

    /* ---------- 4 个快捷入口 ---------- */
    onAddAction(e) {
      const action = e.currentTarget.dataset.action;
      this.triggerEvent('addAction', { action });
    },

    /* ---------- 左划删除 ---------- */
    onDeleteRental(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      if (Number.isNaN(idx)) return;
      wx.showModal({
        title: '删除',
        content: '确认删除此项？',
        confirmColor: '#ba1a1a',
        success: (res) => { if (res.confirm) this.removeRental(idx); },
      });
    },

    /* ---------- 结算 ---------- */
    onCheckout() {
      if (!this.data.displayRentals || this.data.displayRentals.length === 0) {
        wx.showToast({ title: '请先添加租赁商品', icon: 'none' });
        return;
      }
      this.triggerEvent('checkout', { rentals: stripUI(this.data.displayRentals) });
    },

    /* ---------- 父页可调用 ---------- */
    addRental(rental) {
      const cleaned = stripUI(this.data.displayRentals);
      rental.timeStamp = rental.timeStamp || Date.now();
      cleaned.push(rental);
      this.triggerEvent('syncRent', { rentals: cleaned, needUpdate: true });
    },
    removeRental(index) {
      const cleaned = stripUI(this.data.displayRentals);
      cleaned.splice(index, 1);
      this.triggerEvent('syncRent', { rentals: cleaned, needUpdate: true });
    },
  },
});
