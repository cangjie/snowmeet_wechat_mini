// components/reception/care_recept_form/care_recept_form.js
// 养护接待开单表单（业务数据结构对齐旧版 components/care/care_recept.js，
// 交互/视觉对齐 components/reception/rent_recept_form）
// 组件契约（镜像 rent_recept_form）：
//   - properties.cares      父页传入的当前购物车（care 数组）
//   - properties.shop       店铺名（定价用）
//   - properties.memberId   会员 id（优惠券选择用）
//   - triggerEvent('syncCare', { cares, needUpdate })   购物车变化，父页调 saveCareReceptOrder
//   - triggerEvent('checkout', { cares })               点击去结算
// 字段名以后端 Models/Care/Care.cs 为准（snake_case；warranty/entertain 是 bool；
// 旧前端 left_angel 拼写错误，后端是 left_angle——本组件不采集安检字段，安检数据在任务环节录入）
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');

// 与 data.js uploadFilePromise 的上传域名保持一致（文件落在处理上传那台服务器的磁盘）
const UPLOAD_HOST = 'https://snowmeet.wanlonghuaxue.com';

// 新建一个空 care（snake_case 对齐后端；valid=0 草稿态，PlaceCareOrder 才置 1）
function blankCare() {
  return {
    id: 0,
    order_id: null,
    biz_type: null,
    equipment: null,
    brand: null,
    series: null,
    scale: null,
    year: null,
    serials: null,
    boot_length: null,
    with_pole: null,
    need_edge: 0,
    edge_degree: null,
    need_wax: 0,
    need_unwax: 0,
    free_wax: 0,
    need_repair: 0,
    repair_memo: null,
    repair_charge: 0,
    urgent: 0,
    summer: null,
    warranty: false,
    entertain: false,
    discount: 0,
    ticket_code: null,
    ticket_discount: 0,
    use_card: false,
    card_id: null,   // 所选会员卡（后端 Care 无对应列，仅前端标量，随 use_card 一起维护）
    card_name: null,
    common_charge: 0,
    memo: null,
    others_associates: null,
    careImages: [],
    valid: 0,
    timeStamp: Date.now(),
  };
}

