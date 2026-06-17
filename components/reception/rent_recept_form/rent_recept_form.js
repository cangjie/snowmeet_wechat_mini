// components/reception/rent_recept_form/rent_recept_form.js
// 租赁接待开单表单
// 视觉参考：Alpine Operational Minimalist stitch _4
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
// 录入完整性判定：
//   - noNeed=true → 不显示 chip（label 留空）
//   - 主项（!is_associate）必须有 category_id（无码物品入口创建时为 null，需用户选分类）
//   - 否则按 noCode 决定校验 code 还是 name；并且 pick_type 必选
//   - 完整 → "已录入"；缺项 → "分类未选 / 编码未填 / 模式未选" 等
//   - 附件项（is_associate=true）走同一套校验：noCode 默认 true → 必须录名称
function evalEntry(item) {
  if (item && item.noNeed) return { ok: true, label: '' };
  if (item && !item.is_associate && !item.category_id) {
    return { ok: false, label: '分类未选' };
  }
  const missing = [];
  if (item && item.noCode) {
    if (!String((item && item.name) || '').trim()) missing.push('名称未填');
  } else {
    if (!String((item && item.code) || '').trim()) missing.push('编码未填');
  }
  if (!item || !item.pick_type) missing.push('模式未选');
  if (missing.length === 0) return { ok: true, label: '已录入' };
  return { ok: false, label: missing[0] };
}