Component({
  options: { multipleSlots: false },
  properties: {
    shop: { type: String, value: '' },
    memberId: { type: null, value: null },
    cares: { type: Array, value: [] },
  },
  data: {
    displayCares: [],
    summary: { count: 0, totalLabel: '0.00', canCheckout: false },
    // 品牌 / 其它服务字典（按装备类型缓存）
    skiBrandList: [],
    boardBrandList: [],
    skiOthersService: [],
    boardOthersService: [],
    // 新增品牌 inline 表单
    addBrand: { show: false, cidx: -1, name: '', chineseName: '' },
    // 金额输入 modal（附加费 / 减免，复用租赁的 amount-modal 样式）
    amountModal: { show: false, title: '', placeholder: '', value: '', cidx: -1, field: '' },
    // 优惠券/会员卡弹层
    ticketPopup: { show: false, cidx: -1, selectedCode: null, selectedCardId: null, disabledCodes: [] },
    // 历史装备弹层：会员选定装备类型后，列出其养护过的同类型装备供直接选择；
    // 也可在弹层里手动选品牌 + 填长度（列表里没有的新装备）
    historyModal: { show: false, cidx: -1, equip: '', list: [], brandListView: [], brandIndex: null, brand: '', scale: '' },
    expandedMap: {},
  },
  observers: {
    cares() { this._refreshCares(); },
  },
  lifetimes: {
    attached() {
      const that = this;
      app.loginPromiseNew.then(() => {
        Promise.all([
          data.getEquipBrandsPromise('双板'),
          data.getEquipBrandsPromise('单板'),
          data.getCareOthersServicePromise('双板'),
          data.getCareOthersServicePromise('单板'),
        ]).then(([skiBrands, boardBrands, skiOthers, boardOthers]) => {
          that.setData({
            skiBrandList: skiBrands || [],
            boardBrandList: boardBrands || [],
            skiOthersService: skiOthers || [],
            boardOthersService: boardOthers || [],
          });
          that._refreshCares();
        }).catch((e) => { console.warn('load care dictionaries failed', e); });
      });
    },
  },
  methods: {
    /* ---------- 派生渲染数据 ---------- */
    _careKey(care, idx) {
      return care.id > 0 ? 'c' + care.id : 't' + (care.timeStamp || idx);
    },
    _brandListFor(care) {
      if (care.equipment === '单板') return this.data.boardBrandList;
      if (care.equipment === '双板') return this.data.skiBrandList;
      return [];
    },
    _othersServiceFor(care) {
      if (care.equipment === '单板') return this.data.boardOthersService;
      if (care.equipment === '双板') return this.data.skiOthersService;
      return [];
    },
    // 完整性校验（对齐旧 util.getCareWellFormMessage）
    evalCare(care) {
      if (!care.equipment) return { ok: false, label: '类型未选' };
      const hasImage = care.careImages && care.careImages.length > 0;
      const hasBrandScale = care.brand && care.scale;
      if (!hasImage && !hasBrandScale) return { ok: false, label: '图片或品牌长度必填' };
      const hasService = care.need_edge === 1 || care.need_wax === 1 || care.free_wax === 1
        || care.summer != null || (care.repair_charge && care.repair_charge > 0)
        || (care.ticket && (care.ticket.template_id === 17 || care.ticket.template_id === 18));
      if (!hasService) return { ok: false, label: '未选项目' };
      return { ok: true, label: '已录入' };
    },
    // 服务 chips 文案（折叠态一眼看清做什么）
    _svcChips(care) {
      const chips = [];
      if (care.summer === 'now') chips.push('非雪季·寄存');
      else if (care.summer === 'later') chips.push('非雪季·先双项');
      else {
        if (care.need_edge === 1 && care.need_wax === 1) chips.push('双项');
        else if (care.need_edge === 1) chips.push('修刃');
        else if (care.need_wax === 1) chips.push('热蜡');
        if (care.free_wax === 1) chips.push('机打蜡');
        if (care.need_unwax === 1 && care.need_wax !== 1) chips.push('刮蜡');
        if (care.urgent === 1) chips.push('立等');
      }
      if (care.repair_memo) chips.push('维修');
      if (care.entertain) chips.push('招待');
      if (care.warranty) chips.push('质保');
      if (care.ticket_code) chips.push('券');
      else if (care.use_card) chips.push('卡');
      return chips;
    },
    computeCharge(care) {
      const common = care.common_charge || 0;
      const repair = care.repair_charge || 0;
      const discount = care.discount || 0;
      let summary = common + repair - discount;
      if (care.warranty || care.entertain) summary = 0;
      care._summary = Math.round(summary * 100) / 100;
      care._summaryStr = util.showAmount(care._summary);
    },
    _refreshCares() {
      const that = this;
      const raw = (this.data.cares || []).slice();
      const expandedMap = this.data.expandedMap || {};
      this.data.expandedMap = expandedMap;
      const displayCares = raw.map((care, idx) => {
        const key = that._careKey(care, idx);
        // 找回中断单时后端 careImages 只带 image 导航对象，没有 van-uploader 需要的 url/thumb，补齐
        (care.careImages || []).forEach((im) => {
          if (!im.url && im.image && im.image.file_path_name) {
            im.url = im.image.file_path_name.indexOf('http') === 0
              ? im.image.file_path_name : UPLOAD_HOST + im.image.file_path_name;
            const t = im.image.thumbUrl || im.image.file_path_name;
            im.thumb = t.indexOf('http') === 0 ? t : UPLOAD_HOST + t;
          }
        });
        const ev = that.evalCare(care);
        that.computeCharge(care);
        // 展开状态：手动开合记录优先；无记录时「未录入完整」默认展开，并把展开态写入 expandedMap。
        // 写入是关键——录入过程中任何字段变化（选类型/品牌/项目/照片）都会触发保存回填重渲染，
        // 甚至录入完整后 ev.ok 翻真，若每次都按默认规则现算，卡片会被自动折叠打断录入。
        // 记住展开态后，只有用户手动点头部才会收起（2026-07-08 用户拍板：录入中永不自动折叠）
        let expanded = expandedMap[key];
        if (expanded === undefined) {
          expanded = !ev.ok;
          if (expanded) expandedMap[key] = true;
        }
        const brandDisp = care.brand ? String(care.brand).split('/')[0] : '';
        const titleParts = [];
        titleParts.push(care.equipment || '待选类型');
        if (brandDisp) titleParts.push(brandDisp);
        if (care.scale) titleParts.push(care.scale + 'cm');
        // 品牌 picker 选中下标
        const brandList = that._brandListFor(care);
        let brandIndex = null;
        for (let i = 0; i < brandList.length; i++) {
          if (brandList[i].displayedName === care.brand) { brandIndex = i; break; }
        }
        // 其它服务选中态：WXML 不支持方法调用，预置 on 布尔标记
        const memoArr = (care.repair_memo || '').split(',').filter((s) => s !== '');
        const othersView = that._othersServiceFor(care).map((name) => ({
          name,
          on: memoArr.indexOf(name) >= 0,
        }));
        return {
          ...care,
          _key: key,
          _expanded: expanded,
          _entered: ev.ok,
          _statusLabel: ev.label,
          _title: titleParts.join(' · '),
          _svcChipsView: that._svcChips(care),
          _brandIndex: brandIndex,
          _brandListView: brandList.map((b) => b.displayedName).concat(['＋ 新增品牌']),
          _othersView: othersView,
          _commonChargeStr: util.showAmount(care.common_charge || 0),
          _repairChargeStr: String(care.repair_charge || 0),
          _discountStr: String(care.discount || 0),
          _specialKey: care.entertain ? 'entertain' : (care.warranty ? 'warranty' : 'none'),
          _hasFreeWaxTicket: !!(care.ticket && care.ticket.template_id === 12),
        };
      });
      const count = displayCares.length;
      let total = 0;
      displayCares.forEach((c) => { total += c._summary || 0; });
      total = Math.round(total * 100) / 100;
      const canCheckout = count > 0 && displayCares.every((c) => c._entered);
      this.setData({
        displayCares,
        summary: { count, totalLabel: total.toFixed(2), canCheckout },
      });
    },
    /* ---------- 同步父页 ---------- */
    // 去掉 _ 前缀派生字段和纯前端对象（ticket/product 保留 ticket_code 等标量即可）
    _stripUI(care) {
      const copy = {};
      Object.keys(care).forEach((k) => {
        if (k.indexOf('_') === 0) return;
        if (k === 'product' || k === 'order' || k === 'tasks') return;
        copy[k] = care[k];
      });
      return copy;
    },
    _emitSync(needUpdate) {
      const cares = this.data.displayCares.map((c) => this._stripUI(c));
      this.triggerEvent('syncCare', { cares, needUpdate: !!needUpdate });
    },
    // 修改某个 care 的字段后：写回 cares 数组 → 刷新派生 → 同步
    _mutate(cidx, mutator, needUpdate = true) {
      const cares = (this.data.cares || []).slice();
      if (!cares[cidx]) return;
      const care = { ...this.data.displayCares[cidx] };
      mutator(care);
      cares[cidx] = care;
      this.data.cares = cares;
      this._refreshCares();
      this._emitSync(needUpdate);
    },
    /* ---------- 计费（服务端计算，与 PlaceCareOrder 共用 CareController.CalcCharge；
       附加费/减免由 computeCharge 在服务费之上累加） ---------- */
    _fetchPrice(cidx) {
      const that = this;
      const care = this.data.displayCares[cidx];
      if (!care) return;
      // 提交剥离 UI 字段的 care（含项目/券码/use_card/summer 等），导航对象与照片置空瘦身
      const payload = this._stripUI(care);
      payload.ticket = null;
      payload.product = null;
      payload.careImages = null;
      // 防竞态：按卡片 key 记序号，过期响应丢弃；响应时按 key 反查下标（防中途增删卡片下标漂移）
      const key = care._key || 'i' + cidx;
      this._priceSeqMap = this._priceSeqMap || {};
      const seq = (this._priceSeqMap[key] || 0) + 1;
      this._priceSeqMap[key] = seq;
      data.calcCareChargePromise(this.data.shop, this.data.memberId || null, payload, app.globalData.sessionKey)
        .then((res) => {
          if (that._priceSeqMap[key] !== seq) return;
          const idx = that.data.displayCares.findIndex((c) => (c._key || '') === key);
          if (idx < 0) return;
          that._mutate(idx, (c) => {
            c.common_charge = (res && res.commonCharge) || 0;
            c.product = null;
            // 券16 减免由服务端算（双项30/单项20）；非16券绝不回写，保住店员手动减免
            if (c.ticket && c.ticket.template_id === 16) {
              c.discount = (res && res.ticketDiscount) || 0;
            }
          });
        })
        .catch(() => {
          if (that._priceSeqMap[key] !== seq) return;
          const idx = that.data.displayCares.findIndex((c) => (c._key || '') === key);
          if (idx < 0) return;
          that._mutate(idx, (c) => { c.common_charge = 0; });
        });
    },
    /* ---------- 卡片开合 / 增删 ---------- */
    onToggleCare(e) {
      const key = e.currentTarget.dataset.key;
      const expandedMap = { ...this.data.expandedMap };
      const cur = this.data.displayCares.find((c) => c._key === key);
      expandedMap[key] = !(cur && cur._expanded);
      this.data.expandedMap = expandedMap;
      this._refreshCares();
    },
    onAddCare() {
      const cares = (this.data.cares || []).slice();
      cares.push(blankCare());
      this.data.cares = cares;
      this._refreshCares();
      this._emitSync(true);
    },
    onDeleteCare(e) {
      const that = this;
      const cidx = Number(e.currentTarget.dataset.idx);
      const care = this.data.displayCares[cidx];
      wx.showModal({
        title: '删除装备',
        content: '确认删除「' + ((care && care._title) || '该装备') + '」？',
        confirmColor: '#e64340',
        success(res) {
          if (!res.confirm) return;
          const cares = (that.data.cares || []).slice();
          cares.splice(cidx, 1);
          that.data.cares = cares;
          that._refreshCares();
          that._emitSync(true);
        },
      });
    },
    /* ---------- 装备信息 ---------- */
    onEquipTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const equip = e.currentTarget.dataset.equip;
      const cur = this.data.displayCares[cidx];
      if (cur && cur.equipment === equip) return; // 重复点同类型：不动数据也不弹历史
      this._mutate(cidx, (c) => {
        c.equipment = equip;
        // 换类型后品牌/其它服务字典跟随切换，原选择作废
        c.brand = null;
        c.repair_memo = null;
        c.need_repair = 0;
      });
      this._maybeShowHistory(cidx, equip);
    },
    /* ---------- 历史装备弹层：会员 + 有同类型养护记录才弹 ---------- */
    _maybeShowHistory(cidx, equip) {
      const that = this;
      const memberId = this.data.memberId;
      if (!memberId) return; // 散客：直接在页面上填品牌/长度
      data.getMemberCaredEquipmentsPromise(memberId, equip, app.globalData.sessionKey).then((list) => {
        list = list || [];
        // 异步返回时确认该装备的类型没有再被切换
        const cur = that.data.displayCares[cidx];
        if (!cur || cur.equipment !== equip) return;
        if (list.length === 0) return; // 无历史记录：不弹，走页面填写
        const view = list.map((it) => ({
          ...it,
          _brandDisp: it.brand ? String(it.brand).split('/')[0] : '',
          _dateStr: it.last_care_date ? String(it.last_care_date).slice(0, 10) : '',
        }));
        const brandListView = that._brandListFor({ equipment: equip }).map((b) => b.displayedName);
        that.setData({
          historyModal: {
            show: true, cidx, equip, list: view,
            brandListView, brandIndex: null, brand: '', scale: '',
          },
        });
      }).catch(() => {}); // 查询失败静默降级为页面填写
    },
    onHistoryPick(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      const m = this.data.historyModal;
      const item = m.list[idx];
      if (!item) return;
      this._mutate(m.cidx, (c) => {
        c.brand = item.brand || null;
        c.scale = item.scale || null;
      });
      this.setData({ 'historyModal.show': false });
    },
    onHistoryBrandChange(e) {
      const idx = Number(e.detail.value);
      const name = this.data.historyModal.brandListView[idx];
      this.setData({ 'historyModal.brandIndex': idx, 'historyModal.brand': name || '' });
    },
    onHistoryScaleInput(e) {
      this.setData({ 'historyModal.scale': e.detail.value });
    },
    onHistoryManualConfirm() {
      const m = this.data.historyModal;
      const brand = (m.brand || '').trim();
      const scale = (m.scale || '').trim();
      if (!brand || !scale) {
        wx.showToast({ title: '请选择品牌并填写长度', icon: 'none' });
        return;
      }
      this._mutate(m.cidx, (c) => {
        c.brand = brand;
        c.scale = scale;
      });
      this.setData({ 'historyModal.show': false });
    },
    onHistoryClose() {
      // 跳过：不改动 care，店员回到页面上照常填写
      this.setData({ 'historyModal.show': false });
    },
    onBrandChange(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const idx = Number(e.detail.value);
      const care = this.data.displayCares[cidx];
      const brandList = this._brandListFor(care);
      if (idx >= brandList.length) {
        // 最后一项「＋ 新增品牌」
        this.setData({ addBrand: { show: true, cidx, name: '', chineseName: '' } });
        return;
      }
      this._mutate(cidx, (c) => { c.brand = brandList[idx].displayedName; });
    },
    onAddBrandInput(e) {
      const field = e.currentTarget.dataset.field;
      this.setData({ ['addBrand.' + field]: e.detail.value });
    },
    onAddBrandCancel() {
      this.setData({ 'addBrand.show': false });
    },
    onAddBrandConfirm() {
      const that = this;
      const { cidx, name, chineseName } = this.data.addBrand;
      if (!name) {
        wx.showToast({ title: '必须填写英文名称', icon: 'none' });
        return;
      }
      const care = this.data.displayCares[cidx];
      if (!care || !care.equipment) return;
      const url = app.globalData.requestPrefix + 'Care/UpdateBrandByStaff?type=' + encodeURIComponent(care.equipment)
        + '&brandName=' + encodeURIComponent(name) + '&chineseName=' + encodeURIComponent(chineseName || '')
        + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
      util.performWebRequest(url, null).then((brandList) => {
        const patch = care.equipment === '单板' ? { boardBrandList: brandList || [] } : { skiBrandList: brandList || [] };
        that.setData({ ...patch, 'addBrand.show': false });
        const added = (brandList || []).find((b) => b.brand_name === name);
        that._mutate(cidx, (c) => { c.brand = added ? added.displayedName : (name + '/' + (chineseName || '')); });
      }).catch(() => {
        wx.showToast({ title: '新增品牌失败', icon: 'none' });
      });
    },
    onFieldBlur(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const field = e.currentTarget.dataset.field;
      const value = e.detail.value;
      this._mutate(cidx, (c) => { c[field] = value === '' ? null : value; });
    },
    /* ---------- 服务项 ---------- */
    onSvcToggle(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const flag = e.currentTarget.dataset.flag;
      const care = this.data.displayCares[cidx];
      if (!care) return;
      if (care.summer != null && (flag === 'need_edge' || flag === 'need_wax' || flag === 'need_unwax' || flag === 'urgent')) {
        wx.showToast({ title: '非雪季养护项目固定', icon: 'none' });
        return;
      }
      this._mutate(cidx, (c) => {
        const cur = c[flag] === 1 ? 0 : 1;
        c[flag] = cur;
        if (flag === 'need_edge' && cur === 1 && !c.edge_degree) c.edge_degree = '89';
        if (flag === 'need_wax') {
          c.need_unwax = cur; // 热蜡默认连带刮蜡（对齐旧逻辑）
          if (cur === 1) c.free_wax = 0;
        }
        if (flag === 'free_wax' && cur === 1) {
          c.need_wax = 0;
          c.need_unwax = 0;
        }
      });
      this._fetchPrice(cidx);
    },
    onSummerTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const mode = e.currentTarget.dataset.mode; // 'now' | 'later'
      this._mutate(cidx, (c) => {
        c.summer = c.summer === mode ? null : mode;
        if (c.summer === 'later') {
          c.need_edge = 1; c.need_wax = 1; c.need_unwax = 1;
        } else if (c.summer === 'now') {
          c.need_edge = 0; c.need_wax = 0; c.need_unwax = 0;
        }
        if (c.summer != null) {
          c.urgent = 0;
          if (!c.edge_degree) c.edge_degree = '89';
        }
      });
      this._fetchPrice(cidx);
    },
    onOthersToggle(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const name = e.currentTarget.dataset.name;
      this._mutate(cidx, (c) => {
        let arr = (c.repair_memo || '').split(',').filter((s) => s !== '');
        if (arr.indexOf(name) >= 0) arr = arr.filter((s) => s !== name);
        else arr.push(name);
        c.repair_memo = arr.length > 0 ? arr.join(',') : null;
        c.need_repair = arr.length > 0 ? 1 : 0;
        if (!c.repair_memo) c.repair_charge = 0;
      });
    },
    onOthersMemoBlur(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const value = (e.detail.value || '').trim();
      if (!value) return;
      this._mutate(cidx, (c) => {
        c.repair_memo = c.repair_memo ? c.repair_memo + ',' + value : value;
        c.need_repair = 1;
      });
    },
    onSpecialTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const key = e.currentTarget.dataset.special; // none | entertain | warranty
      this._mutate(cidx, (c) => {
        c.entertain = key === 'entertain';
        c.warranty = key === 'warranty';
      });
    },
    /* ---------- 金额 modal（附加费 / 减免） ---------- */
    onAmountTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const field = e.currentTarget.dataset.field; // repair_charge | discount
      const care = this.data.displayCares[cidx];
      if (!care) return;
      if (field === 'repair_charge' && !care.repair_memo) {
        wx.showToast({ title: '请先勾选维修项目', icon: 'none' });
        return;
      }
      this.setData({
        amountModal: {
          show: true,
          title: field === 'repair_charge' ? '附加费' : '减免金额',
          placeholder: '0',
          value: '',
          cidx,
          field,
        },
      });
    },
    onAmountModalInput(e) {
      this.setData({ 'amountModal.value': e.detail.value });
    },
    onAmountModalCancel() {
      this.setData({ 'amountModal.show': false });
    },
    onAmountModalConfirm() {
      const { cidx, field, value } = this.data.amountModal;
      const v = parseFloat(value);
      if (isNaN(v) || v < 0) {
        wx.showToast({ title: '请输入有效金额', icon: 'none' });
        return;
      }
      this.setData({ 'amountModal.show': false });
      this._mutate(cidx, (c) => { c[field] = v; });
    },
    /* ---------- 照片（对齐旧 afterRead/delImage，即传即得 image_id） ---------- */
    onPhotoRead(e) {
      const that = this;
      const cidx = Number(e.currentTarget.dataset.cidx);
      const uploadFile = e.detail.file;
      const pending = {
        id: 0,
        care_id: 0,
        image_id: 0,
        status: 'uploading',
        message: '上传中',
        url: uploadFile.tempFilePath,
        thumb: uploadFile.thumb || uploadFile.tempFilePath,
      };
      this._mutate(cidx, (c) => {
        c.careImages = (c.careImages || []).concat([pending]);
      }, false);
      data.uploadFilePromise(null, uploadFile.tempFilePath, '养护开单', uploadFile.type, app.globalData.sessionKey)
        .then((uploaded) => data.uploadFilePromise(uploaded.id, uploadFile.thumb || uploadFile.tempFilePath, null, null, app.globalData.sessionKey))
        .then((withThumb) => {
          that._mutate(cidx, (c) => {
            const imgs = (c.careImages || []).slice();
            const i = imgs.findIndex((im) => im.status === 'uploading');
            if (i >= 0) {
              imgs[i] = {
                id: 0,
                care_id: c.id || 0,
                image_id: withThumb.id,
                status: 'success',
                url: withThumb.file_path_name && withThumb.file_path_name.indexOf('http') === 0
                  ? withThumb.file_path_name : UPLOAD_HOST + withThumb.file_path_name,
                thumb: withThumb.thumbUrl && withThumb.thumbUrl.indexOf('http') === 0
                  ? withThumb.thumbUrl : UPLOAD_HOST + (withThumb.thumbUrl || withThumb.file_path_name),
              };
            }
            c.careImages = imgs;
          });
        })
        .catch(() => {
          wx.showToast({ title: '照片上传失败', icon: 'none' });
          that._mutate(cidx, (c) => {
            c.careImages = (c.careImages || []).filter((im) => im.status !== 'uploading');
          }, false);
        });
    },
    onPhotoDelete(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const index = e.detail.index;
      this._mutate(cidx, (c) => {
        c.careImages = (c.careImages || []).filter((im, i) => i !== index);
      });
    },
    /* ---------- 优惠券 ---------- */
    onTicketTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      if (!this.data.memberId) {
        wx.showToast({ title: '散客无可用优惠券', icon: 'none' });
        return;
      }
      const care = this.data.displayCares[cidx];
      const disabledCodes = this.data.displayCares
        .filter((c, i) => i !== cidx && c.ticket_code)
        .map((c) => c.ticket_code);
      this.setData({
        ticketPopup: {
          show: true, cidx,
          selectedCode: (care && care.ticket_code) || null,
          selectedCardId: (care && care.use_card && care.card_id) || null,
          disabledCodes,
        },
      });
    },
    onTicketSelectorEvent(e) {
      const that = this;
      const cidx = this.data.ticketPopup.cidx;
      if (e.detail.action !== 'confirm') {
        this.setData({ 'ticketPopup.show': false });
        return;
      }
      const ticket = e.detail.selectedTicket || null;
      const card = e.detail.selectedCard || null;
      this.setData({ 'ticketPopup.show': false });
      this._mutate(cidx, (c) => {
        // 更改券/卡（含改选「不使用」）时：先清空已选服务，再套用新选择约定的默认项（用户 2026-07-09 拍板）。
        // 清空范围 = 养护项目行 + 非雪季状态 + 减免（减免可能来自折扣券 16，区分不了来源、一并清）；
        // 立等/维修/质保/招待与券无关，保留
        c.need_edge = 0;
        c.edge_degree = null;
        c.need_wax = 0;
        c.need_unwax = 0;
        c.free_wax = 0;
        c.summer = null;
        if (c.biz_type === '非雪季养护') c.biz_type = null;
        c.discount = 0;
        if (card) {
          // 选会员卡：与券互斥，清券侧字段；落 use_card（后端持久化）+ 卡展示标量
          c.ticket = null;
          c.ticket_code = null;
          c.use_card = true;
          c.card_id = card.id;
          c.card_name = card.card_name;
          // 默认服务：双项卡 → 修刃+热蜡+刮蜡；单项次卡不默认；「季卡」暂不默认（未来另有定义）
          const cname = card.card_name || '';
          if (cname.indexOf('双项') >= 0) {
            c.need_edge = 1;
            c.edge_degree = '89';
            c.need_wax = 1;
            c.need_unwax = 1;
          }
        } else if (ticket) {
          c.use_card = false;
          c.card_id = null;
          c.card_name = null;
          c.ticket = ticket;
          c.ticket_code = ticket.code;
          if (ticket.template_id === 12) {
            c.free_wax = 1;
          } else if (ticket.template_id === 17) {
            c.summer = 'now';
            c.biz_type = '非雪季养护';
          } else if (ticket.template_id === 18) {
            c.need_edge = 1;
            c.edge_degree = '89';
            c.need_wax = 1; c.need_unwax = 1;
            c.summer = 'later';
            c.biz_type = '非雪季养护';
          }
        } else {
          c.ticket = null;
          c.ticket_code = null;
          c.use_card = false;
          c.card_id = null;
          c.card_name = null;
        }
      });
      that._fetchPrice(cidx);
    },
    /* ---------- 结算 ---------- */
    onCheckout() {
      if (!this.data.summary.canCheckout) return;
      const cares = this.data.displayCares.map((c) => this._stripUI(c));
      this.triggerEvent('checkout', { cares });
    },
  },
});