// rental（购物车套餐项）级录入完整性判定，按优先级返回第一个缺项：
//   1. 没选租赁模式 → 「模式未选」
//   2. 没填起租日期 → 「起租时间未填」（startTime 有默认值不参与判定）
//   3. rentItems 有 N 件未录入（noNeed 不计） → 「N 件未录入」
//   4. 全齐 → 「已录入」
function evalRental(rental) {
  if (!rental || !rental.pick_type) return { ok: false, label: '模式未选' };
  if (!rental.startDate && !rental.start_date) return { ok: false, label: '起租时间未填' };
  const items = rental.rentItems || [];
  const unfinished = items.filter(it => !it.noNeed && !evalEntry(it).ok).length;
  if (unfinished > 0) return { ok: false, label: `${unfinished} 件未录入` };
  return { ok: true, label: '已录入' };
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
// rental 名称在展开态独占一行，容器宽度比 rentItem 宽 → 阈值更大
const RENTAL_TITLE_THRESHOLD = 18;

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function dateTimeForMode(mode) {
  const now = new Date();
  if (mode === 'delay') {
    const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    return { date: formatDate(tmrw), time: '00:00' };
  }
  return { date: formatDate(now), time: formatTime(now) };
}

// 后端 Rental 模型只有一个 start_date (DateTime?)；前端把日期 + 时间合并写入 start_date 持久化。
function combineDateTime(date, time) {
  const d = date || formatDate(new Date());
  const t = time || '09:00';
  return `${d}T${t}:00`;
}

// 拆 r.start_date（C# DateTime 序列化为 ISO 8601 'YYYY-MM-DDTHH:mm:ss[.fff]'，也兼容 'YYYY-MM-DD HH:mm:ss'）
function splitISODateTime(sd) {
  if (!sd) return { date: '', time: '' };
  const s = String(sd);
  const date = s.slice(0, 10);
  const time = s.length >= 16 ? s.slice(11, 16) : '';
  return { date, time };
}

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
      count: 0,
      canCheckout: false,
    },
    calendarShow: false,
    calendarRidx: -1,
    calendarDefault: Date.now(),
    calendarMin: Date.now(),
    calendarMax: Date.now() + 365 * 24 * 60 * 60 * 1000,
    searchShow: false,
    searchRidx: -1,
    searchIidx: -1,
    searchCategoryId: null,
    searchCategoryName: '',
    // 区分 modal 触发来源：true=底部"搜索单品"入口（全库搜，选中后新增 rental）
    //                      false=rentItem 编码区点击（按品类搜，选中后填充已存在槽位）
    searchAddNew: false,

    // 分类选择 modal（用于无码物品 rentItem 选分类，及修改主项分类时联动重建附件）
    categoryShow: false,
    categoryRidx: -1,
    categoryIidx: -1,
    categoryItems: [],            // van-tree-select 数据：[{ text, id, children: [{text,id}] }]
    categoryRaw: [],              // 与 categoryItems 同序的完整分类对象，confirm 时按 activeId 取
    categoryMainActiveIndex: 0,
    categoryActiveId: null,

    // 金额输入 modal（押金 / 租金/日）。原本用 wx.showModal({editable:true})，
    // 但 wx.showModal 的输入框只能用系统默认键盘，没法切到带小数点的数字键盘。
    // 改成自建 van-popup + <input type="digit">，键盘原生支持小数点。
    amountModal: {
      show: false,
      title: '',
      placeholder: '',
      value: '',
      ridx: -1,
      field: '', // 'deposit' | 'rate'
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
      const today = formatDate(new Date());
      const tmrwDate = new Date(); tmrwDate.setDate(tmrwDate.getDate() + 1);
      const tmrw = formatDate(tmrwDate);

      const augmented = raw.map((r, idx) => {
        const key = pkgKey(r, idx);
        if (expandedPkg[key] === undefined) expandedPkg[key] = (idx === 0);

        const dailyRate = getDailyRate(r);
        const realGuaranty = Number(r.realGuaranty != null ? r.realGuaranty : (r.guaranty || 0));
        const guarantyDiscount = Number(r.guaranty_discount || 0);
        // 押金显示 = realGuaranty - guaranty_discount（实际收取的押金 = 押金 - 已减免）
        const netDeposit = realGuaranty > 0
          ? Math.round((realGuaranty - guarantyDiscount) * 100) / 100
          : 0;

        const items = (r.rentItems || []).map((it, iidx) => {
          const ikey = itemKey(it, idx, iidx);
          // 待选分类的主项（无码物品入口创建时）默认展开，让用户立刻看到分类入口
          const needsCategory = !it.is_associate && !it.category_id && !it.noNeed;
          if (expandedItem[ikey] === undefined) expandedItem[ikey] = needsCategory;
          const catName = it.class_name || it.categoryName || (it.category && it.category.name) || '';
          const title = catName || it.name || (needsCategory ? '待选分类' : '待录入');
          const entry = evalEntry(it);
          return {
            ...it,
            _key: ikey,
            _expanded: expandedItem[ikey],
            _title: title,
            _marquee: visualLen(title) > TITLE_MARQUEE_THRESHOLD,
            _entered: entry.ok,
            _statusLabel: entry.label,
            _modeKey: PT_TO_KEY[it.pick_type] || '',
          };
        });

        // 套餐内 rentItems 的模式是否存在差异（noNeed 项跳过，空 / null 视为同一种"未选"）
        const modeSet = new Set();
        items.forEach(it => { if (!it.noNeed) modeSet.add(it.pick_type || ''); });
        const modeMixed = modeSet.size > 1;

        const rentalEntry = evalRental({ ...r, rentItems: items });
        const displayName = r.name || (r.category && r.category.name) || '';
        const sd = splitISODateTime(r.start_date);
        const startDate = sd.date || r.startDate || '';
        const startTime = sd.time || r.startTime || '';

        return {
          ...r,
          _key: key,
          _expanded: expandedPkg[key],
          _displayName: displayName,
          _displayMarquee: visualLen(displayName) > RENTAL_TITLE_THRESHOLD,
          _kindLabel: r.package_id ? '套装' : '单品',
          _depositLabel: netDeposit,
          _dailyRate: dailyRate,
          _depositInput: realGuaranty > 0 ? String(netDeposit) : '',
          _dailyRateInput: dailyRate ? dailyRate.toFixed(2) : '',
          _startDate: startDate,
          _startTime: startTime || '09:00',
          _dateIsToday: !!startDate && startDate === today,
          _dateIsTomorrow: !!startDate && startDate === tmrw,
          _modeKey: PT_TO_KEY[r.pick_type] || '',
          _modeMixed: modeMixed,
          _rentalEntered: rentalEntry.ok,
          _rentalStatusLabel: rentalEntry.label,
          rentItems: items,
        };
      });

      this.setData({ displayRentals: augmented, expandedPkg, expandedItem }, () => this._refreshSummary());
    },

    _refreshSummary() {
      let deposit = 0, rent = 0, reduce = 0;
      const list = this.data.displayRentals || [];
      list.forEach(r => {
        deposit += Number(r._depositLabel) || 0;
        rent += Number(r._dailyRate) || 0;
        reduce += Number(r.guaranty_discount) || 0;
      });
      deposit = Math.round(deposit * 100) / 100;
      reduce = Math.round(reduce * 100) / 100;
      const count = list.length;
      const canCheckout = count > 0 && list.every(r => r._rentalEntered);
      this.setData({
        summary: {
          depositLabel: deposit.toLocaleString('en-US'),
          depositReduce: reduce,
          depositReduceLabel: reduce.toLocaleString('en-US'),
          rentLabel: rent.toFixed(2),
          count,
          canCheckout,
        },
      });
    },

    _emitSync(needUpdate) {
      this.triggerEvent('syncRent', { rentals: stripUI(this.data.displayRentals), needUpdate: !!needUpdate });
    },

    _updateRentalChip(ridx) {
      const r = this.data.displayRentals[ridx];
      if (!r) return;
      const entry = evalRental(r);
      this.setData({
        [`displayRentals[${ridx}]._rentalEntered`]: entry.ok,
        [`displayRentals[${ridx}]._rentalStatusLabel`]: entry.label,
      });
      this._refreshSummary();
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
      const { date, time } = dateTimeForMode(mode);
      const today = formatDate(new Date());
      const tmrwDate = new Date(); tmrwDate.setDate(tmrwDate.getDate() + 1);
      const tmrw = formatDate(tmrwDate);
      const items = (this.data.displayRentals[ridx].rentItems || []).map(it => {
        // 跟随条件：自身没选过 / 上次也是从套餐继承（_modeFromPkg）。已手动自选的保持不动。
        if (it.pick_type && !it._modeFromPkg) return it;
        const next = { ...it, pick_type: pickType, atOnce: mode !== 'delay', _modeKey: mode, _modeFromPkg: true };
        const entry = evalEntry(next);
        next._entered = entry.ok;
        next._statusLabel = entry.label;
        return next;
      });
      this.setData({
        [`displayRentals[${ridx}].pick_type`]: pickType,
        [`displayRentals[${ridx}]._modeKey`]: mode,
        [`displayRentals[${ridx}].rentItems`]: items,
        [`displayRentals[${ridx}].start_date`]: combineDateTime(date, time),
        [`displayRentals[${ridx}]._startDate`]: date,
        [`displayRentals[${ridx}]._dateIsToday`]: date === today,
        [`displayRentals[${ridx}]._dateIsTomorrow`]: date === tmrw,
        [`displayRentals[${ridx}]._startTime`]: time,
      });
      this._updateRentalChip(ridx);
      this._emitSync(false);
    },
    onPkgModeMixedTap() {
      wx.showToast({ title: '套餐内装备模式不一致', icon: 'none' });
    },
    // 押金：点击 → 输入 modal（带小数点数字键盘） → 确认 modal → 应用
    onPkgDepositTap(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const current = this.data.displayRentals[ridx]._depositInput || '';
      this.setData({
        amountModal: {
          show: true,
          title: '修改押金',
          // 当前金额放 placeholder 作参照，输入框留空：点开即可直接输新值，不用先手删旧值
          placeholder: current ? ('原 ¥' + current) : '请输入押金金额',
          value: '',
          ridx,
          field: 'deposit',
        },
      });
    },
    _applyPkgDeposit(ridx, v) {
      // 同时更新 guaranty 与 realGuaranty：服务端往返不一定保留 realGuaranty，
      // 而 _refreshRentals 会在 realGuaranty 缺失时回退到 guaranty，
      // 若不同步更新 guaranty，UI 会被刷回旧值。
      // modal 编辑是绝对覆盖，把 guaranty_discount 清零；外部减免（如会员/券）需走各自的路径。
      this.setData({
        [`displayRentals[${ridx}].guaranty`]: v,
        [`displayRentals[${ridx}].realGuaranty`]: v,
        [`displayRentals[${ridx}].guaranty_discount`]: 0,
        [`displayRentals[${ridx}]._depositLabel`]: v,
        [`displayRentals[${ridx}]._depositInput`]: String(v),
      });
      this._refreshSummary();
      this._emitSync(false);
    },

    // 租金/日：点击 → 输入 modal（带小数点数字键盘） → 确认 modal → 应用
    onPkgRateTap(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const current = this.data.displayRentals[ridx]._dailyRateInput || '';
      this.setData({
        amountModal: {
          show: true,
          title: '修改租金/日',
          // 当前金额放 placeholder 作参照，输入框留空：点开即可直接输新值，不用先手删旧值
          placeholder: current ? ('原 ¥' + current) : '请输入每日租金',
          value: '',
          ridx,
          field: 'rate',
        },
      });
    },

    // ---------- 金额输入 modal（替代 wx.showModal({editable:true}) 以支持小数点数字键盘） ----------
    onAmountModalInput(e) {
      this.setData({ 'amountModal.value': e.detail.value });
    },
    onAmountModalCancel() {
      this.setData({ 'amountModal.show': false });
    },
    onAmountModalConfirm() {
      const m = this.data.amountModal;
      const raw = (m.value == null ? '' : String(m.value)).trim();
      // 输入框留空 = 不修改，直接关闭（点开看一眼又不改时不报错，金额保持原值）
      if (raw === '') {
        this.setData({ 'amountModal.show': false });
        return;
      }
      const v = parseFloat(raw);
      if (Number.isNaN(v) || v < 0) {
        wx.showToast({ title: '请输入有效金额', icon: 'none' });
        return;
      }
      const ridx = m.ridx;
      const field = m.field;
      const label = field === 'deposit' ? '押金' : '租金/日';
      const that = this;
      this.setData({ 'amountModal.show': false });
      wx.showModal({
        title: '确认修改',
        content: `${label} 将修改为 ¥${v.toFixed(2)}，是否确认？`,
        success(c) {
          if (!c.confirm) return;
          if (field === 'deposit') that._applyPkgDeposit(ridx, v);
          else that._applyPkgRate(ridx, v);
        },
      });
    },
    _applyPkgRate(ridx, v) {
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

    // 招待：勾选后该 rental 免租金（后端 totalSummary 排除租金），entertain 随 syncRent 落库
    onPkgEntertainToggle(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const checked = e.detail.value.length > 0;
      this.setData({ [`displayRentals[${ridx}].entertain`]: checked });
      this._emitSync(false);
    },

    _setPkgDate(ridx, date) {
      const today = formatDate(new Date());
      const tmrwDate = new Date(); tmrwDate.setDate(tmrwDate.getDate() + 1);
      const tmrw = formatDate(tmrwDate);
      const r = this.data.displayRentals[ridx] || {};
      const oldTime = splitISODateTime(r.start_date).time || r._startTime || '';
      this.setData({
        [`displayRentals[${ridx}].start_date`]: combineDateTime(date, oldTime),
        [`displayRentals[${ridx}]._startDate`]: date,
        [`displayRentals[${ridx}]._dateIsToday`]: date === today,
        [`displayRentals[${ridx}]._dateIsTomorrow`]: date === tmrw,
      });
      this._updateRentalChip(ridx);
      this._emitSync(false);
    },
    onPkgDateTap(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const r = this.data.displayRentals[ridx];
      let defaultDate = Date.now();
      if (r && r._startDate) {
        const t = new Date(r._startDate).getTime();
        if (!isNaN(t)) defaultDate = t;
      }
      this.setData({
        calendarShow: true,
        calendarRidx: ridx,
        calendarDefault: defaultDate,
      });
    },
    onPkgDateQuick(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const offset = Number(e.currentTarget.dataset.day);
      const d = new Date();
      d.setDate(d.getDate() + offset);
      this._setPkgDate(ridx, formatDate(d));
    },
    onCalendarClose() {
      this.setData({ calendarShow: false, calendarRidx: -1 });
    },
    onCalendarConfirm(e) {
      const ts = e.detail;
      const ridx = this.data.calendarRidx;
      this.setData({ calendarShow: false, calendarRidx: -1 });
      if (ridx < 0 || !ts) return;
      this._setPkgDate(ridx, formatDate(new Date(ts)));
    },
    onPkgTimeChange(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const time = e.detail.value;
      const r = this.data.displayRentals[ridx] || {};
      const oldDate = splitISODateTime(r.start_date).date || r._startDate || formatDate(new Date());
      this.setData({
        [`displayRentals[${ridx}].start_date`]: combineDateTime(oldDate, time),
        [`displayRentals[${ridx}]._startTime`]: time,
      });
      this._updateRentalChip(ridx);
      this._emitSync(false);
    },
    onPkgMemoBlur(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const value = e.detail.value;
      this.setData({
        [`displayRentals[${ridx}].memo`]: value,
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
      const cur = this.data.displayRentals[ridx].rentItems[iidx];
      const entry = evalEntry({ ...cur, [fld]: value });
      this.setData({
        [`displayRentals[${ridx}].rentItems[${iidx}].${fld}`]: value,
        [`displayRentals[${ridx}].rentItems[${iidx}]._entered`]: entry.ok,
        [`displayRentals[${ridx}].rentItems[${iidx}]._statusLabel`]: entry.label,
      });
      this._updateRentalChip(Number(ridx));
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

      const entry = evalEntry({ ...item, noCode: nextNoCode, noNeed: nextNoNeed, code: nextCode, name: nextName });
      patch[`${path}._entered`] = entry.ok;
      patch[`${path}._statusLabel`] = entry.label;

      this.setData(patch);
      this._updateRentalChip(Number(ridx));
      this._emitSync(false);
    },
    onItemModeTap(e) {
      const { ridx, iidx, mode } = e.currentTarget.dataset;
      const item = this.data.displayRentals[ridx].rentItems[iidx];
      if (item.noNeed) return;
      const pickType = KEY_TO_PT[mode];
      const entry = evalEntry({ ...item, pick_type: pickType });
      this.setData({
        [`displayRentals[${ridx}].rentItems[${iidx}].pick_type`]: pickType,
        [`displayRentals[${ridx}].rentItems[${iidx}].atOnce`]: mode !== 'delay',
        [`displayRentals[${ridx}].rentItems[${iidx}]._modeKey`]: mode,
        [`displayRentals[${ridx}].rentItems[${iidx}]._modeFromPkg`]: false,
        [`displayRentals[${ridx}].rentItems[${iidx}]._entered`]: entry.ok,
        [`displayRentals[${ridx}].rentItems[${iidx}]._statusLabel`]: entry.label,
      });
      this._updateRentalChip(Number(ridx));
      this._emitSync(false);
    },
    onItemScan(e) {
      const { ridx, iidx } = e.currentTarget.dataset;
      const item = this.data.displayRentals[ridx].rentItems[iidx];
      if (item.noNeed || item.noCode) return;
      wx.scanCode({
        success: (res) => {
          const code = res.result || '';
          const cur = this.data.displayRentals[ridx].rentItems[iidx];
          const entry = evalEntry({ ...cur, code });
          this.setData({
            [`displayRentals[${ridx}].rentItems[${iidx}].code`]: code,
            [`displayRentals[${ridx}].rentItems[${iidx}]._entered`]: entry.ok,
            [`displayRentals[${ridx}].rentItems[${iidx}]._statusLabel`]: entry.label,
          });
          this._updateRentalChip(Number(ridx));
          this._emitSync(false);
        },
      });
    },

    /* ---------- 编码搜索 modal ---------- */
    onItemCodeTap(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const iidx = Number(e.currentTarget.dataset.iidx);
      const item = (this.data.displayRentals[ridx] || {}).rentItems[iidx] || {};
      if (item.noNeed || item.noCode) return;
      const cat = item.category || {};
      this.setData({
        searchShow: true,
        searchRidx: ridx,
        searchIidx: iidx,
        searchCategoryId: item.category_id || cat.id || null,
        searchCategoryName: cat.name || item.class_name || '',
      });
    },
    onSearchClose() {
      this.setData({ searchShow: false, searchRidx: -1, searchIidx: -1, searchAddNew: false });
    },
    onProductConfirm(e) {
      const product = e.detail && e.detail.product;
      if (!product) {
        this.setData({ searchShow: false, searchRidx: -1, searchIidx: -1, searchAddNew: false });
        return;
      }
      const code = String(product.barcode || '');
      // 「搜索单品」底部入口：选中后由 page 构造 rental 追加到购物车
      if (this.data.searchAddNew) {
        const dupAddNew = (this.data.displayRentals || []).some(r =>
          (r.rentItems || []).some(it =>
            !it.noNeed && !it.noCode && it.code && it.code === code
          )
        );
        if (dupAddNew) {
          wx.showToast({ title: '编码已被占用', icon: 'none' });
          return;
        }
        this.setData({ searchShow: false, searchRidx: -1, searchIidx: -1, searchAddNew: false });
        this.triggerEvent('addSingleProduct', { product });
        return;
      }
      // rentItem 编码区点击：填充已存在槽位
      const ridx = this.data.searchRidx;
      const iidx = this.data.searchIidx;
      if (ridx < 0 || iidx < 0) {
        this.setData({ searchShow: false, searchRidx: -1, searchIidx: -1 });
        return;
      }
      // 重复编码校验：同一购物车内除自己以外不允许相同编码
      const dup = (this.data.displayRentals || []).some((r, ri) =>
        (r.rentItems || []).some((it, ii) =>
          !it.noNeed && !it.noCode && it.code && it.code === code && !(ri === ridx && ii === iidx)
        )
      );
      if (dup) {
        wx.showToast({ title: '编码已被占用', icon: 'none' });
        return;
      }
      const cur = this.data.displayRentals[ridx].rentItems[iidx];
      const next = {
        ...cur,
        code,
        name: product.name || '',
        category_id: product.category_id != null ? product.category_id : cur.category_id,
        rent_product_id: product.id,
        class_name: (product.category && product.category.name) || cur.class_name || '',
        memo: '',
      };
      const entry = evalEntry(next);
      this.setData({
        [`displayRentals[${ridx}].rentItems[${iidx}].code`]: next.code,
        [`displayRentals[${ridx}].rentItems[${iidx}].name`]: next.name,
        [`displayRentals[${ridx}].rentItems[${iidx}].category_id`]: next.category_id,
        [`displayRentals[${ridx}].rentItems[${iidx}].rent_product_id`]: next.rent_product_id,
        [`displayRentals[${ridx}].rentItems[${iidx}].class_name`]: next.class_name,
        [`displayRentals[${ridx}].rentItems[${iidx}].memo`]: next.memo,
        [`displayRentals[${ridx}].rentItems[${iidx}]._entered`]: entry.ok,
        [`displayRentals[${ridx}].rentItems[${iidx}]._statusLabel`]: entry.label,
        searchShow: false,
        searchRidx: -1,
        searchIidx: -1,
      });
      this._updateRentalChip(Number(ridx));
      this._emitSync(false);
    },

    /* ---------- 分类选择 modal（无码物品主项选分类 / 主项分类切换） ---------- */
    async onItemCategoryTap(e) {
      const ridx = Number(e.currentTarget.dataset.ridx);
      const iidx = Number(e.currentTarget.dataset.iidx);
      const item = ((this.data.displayRentals[ridx] || {}).rentItems || [])[iidx];
      if (!item || item.is_associate || item.noNeed) return;
      await this._ensureCategoryTreeLoaded();
      // 主 nav 默认定位到当前 category 所属的顶级
      let mainIdx = 0;
      const tree = this.data.categoryItems || [];
      for (let i = 0; i < tree.length; i++) {
        const ch = tree[i].children || [];
        if (ch.some(c => c.id === item.category_id)) { mainIdx = i; break; }
      }
      await this._loadCategorySub(mainIdx);
      this.setData({
        categoryShow: true,
        categoryRidx: ridx,
        categoryIidx: iidx,
        categoryActiveId: item.category_id || null,
        categoryMainActiveIndex: mainIdx,
      });
    },

    async _ensureCategoryTreeLoaded() {
      if ((this.data.categoryItems || []).length > 0) return;
      const data = require('../../../utils/data.js');
      const tops = await data.getTopCategoriesPromise();
      const list = (tops || []).map(c => ({ text: c.name, id: c.id }));
      this.setData({ categoryItems: list, categoryRaw: tops || [] });
    },

    async _loadCategorySub(mainIdx) {
      const tree = (this.data.categoryItems || []).slice();
      if (!tree[mainIdx] || tree[mainIdx].children) return;
      const data = require('../../../utils/data.js');
      const top = tree[mainIdx];
      const sub = (await data.getSubCategoriesPromise(top.id)) || [];
      const childMap = this.data._categoryChildMap || {};
      sub.forEach(c => { childMap[c.id] = c; });
      tree[mainIdx] = { ...top, children: sub.map(c => ({ text: c.name, id: c.id })) };
      this.setData({ categoryItems: tree, _categoryChildMap: childMap });
    },

    async onCategoryNav(e) {
      const idx = (e.detail && e.detail.index) != null ? e.detail.index : 0;
      await this._loadCategorySub(idx);
      this.setData({ categoryMainActiveIndex: idx });
    },

    onCategoryItemTap(e) {
      const id = e.detail && e.detail.id;
      if (id != null) this.setData({ categoryActiveId: id });
    },

    onCategoryClose() {
      this.setData({ categoryShow: false, categoryRidx: -1, categoryIidx: -1, categoryActiveId: null });
    },

    onCategoryConfirm() {
      const activeId = this.data.categoryActiveId;
      if (!activeId) {
        wx.showToast({ title: '未选择分类', icon: 'none' });
        return;
      }
      const childMap = this.data._categoryChildMap || {};
      const chosen = childMap[activeId];
      if (!chosen) {
        wx.showToast({ title: '分类无效', icon: 'none' });
        return;
      }
      const ridx = this.data.categoryRidx;
      const iidx = this.data.categoryIidx;
      this.setData({ categoryShow: false, categoryRidx: -1, categoryIidx: -1, categoryActiveId: null });
      this._applyCategoryChange(ridx, iidx, chosen);
    },

    // 主项分类变更：拉 fullCategory + priceList → 更新主项 + 删旧附件 + 按新 associateCategories 重建附件
    // → 同步 rental 的 category_id / name / guaranty / priceList → emit syncRent 让父页保存
    async _applyCategoryChange(ridx, iidx, newCat) {
      if (ridx < 0 || iidx < 0 || !newCat) return;
      const dataLib = require('../../../utils/data.js');
      const util = require('../../../utils/util.js');
      wx.showLoading({ title: '加载中...', mask: true });
      try {
        const [fullCat, shopObj] = await Promise.all([
          dataLib.getRentCategoryPromise(newCat.id),
          dataLib.getShopByNamePromise(this.properties.shop || ''),
        ]);
        if (!shopObj || !shopObj.id) {
          wx.hideLoading();
          wx.showToast({ title: '店铺信息未加载，请重试', icon: 'none' });
          return;
        }
        const priceList = await dataLib.getRentPriceListPromise(shopObj.id, '分类', newCat.id, '门市');
        wx.hideLoading();

        const rentals = stripUI(this.data.displayRentals);
        const rental = rentals[ridx];
        if (!rental || !rental.rentItems || !rental.rentItems[iidx]) return;

        // 1) 主项 rentItem 字段更新
        const main = rental.rentItems[iidx];
        main.category_id = newCat.id;
        main.category = newCat;
        main.class_name = newCat.name || '';
        main.categoryName = newCat.name || '';
        main.chooseCategories = [newCat];
        main.canChooseCategory = false;

        // 2) 删旧附件 + 按新分类的 associateCategories 重建
        const nonAssociates = rental.rentItems.filter(it => !it.is_associate);
        const associates = (fullCat && fullCat.associateCategories) || [];
        const defaultPickType = rental.pick_type;
        const atOnce = !!rental.atOnce;
        const newAssociates = associates.map(a => {
          const cat = a.category || {};
          return {
            id: 0,
            rental_id: 0,
            is_associate: true,
            noCode: true,
            canChooseCategory: false,
            chooseCategories: [cat],
            chooseingCategory: false,
            categoryName: cat.name || '',
            class_name: cat.name || '',
            name: null,
            code: null,
            rent_product_id: null,
            category_id: a.associate_id,
            memo: '',
            category: cat,
            pick_type: defaultPickType,
            atOnce,
            valid: 1,
          };
        });
        rental.rentItems = nonAssociates.concat(newAssociates);

        // 3) 同步 rental 字段（参考旧版 confirmCategory 语义）
        rental.category_id = newCat.id;
        rental.category = newCat;
        rental.name = newCat.name || '';
        rental.guaranty = newCat.deposit || 0;
        rental.realGuaranty = newCat.deposit || 0;
        rental.guaranty_discount = 0;
        rental.priceList = priceList || [];

        // 4) 用 util.createRentalDetail 重算 pricePresets（getDailyRate 取 pricePresets[0].price）
        const sd = splitISODateTime(rental.start_date);
        const startDateStr = sd.date || formatDate(new Date());
        try {
          util.createRentalDetail(rental, new Date(startDateStr), new Date(startDateStr));
        } catch (e) {
          console.warn('createRentalDetail failed', e);
        }

        // 5) 触发父页保存（needUpdate=true 走 SaveRentRecept；保存返回会经 properties observer 回流刷新）
        this.triggerEvent('syncRent', { rentals, needUpdate: true });
      } catch (err) {
        wx.hideLoading();
        console.warn('apply category change failed', err);
        wx.showToast({ title: '设置分类失败，请重试', icon: 'error' });
      }
    },

    /* ---------- 4 个快捷入口 ---------- */
    onAddAction(e) {
      const action = e.currentTarget.dataset.action;
      // 「搜索单品」内部直接打开搜索 modal（全库搜，无 categoryId）
      if (action === 'search') {
        this.setData({
          searchShow: true,
          searchAddNew: true,
          searchRidx: -1,
          searchIidx: -1,
          searchCategoryId: null,
          searchCategoryName: '',
        });
        return;
      }
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
