// components/reception/care_recept_form/care_recept_form.js
// 养护接待开单表单（业务数据结构对齐旧版 components/care/care_recept.js，
// 交互/视觉对齐 components/reception/rent_recept_form）
// 组件契约（镜像 rent_recept_form）：
//   - properties.cares      父页传入的当前购物车（care 数组）
//   - properties.shop       店铺名（定价用）
//   - properties.memberId   会员 id（优惠券选择用）
//   - triggerEvent('syncCare', { cares, needUpdate })   购物车变化，父页调 saveCareReceptOrder
//   - triggerEvent('checkout', { cares, useDeposit })   点击去结算（useDeposit=店员勾选的用储值意向）
// 字段名以后端 Models/Care/Care.cs 为准（snake_case；warranty/entertain 是 bool；
// 旧前端 left_angel 拼写错误，后端是 left_angle——本组件不采集安检字段，安检数据在任务环节录入）
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');
const cardRules = require('../../../utils/careCardSale.js');

// 与 data.js uploadFilePromise 的上传域名保持一致（文件落在处理上传那台服务器的磁盘）
const UPLOAD_HOST = data.IMAGE_HOST;

function uploadUrl(value) {
  if (!value) return '';
  return /^(https?:|wxfile:)/.test(value) ? value : UPLOAD_HOST + value;
}

// 万龙服务中心「只选了刮蜡」：一口价（服务端定价），不选任何券、会员卡、学员卡。
// 这里只用来决定「要不要自动带老顾客券」；价格、以及已选券卡的清除都以服务端 CalcCareCharge 为准
// （后端 CarePricingRules.AppliesScrapeOnlyPrice 同一口径：先把万龙体验中心归并到服务中心）。
function isScrapeOnlyCare(care, shop) {
  const name = String(shop || '').trim();
  if (!care || (name !== '万龙服务中心' && name !== '万龙体验中心')) return false;
  return care.need_unwax === 1 && care.need_edge !== 1 && care.need_wax !== 1 && care.free_wax !== 1
    && !care.summer && !care.warranty && !care.entertain;
}

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
    coach_card_id: null,   // 学员卡（某某教练的学员卡）：与券/会员卡互斥，随草稿持久化；显示名 _coachCardName 来自计价响应
    card_equip_lock: false, // 限装备季卡带入的装备信息锁（前端标量，同上）
    common_charge: 0,
    memo: null,
    others_associates: null,
    careImages: [],
    valid: 0,
    timeStamp: Date.now(),
  };
}

// 学员卡档位：修刃、热打蜡各算一项（与服务端 CarePricingRules.CountChargeableItems 一致），两项=双项，一项=单项
function coachTier(care) {
  const n = (care && care.need_edge ? 1 : 0) + (care && care.need_wax ? 1 : 0)
  return n >= 2 ? '双项' : (n === 1 ? '单项' : '')
}

Component({
  options: { multipleSlots: false },
  properties: {
    shop: { type: String, value: '' },
    memberId: {
      type: null,
      value: null,
      observer(v) { this._loadDeposit(v); this._loadMachineWaxAvailability(v); this._scheduleOldCustomerTicket(); },
    },
    cares: { type: Array, value: [] },
    cardPreview: { type: Object, value: null },
    cardError: { type: String, value: '' },
    cardBusy: { type: Boolean, value: false },
    cardSubmitted: { type: Boolean, value: false },
    hasCardSelection: { type: Boolean, value: false },
    newCardMode: { type: String, value: '', observer(mode, previous) {
      this._priceSeqMap = {}; // 丢弃选卡之前仍在飞的普通计价响应。
      this._refreshCares();
      if (!mode && previous) (this.data.displayCares || []).forEach((c, i) => this._fetchPrice(i));
    } },
  },
  data: {
    displayCares: [],
    autoTicketCheckout: false,
    pricePending: false,
    priceError: false,
    hasMachineWaxTicket: false,
    summary: { count: 0, totalLabel: '0.00', canCheckout: false },
    // 会员储值（会员且有余额时结算条上方显示 + 「使用储值」复选框；本期仅记录意向，实际扣款后续规划）
    hasDeposit: false,
    depositAvailableStr: '',
    useDeposit: false,
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
    ticketPopup: { show: false, cidx: -1, selectedCode: null, selectedCardId: null, selectedCoachCardId: null, disabledCodes: [], tier: '', commonCharge: 0, urgent: 0 },
    // 历史装备弹层：会员选定装备类型后，列出其养护过的同类型装备供直接选择；
    // 也可在弹层里手动选品牌 + 填长度（列表里没有的新装备）
    historyModal: { show: false, cidx: -1, equip: '', list: [], brandListView: [], brandIndex: null, brand: '', scale: '' },
    expandedMap: {},
  },
  observers: {
    cares() { this._refreshCares(); },
    'shop, memberId'() { this._scheduleAllCarePrices(); },
    'hasCardSelection, cardBusy, cardSubmitted'() { this._scheduleOldCustomerTicket(); this._scheduleAllCarePrices(); },
  },
  lifetimes: {
    attached() {
      this._ticketAutoDetached = false;
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
      this._loadMachineWaxAvailability(this.data.memberId);
      this._scheduleOldCustomerTicket();
    },
    detached() {
      this._ticketAutoDetached = true;
      this._oldCustomerTicketState = null;
      this._memberCareTicketsLoad = null;
      this._memberCareCardsLoad = null;
    },
  },
  methods: {
    onAddCard() {
      if (this.data.cardBusy) return;
      const cares = this.data.displayCares || [];
      if (!cares.length || cares.some(c => !c.equipment || (!(c.careImages || []).length && !(c.brand && c.scale)))) {
        wx.showToast({ title: '请先完整填写装备信息', icon: 'none' }); return;
      }
      this.triggerEvent('addCard');
    },
    onRemoveCards() { this.triggerEvent('removeCards'); },
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
      const hasService = care.need_edge === 1 || care.need_wax === 1 || care.free_wax === 1 || care.need_unwax === 1
        || care.need_repair === 1 || !!care.repair_memo
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
        const oldKey = 't' + care.timeStamp;
        if (care.timeStamp && that._manualTicketChoices && that._manualTicketChoices[oldKey]) {
          that._manualTicketChoices[key] = true;
        }
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
        if (expanded === undefined && care.timeStamp) {
          // key 漂移迁移：首次落库 id 0→真实 id 后 key 从 't'+timeStamp 变 'c'+id，
          // 把旧 key 的展开记录搬过来——否则选卡/选券让表单变「已录入」时，
          // 保存回来 key 一换记录丢失、卡片被默认规则自动折叠（2026-07-09 用户反馈）
          const oldKey = 't' + care.timeStamp;
          if (oldKey !== key && expandedMap[oldKey] !== undefined) {
            expanded = expandedMap[oldKey];
            expandedMap[key] = expanded;
            delete expandedMap[oldKey];
          }
        }
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
        // 未开卡的季卡：提示店员这次养护的装备会被写进卡、从此这张卡只能给这块板用。
        // 文案随装备录入实时变，装备没填全时明确说还缺什么（缺了服务端不会开卡）
        let cardOpenHint = '';
        if (care.card_pending_open) {
          const equipParts = [];
          if (care.equipment) equipParts.push(care.equipment);
          if (brandDisp) equipParts.push(brandDisp);
          if (care.scale) equipParts.push(care.scale + 'cm');
          const missing = [];
          if (!care.equipment) missing.push('类型');
          if (!care.brand) missing.push('品牌');
          if (!care.scale) missing.push('长度');
          cardOpenHint = missing.length > 0
            ? '该季卡尚未开卡，将按本次装备开卡。请先补全' + missing.join('、') + '。'
            : '该季卡尚未开卡：订单生效后将绑定到「' + equipParts.join(' · ') + '」，此后仅限该装备使用。';
        }
        return {
          ...care,
          _key: key,
          _expanded: expanded,
          _entered: ev.ok,
          _statusLabel: ev.label,
          _cardOpenHint: cardOpenHint,
          _title: titleParts.join(' · '),
          _svcChipsView: that._svcChips(care),
          _brandIndex: brandIndex,
          _brandListView: brandList.map((b) => b.displayedName).concat(['＋ 新增品牌']),
          _othersView: othersView,
          _commonChargeStr: util.showAmount(care.common_charge || 0),
          _repairChargeStr: String(care.repair_charge || 0),
          _discountStr: String(care.discount || 0),
          _specialKey: care.entertain ? 'entertain' : (care.warranty ? 'warranty' : 'none'),
          // 券或未绑季卡对每套装备开放；已绑季卡只对匹配绑定信息的装备开放。
          _hasFreeWaxTicket: that._canShowMachineWax(care),
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
      this._scheduleOldCustomerTicket();
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
    _mutate(cidx, mutator, needUpdate = true, recalculate = true) {
      if (this.data.cardSubmitted || this.data.cardBusy) return;
      const cares = (this.data.cares || []).slice();
      if (!cares[cidx]) return;
      const care = { ...this.data.displayCares[cidx] };
      mutator(care);
      cares[cidx] = care;
      this.data.cares = cares;
      this._refreshCares();
      if (recalculate) this._scheduleCarePrice(cidx);
      this._emitSync(needUpdate);
    },
    _priceIdentity(care, index) {
      return { id: care.id || 0, timeStamp: care.timeStamp, key: care._key || this._careKey(care, index) };
    },
    _findPriceCare(identity) {
      return this.data.displayCares.findIndex((c, i) => identity.id > 0 ? c.id === identity.id
        : identity.timeStamp ? c.timeStamp === identity.timeStamp : (c._key || this._careKey(c, i)) === identity.key);
    },
    _trackCarePrice(promise) {
      const work = Promise.resolve(promise);
      const jobs = this._carePriceWork || (this._carePriceWork = new Set());
      jobs.add(work);
      if (!this._ticketAutoDetached) this.setData({ pricePending: true });
      const done = () => {
        jobs.delete(work);
        if (!this._ticketAutoDetached) this.setData({ pricePending: jobs.size > 0 });
      };
      work.then(done, done);
      return work;
    },
    _scheduleCarePrice(cidx) {
      if (this._ticketAutoDetached || !this.data.shop || this.data.newCardMode || this.data.hasCardSelection
        || this.data.cardBusy || this.data.cardSubmitted) return;
      const care = this.data.displayCares[cidx];
      if (!care) return;
      const identity = this._priceIdentity(care, cidx);
      const queued = this._queuedCarePrices || (this._queuedCarePrices = {});
      if (queued[identity.key]) return queued[identity.key].promise;
      const record = { identity };
      queued[identity.key] = record;
      this._priceSeqMap = this._priceSeqMap || {};
      this._priceSeqMap[identity.key] = this._priceSeqCounter = (this._priceSeqCounter || 0) + 1;
      record.promise = this._trackCarePrice(Promise.resolve().then(() => {
        if (queued[identity.key] !== record || this._ticketAutoDetached) return;
        delete queued[identity.key];
        const index = this._findPriceCare(identity);
        if (index >= 0) return this._fetchPrice(index);
      }).catch(() => { if (!this._ticketAutoDetached) this.setData({ priceError: true }); }));
      return record.promise;
    },
    _scheduleAllCarePrices() {
      (this.data.displayCares || []).forEach((c, i) => this._scheduleCarePrice(i));
    },
    async waitForPrices() {
      await Promise.resolve(); // 先启动当前事件内合并的计价任务。
      while (!this._ticketAutoDetached && !this.data.newCardMode && !this.data.hasCardSelection
        && this._carePriceWork && this._carePriceWork.size) {
        await Promise.all(Array.from(this._carePriceWork));
      }
      if (!this.data.newCardMode && !this.data.hasCardSelection
        && this.data.displayCares.some(c => this._needsMachineWaxBenefit(c))) {
        throw new Error('机打蜡权益未确认，请重试');
      }
      if (this.data.priceError && !this.data.hasCardSelection) throw new Error('养护计价失败，请重新计算');
    },
    onRetryPrices() { this._scheduleAllCarePrices(); },
    /* ---------- 计费（服务端计算，与 PlaceCareOrder 共用 CareController.CalcCharge；
       附加费/减免由 computeCharge 在服务费之上累加）。
       opts.derive=true（换券/换卡时传）：服务项由服务端按新选择推导；
       opts.changed=字段名（服务开关等操作时传）：服务联动由服务端判定（如开热蜡带刮蜡）。
       响应返回整个 care，服务项/联动/计费结果以它为真理之源回填 ---------- */
    _fetchPrice(cidx, opts) {
      const that = this;
      const derive = !!(opts && opts.derive);
      const changed = (opts && opts.changed) || null;
      const care = this.data.displayCares[cidx];
      if (!care) return;
      const identity = this._priceIdentity(care, cidx);
      if (this._queuedCarePrices) delete this._queuedCarePrices[identity.key];
      // 提交剥离 UI 字段的 care（含项目/券码/use_card/summer 等），导航对象与照片置空瘦身
      const payload = this._stripUI(care);
      payload.ticket = null;
      payload.product = null;
      payload.careImages = null;
      // 学员卡：服务端对减免取「保底」，换服务项后旧的卡优惠不会自动降。所以带学员卡的重算请求里，
      // 把减免重置为店员手动录入的那部分（没录入 = 0），学员卡优惠由服务端按最新服务项补齐
      if (payload.coach_card_id && changed !== 'discount') payload.discount = Number(care._manualDiscount) || 0;
      // 防竞态：按卡片 key 记序号，过期响应丢弃；响应时按 key 反查下标（防中途增删卡片下标漂移）
      const key = identity.key;
      this._priceSeqMap = this._priceSeqMap || {};
      const seq = (this._priceSeqCounter || 0) + 1;
      this._priceSeqCounter = seq;
      this._priceSeqMap[key] = seq;
      if (this._ticketAutoDetached || this.data.newCardMode || this.data.hasCardSelection) return;
      if (this._needsMachineWaxBenefit(care)) return this._autoSelectMachineWaxBenefit(cidx);
      this.setData({ priceError: false });
      // 全量状态整包提交（用户 2026-07-09 拍板）：店铺/会员 + care 内装备/服务/券码/卡(card_id,card_name)/附加费。
      // 卡选择跟着单件装备（care）走，卡信息只在 care 内、不设平级字段
      const req = {
        shop: this.data.shop,
        memberId: this.data.memberId || null,
        deriveServices: derive,
        changedField: changed,
        care: payload,
      };
      return this._trackCarePrice(data.calcCareChargePromise(req, app.globalData.sessionKey)
        .then((res) => {
          if (that._ticketAutoDetached || that.data.newCardMode || that.data.hasCardSelection) return;
          if ((Number(that.data.memberId) || 0) !== (Number(req.memberId) || 0)) return;
          const idx = that._findPriceCare(identity);
          if (idx < 0) return;
          const currentKey = that.data.displayCares[idx]._key;
          if (Math.max(that._priceSeqMap[key] || 0, that._priceSeqMap[currentKey] || 0) !== seq) return;
          const rc = res && res.care;
          that._mutate(idx, (c) => {
            c.product = null;
            if (rc) {
              // 服务端返回的整个 care 是服务项/联动/计费的真理之源；
              // 只回填服务端会改的业务字段，本地 UI/展示对象（careImages/ticket/锁标志/装备录入值）不动
              c.need_edge = rc.need_edge || 0;
              c.edge_degree = rc.edge_degree || null;
              c.need_wax = rc.need_wax || 0;
              c.need_unwax = rc.need_unwax || 0;
              c.free_wax = rc.free_wax || 0;
              c.urgent = rc.urgent || 0;
              c.summer = rc.summer || null;
              c.biz_type = rc.biz_type || null;
              c.common_charge = rc.common_charge || 0;
              c.discount = rc.discount || 0;
              // 学员卡：显示名和本单优惠提示来自计价响应；没带 coach 字段 = 本单没享受（质保/招待/非雪季等）
              const coach = res && res.coach;
              if (c.coach_card_id) {
                if (coach) c._coachCardName = coach.coachName || c._coachCardName || '';
                c._coachHint = coach ? (coach.discount > 0 ? '学员卡优惠 −¥' + coach.discount : '这张学员卡在本单没有优惠')
                  : '质保、招待和非雪季养护不享受学员卡优惠';
              }
              // 只选刮蜡：服务端把已选的券 / 会员卡 / 学员卡（及随之带来的减免）摘掉了，本地同步清除，
              // 否则界面还挂着券、订单上却没有，店员会以为用上了
              if (res && res.benefitsCleared) {
                c.ticket = null;
                c.ticket_code = null;
                c.use_card = false;
                c.card_id = null;
                c.card_name = null;
                c.card_equip_lock = false;
                c.card_pending_open = false;
                c.coach_card_id = null;
                c._coachCardName = '';
                c._coachHint = '';
                c._manualDiscount = 0;
              }
            } else {
              c.common_charge = (res && res.commonCharge) || 0;
            }
          }, true, false);
          if (res && res.benefitsCleared) wx.showToast({ title: '只选刮蜡按一口价，已取消券和卡', icon: 'none' });
        })
        .catch(() => {
          if (that._ticketAutoDetached || that.data.newCardMode || that.data.hasCardSelection) return;
          if ((Number(that.data.memberId) || 0) !== (Number(req.memberId) || 0)) return;
          const idx = that._findPriceCare(identity);
          if (idx < 0) return;
          const currentKey = that.data.displayCares[idx]._key;
          if (Math.max(that._priceSeqMap[key] || 0, that._priceSeqMap[currentKey] || 0) !== seq) return;
          that.setData({ priceError: true });
        }));
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
      if (this.data.cardSubmitted || this.data.cardBusy) return;
      const cares = (this.data.cares || []).slice();
      if (this.data.newCardMode === 'machine' && cares.length) {
        wx.showToast({ title: '机打蜡季卡仅限一套装备，请先更换卡类', icon: 'none' }); return;
      }
      const care = blankCare();
      if (this.data.newCardMode === 'dual') {
        care.need_edge = care.need_wax = care.need_unwax = 1; care.edge_degree = '89';
      } else if (this.data.newCardMode === 'wax') care.need_wax = care.need_unwax = 1;
      else if (this.data.newCardMode === 'machine') care.free_wax = 1;
      cares.push(care);
      this.data.cares = cares;
      this._refreshCares();
      this._scheduleCarePrice(cares.length - 1);
      this._emitSync(true);
    },
    onDeleteCare(e) {
      if (this.data.cardSubmitted || this.data.cardBusy) return;
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
      if (cur && cur.card_equip_lock) {
        wx.showToast({ title: '该季卡已绑定装备，不可修改', icon: 'none' });
        return;
      }
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
          _photoUrl: uploadUrl(it.photoUrl),
          _photoPreviewUrl: uploadUrl(it.photoFullUrl || it.photoUrl),
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
    onHistoryPhotoTap(e) {
      const idx = Number(e.currentTarget.dataset.idx);
      const item = this.data.historyModal.list[idx];
      if (!item || !item._photoPreviewUrl) return;
      wx.previewImage({ current: item._photoPreviewUrl, urls: [item._photoPreviewUrl] });
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
      const cur = this.data.displayCares[cidx];
      if (field === 'scale' && cur && cur.card_equip_lock) return; // 限装备季卡：长度锁定
      this._mutate(cidx, (c) => { c[field] = value === '' ? null : value; });
    },
    /* ---------- 服务项 ---------- */
    onSvcToggle(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const flag = e.currentTarget.dataset.flag;
      const care = this.data.displayCares[cidx];
      if (!care) return;
      const mode = this.data.newCardMode;
      if (mode) {
        if (!['need_edge', 'need_wax', 'need_unwax', 'free_wax', 'urgent'].includes(flag)) return;
        this._mutate(cidx, c => {
          c[flag] = c[flag] === 1 ? 0 : 1;
          if (flag === 'need_wax') c.need_unwax = c.need_wax;
          if (c.need_edge === 1 && !c.edge_degree) c.edge_degree = '89';
          if (c.need_edge !== 1) c.edge_degree = null;
        });
        return;
      }
      if (care.summer != null && (flag === 'need_edge' || flag === 'need_wax' || flag === 'need_unwax' || flag === 'urgent')) {
        wx.showToast({ title: '非雪季养护项目固定', icon: 'none' });
        return;
      }
      // 只翻本次点的开关；联动（热蜡带刮蜡/机打蜡互斥/修刃默认角度）由服务端
      // ApplyServiceLinkage 判定，响应整个 care 回填
      if (flag === 'free_wax') this._rememberManualTicketChoice(cidx);
      const wasScrapeOnly = isScrapeOnlyCare(care, this.data.shop);
      this._mutate(cidx, (c) => {
        c[flag] = c[flag] === 1 ? 0 : 1;
      });
      this._fetchPrice(cidx, { changed: flag });
      // 刚从「只选刮蜡」变成别的组合：老顾客券之前因为一口价没带，现在补上
      if (wasScrapeOnly && !isScrapeOnlyCare(this.data.displayCares[cidx], this.data.shop)) this._scheduleOldCustomerTicket();
    },
    onSummerTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const mode = e.currentTarget.dataset.mode; // 'now' | 'later'
      // 只翻 summer 本身；later→三项 / now→清三项 / 取消立等 等联动由服务端判定
      this._mutate(cidx, (c) => {
        c.summer = c.summer === mode ? null : mode;
        if (this.data.newCardMode && c.summer != null) {
          c.need_edge = c.need_wax = c.need_unwax = c.summer === 'later' ? 1 : 0;
          c.urgent = 0;
        }
      });
      this._fetchPrice(cidx, { changed: 'summer' });
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
      this._mutate(cidx, (c) => { c[field] = v; if (field === 'discount') c._manualDiscount = v; });
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
    _availableMachineWaxCards(care, cards) {
      const memberId = Number(this.data.memberId) || 0;
      const list = cards || (this._machineWaxCardsMemberId === memberId ? this._machineWaxSeasonCards : []) || [];
      const text = value => value == null ? '' : String(value).trim();
      return list.filter(card => card && card.id && !card.usedToday && !card.is_refund
        && (card.member_id == null || Number(card.member_id) === memberId)
        && (!card.biz_type || card.biz_type === '养护')
        && (card.isSeason || card.total === null || (card.card_name || '').includes('季卡'))
        && cardRules.isMachineWaxSeasonCard(card.card_name, null))
        .filter(card => {
          const binding = [card.equip_type, card.equip_brand, card.equip_scale].map(text);
          if (!card.equipBound && binding.every(value => !value)) return true;
          return binding.every(Boolean) && binding[0] === text(care.equipment)
            && binding[1] === text(care.brand) && binding[2] === text(care.scale);
        });
    },
    _canShowMachineWax(care) {
      return this.data.newCardMode === 'machine' || this.data.hasMachineWaxTicket
        || this._availableMachineWaxCards(care).length > 0;
    },
    _hasMachineWaxBenefit(care) {
      const memberId = Number(this.data.memberId) || 0;
      const hasCard = care.use_card && care.card_id && cardRules.isMachineWaxSeasonCard(care.card_name, null)
        && (this._machineWaxCardsMemberId !== memberId
          || this._availableMachineWaxCards(care).some(card => Number(card.id) === Number(care.card_id)));
      return !!(hasCard || care.ticket_code && care.ticket && Number(care.ticket.template_id) === 12
        && (care.ticket.member_id == null || Number(care.ticket.member_id) === memberId));
    },
    _needsMachineWaxBenefit(care) {
      return care.free_wax === 1 && !care.warranty && !care.entertain && care.summer == null
        && !this._hasMachineWaxBenefit(care);
    },
    _autoSelectMachineWaxBenefit(cidx) {
      const memberId = Number(this.data.memberId) || 0;
      const identity = this._priceIdentity(this.data.displayCares[cidx], cidx);
      const pending = this._machineWaxSelections || (this._machineWaxSelections = {});
      if (pending[identity.key] && pending[identity.key].memberId === memberId) return pending[identity.key].promise;
      const selection = { memberId };
      pending[identity.key] = selection;
      const currentIndex = () => {
        if (pending[identity.key] !== selection || Number(this.data.memberId) !== memberId || this._autoTicketBlocked()) return -1;
        const index = this._findPriceCare(identity);
        return index >= 0 && this.data.displayCares[index].free_wax === 1 ? index : -1;
      };
      const work = Promise.resolve(app.loginPromiseNew).then(() => {
        if (!memberId) throw new Error('请先选择顾客');
        // 点击时重新读取，沿用服务端的券有效期和季卡今日使用状态。
        return Promise.all([
          this._getMemberCareCards(memberId, true).promise,
          data.getMemberTicketsPromise(memberId, '养护', true, app.globalData.sessionKey),
        ]);
      }).then(([cards, tickets]) => {
        const index = currentIndex();
        if (index < 0) return;
        const care = this.data.displayCares[index];
        if (this._hasMachineWaxBenefit(care)) return this._fetchPrice(index, { changed: 'free_wax' });
        const others = this.data.displayCares.filter((c, i) => i !== index && !c.is_cancel);
        const availableCards = this._availableMachineWaxCards(care, cards)
          .filter(card => !others.some(c => c.use_card && Number(c.card_id) === Number(card.id)))
          .sort((a, b) => Number(!!b.equipBound) - Number(!!a.equipBound) || Number(a.id) - Number(b.id));
        const availableTickets = (tickets || []).filter(ticket => ticket && ticket.code && Number(ticket.template_id) === 12
          && (ticket.member_id == null || Number(ticket.member_id) === memberId)
          && !others.some(c => c.ticket_code === ticket.code))
          .sort((a, b) => (a.expire_date || '9999').localeCompare(b.expire_date || '9999'));
        // 保留已有有效选择；否则优先季卡，再用最早到期的单次券。
        const existing = availableTickets.find(ticket => ticket.code === care.ticket_code);
        const card = existing ? null : availableCards[0];
        const ticket = existing || (!card && availableTickets[0]);
        if (!card && !ticket) throw new Error('没有可用于当前装备的机打蜡季卡或券');
        return this._applyTicketSelection(index, ticket || null, card || null, { preserveServices: true });
      }).catch(error => {
        if (currentIndex() < 0) return;
        this.setData({ priceError: true });
        wx.showToast({ title: error.message || '查询机打蜡权益失败，请重试', icon: 'none' });
      }).finally(() => {
        if (pending[identity.key] === selection) delete pending[identity.key];
      });
      selection.promise = this._trackCarePrice(work);
      return selection.promise;
    },
    _getMemberCareCards(memberId, refresh = false) {
      let load = this._memberCareCardsLoad;
      if (!refresh && load && load.memberId === memberId) return load;
      load = { memberId };
      this._memberCareCardsLoad = load;
      load.promise = Promise.resolve(app.loginPromiseNew)
        .then(() => data.getMemberCardsPromise(memberId, '养护', app.globalData.sessionKey))
        .then(cards => {
          if (!this._ticketAutoDetached && Number(this.data.memberId) === memberId && this._memberCareCardsLoad === load) {
            this._machineWaxCardsMemberId = memberId;
            this._machineWaxSeasonCards = cards || [];
            this._refreshCares();
          }
          return cards || [];
        }).catch(error => {
          if (this._memberCareCardsLoad === load) this._memberCareCardsLoad = null;
          throw error;
        });
      return load;
    },
    _getMemberCareTickets(memberId) {
      let load = this._memberCareTicketsLoad;
      if (load && load.memberId === memberId) return load;
      load = { memberId, sequence: (this._memberCareTicketsSequence || 0) + 1 };
      this._memberCareTicketsSequence = load.sequence;
      this._memberCareTicketsLoad = load;
      // 机打蜡可见性与老顾客券自动选择共用可用券查询，避免同一顾客重复请求。
      load.promise = Promise.resolve(app.loginPromiseNew)
        .then(() => data.getMemberTicketsPromise(memberId, '养护', true, app.globalData.sessionKey))
        .then(tickets => {
          const available = (tickets || []).filter(t => t && t.code
            && (t.member_id == null || Number(t.member_id) === memberId));
          if (!this._ticketAutoDetached && Number(this.data.memberId) === memberId && this._memberCareTicketsSequence === load.sequence) {
            const hasMachineWaxTicket = available.some(t => Number(t.template_id) === 12);
            if (hasMachineWaxTicket !== this.data.hasMachineWaxTicket) {
              this.setData({ hasMachineWaxTicket });
              this._refreshCares();
            }
          }
          return available;
        }).catch(e => {
          if (this._memberCareTicketsLoad === load) this._memberCareTicketsLoad = null;
          throw e;
        });
      return load;
    },
    _loadMachineWaxAvailability(value) {
      const memberId = Number(value) || 0;
      if (this._machineWaxMemberId !== memberId) {
        this._machineWaxMemberId = memberId;
        this._machineWaxCardsMemberId = 0;
        this._machineWaxSeasonCards = [];
        this._memberCareCardsLoad = null;
        this.setData({ hasMachineWaxTicket: false });
        this._refreshCares();
      }
      if (!memberId) { this._memberCareTicketsLoad = null; return; }
      if (this._ticketAutoDetached) return;
      return Promise.all([
        this._getMemberCareTickets(memberId).promise
          .catch(e => console.warn('load machine wax ticket availability failed', e)),
        this._getMemberCareCards(memberId).promise
          .catch(e => console.warn('load machine wax season cards failed', e)),
      ]);
    },
    _scheduleOldCustomerTicket() {
      if (this._ticketAutoQueued || this._ticketAutoDetached) return;
      this._ticketAutoQueued = true;
      Promise.resolve().then(() => {
        this._ticketAutoQueued = false;
        if (!this._ticketAutoDetached) return this._autoSelectOldCustomerTicket();
      }).catch(e => console.warn('auto select old customer ticket failed', e));
    },
    _autoTicketBlocked() {
      return this._ticketAutoDetached || this.data.newCardMode || this.data.hasCardSelection
        || this.data.cardBusy || this.data.cardSubmitted || this.data.ticketPopup.show;
    },
    _rememberManualTicketChoice(cidx) {
      const memberId = Number(this.data.memberId) || 0;
      if (this._oldCustomerTicketMember !== memberId) {
        this._oldCustomerTicketMember = memberId;
        this._oldCustomerTicketState = null;
        this._oldCustomerPricePromise = null;
        this._manualTicketChoices = {};
      }
      const care = this.data.displayCares[cidx];
      if (care) (this._manualTicketChoices || (this._manualTicketChoices = {}))[this._careKey(care, cidx)] = true;
    },
    async _autoSelectOldCustomerTicket() {
      const memberId = Number(this.data.memberId) || 0;
      if (this._oldCustomerTicketMember !== memberId) {
        this._oldCustomerTicketMember = memberId;
        this._oldCustomerTicketState = null;
        this._oldCustomerPricePromise = null;
        this._manualTicketChoices = {};
      }
      if (!(this.data.displayCares || []).length) {
        this._oldCustomerTicketState = null;
        this._memberCareTicketsLoad = null;
        this._manualTicketChoices = {};
        return;
      }
      const eligible = (c, i) => !c.ticket_code && !c.use_card && !c.card_id && !c.coach_card_id
        && !c.warranty && !c.entertain && !(this._manualTicketChoices || {})[this._careKey(c, i)]
        && !isScrapeOnlyCare(c, this.data.shop);   // 只选刮蜡是一口价，不自动带券
      if (!memberId || this._autoTicketBlocked() || !this.data.displayCares.some(eligible)) return;
      let state = this._oldCustomerTicketState;
      if (!state) {
        state = { memberId };
        this._oldCustomerTicketState = state;
        state.promise = this._getMemberCareTickets(memberId).promise
          .then(tickets => (tickets || []).filter(t => t && Number(t.template_id) === 16 && t.code
            && (t.member_id == null || Number(t.member_id) === memberId))
            .sort((a, b) => (a.expire_date || '9999') < (b.expire_date || '9999') ? -1
              : (a.expire_date || '9999') > (b.expire_date || '9999') ? 1 : 0))
          .catch(e => { if (this._oldCustomerTicketState === state) this._oldCustomerTicketState = null; throw e; });
      }
      const tickets = await state.promise;
      if (this._oldCustomerTicketState !== state || Number(this.data.memberId) !== memberId || this._autoTicketBlocked()) return;
      const used = new Set(this.data.displayCares.map(c => c.ticket_code).filter(Boolean));
      const updated = [];
      const cares = this.data.displayCares.map((care, i) => {
        if (!eligible(care, i)) return care;
        const ticket = tickets.find(t => !used.has(t.code));
        if (!ticket) return care;
        used.add(ticket.code); updated.push(i);
        // 自动带券只改变券选择，保留店员已选项目、维修和手动减免。
        return { ...care, ticket, ticket_code: ticket.code };
      });
      if (!updated.length) return;
      this.data.cares = cares;
      this._refreshCares();
      this._emitSync(true);
      this._oldCustomerPricePromise = Promise.all(updated.map(i => this._fetchPrice(i)));
      await this._oldCustomerPricePromise;
    },
    onTicketTap(e) {
      if (this.data.newCardMode) { wx.showToast({ title: '本单统一使用新购卡', icon: 'none' }); return; }
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
          selectedCoachCardId: (care && care.coach_card_id) || null,
          disabledCodes,
          // 学员卡预计优惠要按本单门店 + 单项/双项 + 服务费算：修刃、热打蜡各算一项
          tier: coachTier(care),
          commonCharge: Number(care && care.common_charge) || 0,
          urgent: care && care.urgent ? 1 : 0,
        },
      });
    },
    onTicketSelectorEvent(e) {
      const cidx = this.data.ticketPopup.cidx;
      if (e.detail.action !== 'confirm') {
        this.setData({ 'ticketPopup.show': false });
        this._scheduleOldCustomerTicket();
        return;
      }
      const ticket = e.detail.selectedTicket || null;
      const card = e.detail.selectedCard || null;
      const coachCard = e.detail.selectedCoachCard || null;
      this.setData({ 'ticketPopup.show': false });
      if (coachCard) { this._applyCoachCardSelection(cidx, coachCard); return; }
      this._applyTicketSelection(cidx, ticket, card);
    },

    // 选学员卡（某某教练的学员卡）：与券、会员卡互斥，只写 coach_card_id，**不清已选的服务项**——
    // 学员卡只是价格优惠，店员已经选好的修刃/热蜡不能被清掉。价格由服务端按卡内快照重算。
    _applyCoachCardSelection(cidx, coachCard) {
      this._rememberManualTicketChoice(cidx);   // 店员手选了，老顾客券不再自动顶回来
      const curCare = this.data.displayCares[cidx];
      if (curCare && curCare._key) this.data.expandedMap[curCare._key] = true;
      this._mutate(cidx, (c) => {
        c.ticket = null;
        c.ticket_code = null;
        c.use_card = false;
        c.card_id = null;
        c.card_name = null;
        c.card_equip_lock = false;
        c.card_pending_open = false;
        c.discount = 0;
        c._manualDiscount = 0;
        c.coach_card_id = coachCard.cardId;
        c._coachCardName = coachCard.coachName || '';
        c._coachHint = '';
      });
      return this._fetchPrice(cidx);
    },
    // 选券/选卡的唯一落地口。手选弹层和扫码（onTicketScan）都走这里——
    // 「扫出来的效果要和手选一模一样」靠的是同一段代码，不是两段写成一样
    _applyTicketSelection(cidx, ticket, card, options) {
      const that = this;
      const preserveServices = !!(options && options.preserveServices);
      // 选券/选卡后表单可能瞬间变「已录入」，显式记住展开态——装备卡片不自动折叠
      const curCare = this.data.displayCares[cidx];
      this._rememberManualTicketChoice(cidx);
      if (curCare && curCare._key) {
        this.data.expandedMap[curCare._key] = true;
      }
      this._mutate(cidx, (c) => {
        // 更改券/卡（含改选「不使用」）时：先清空已选服务（用户 2026-07-09 拍板）。
        // 默认服务项由服务端 CalcCareCharge(deriveServices=true) 推导，响应 services 回填——
        // 这里的清空只为响应前的即时 UI 反馈，真理之源在服务端 ApplyDefaultServices。
        // 清空范围 = 养护项目行 + 非雪季状态 + 减免（减免可能来自折扣券 16，区分不了来源、一并清）；
        // 立等/维修/质保/招待与券无关，保留
        if (!preserveServices) {
          c.need_edge = 0;
          c.edge_degree = null;
          c.need_wax = 0;
          c.need_unwax = 0;
          c.free_wax = 0;
          c.summer = null;
          if (c.biz_type === '非雪季养护') c.biz_type = null;
        }
        c.discount = 0;
        c._manualDiscount = 0;
        // 学员卡与券、会员卡互斥：换券/换卡/改选「不使用」都先清掉学员卡
        c.coach_card_id = null;
        c._coachCardName = '';
        c._coachHint = '';
        if (card) {
          // 选会员卡：与券互斥，清券侧字段；落 use_card（后端持久化）+ 卡展示标量
          c.ticket = null;
          c.ticket_code = null;
          c.use_card = true;
          c.card_id = card.id;
          c.card_name = card.card_name;
          // 限装备季卡：装备信息带入卡绑定值并锁定不可改（用户 2026-07-09 拍板；serial 暂不参与）
          const isSeason = !!(card.isSeason || card.total == null);
          const needsBinding = isSeason && /打蜡|热蜡/.test(card.card_name || '');
          if (needsBinding && card.equipBound) {
            if (c.equipment !== card.equip_type) {
              // 类型变化时与 onEquipTap 同口径：品牌/维修字典跟随切换，原维修选择作废
              c.repair_memo = null;
              c.need_repair = 0;
            }
            c.equipment = card.equip_type;
            c.brand = card.equip_brand;
            c.scale = card.equip_scale;
            c.card_equip_lock = true;
            c.card_pending_open = false;
          } else {
            c.card_equip_lock = false;
            // 季卡但三项装备信息为空 = 还没开卡。发卡/售卡时并不知道顾客拿哪块板来，
            // 第一次用它养护才绑定。这里**不锁装备**——本次录入的装备正是要写进卡的内容，
            // 订单生效时由服务端 EffectCareOrder 写入 punch_card 的 equip_* 三列。
            c.card_pending_open = needsBinding;
          }
        } else if (ticket) {
          c.use_card = false;
          c.card_id = null;
          c.card_name = null;
          c.card_equip_lock = false;
          c.card_pending_open = false;
          c.ticket = ticket;
          c.ticket_code = ticket.code;
        } else {
          c.ticket = null;
          c.ticket_code = null;
          c.use_card = false;
          c.card_id = null;
          c.card_name = null;
          c.card_equip_lock = false;
          c.card_pending_open = false;
        }
      });
      // 点击机打蜡自动带权益时保留其他项目，只应用机蜡联动；手动换券卡仍推导默认服务。
      return that._fetchPrice(cidx, preserveServices ? { changed: 'free_wax' } : { derive: true });
    },
    /* ---------- 扫码用券 ---------- */
    // 顾客在「我的优惠券」详情页出示二维码（内容就是券码），店员扫一下：
    // 识别券码 → 查持有者 → 需要时把开单顾客切成持有者 → 选中这张券。
    // 落券走的是 _applyTicketSelection，与手选弹层同一段代码。
    onTicketScan(e) {
      const that = this;
      const cidx = Number(e.currentTarget.dataset.cidx);
      wx.scanCode({
        onlyFromCamera: false,
        success(res) {
          const code = that._parseTicketCode(res && res.result);
          if (!code) {
            wx.showToast({ title: '无法识别的二维码', icon: 'none' });
            return;
          }
          that._useScannedTicket(cidx, code);
        },
        fail() {},   // 用户主动取消扫码，不打扰
      });
    },

    // 券详情页的码内容就是纯券码。这里只做容错：万一扫到的是带券码的链接
    // （历史物料、别处生成的码），把券码抠出来而不是直接判"识别失败"
    _parseTicketCode(raw) {
      let s = (raw || '').trim();
      if (!s) return '';
      if (s.indexOf('http') === 0) {
        const m = s.match(/[?&](?:code|ticketCode)=([^&#]+)/);
        if (m) return decodeURIComponent(m[1]).trim();
        s = s.split('#')[0].split('?')[0].replace(/\/+$/, '').split('/').pop();
      }
      return s.trim();
    },

    _useScannedTicket(cidx, code) {
      const that = this;
      const curMemberId = that.data.memberId || null;
      wx.showLoading({ title: '识别中', mask: true });
      data.getTicketDetailByStaffPromise(code, app.globalData.sessionKey)
        .then((detail) => {
          wx.hideLoading();
          if (!detail) {
            wx.showToast({ title: '优惠券不存在', icon: 'none' });
            return;
          }
          const ownerId = Number(detail.memberId || 0) || null;
          if (!ownerId) {
            // 券还没落到任何会员名下（未领取/未绑定），没有"持有者"可切，也无从判断能不能用
            wx.showModal({
              title: '这张券还没有归属',
              content: '该券尚未绑定会员，请顾客先在小程序里领取，再扫码使用。',
              showCancel: false,
            });
            return;
          }
          if (ownerId === curMemberId) {
            that._pickScannedTicket(cidx, code, ownerId);
            return;
          }
          // 换人：已录进购物车的其它券属于原顾客，切完就非法了，必须一并清掉
          const owner = (detail.memberName || '').trim() || ('会员 ' + ownerId);
          const phone = (detail.memberPhone || '').trim();
          const who = owner + (phone ? '（' + phone + '）' : '');
          wx.showModal({
            title: '切换开单顾客',
            content: curMemberId
              ? '这张券属于 ' + who + '。继续将把本单顾客切换为 ' + owner + '，原顾客已选的优惠券会被清除。'
              : '这张券属于 ' + who + '。继续将把本单顾客设为 ' + owner + '。',
            confirmText: '继续',
            success(r) {
              if (!r.confirm) return;
              that._switchMemberTo(detail, ownerId, owner);
              that._pickScannedTicket(cidx, code, ownerId);
            },
          });
        })
        .catch(() => {
          wx.hideLoading();
          // performWebRequest 已经 toast 过服务端的 message（券不存在 / 没有权限）
        });
    },

    // 切开单顾客：本组件只负责清掉挂在旧顾客名下的券，customer 的真理之源在父页。
    // 姓名/手机号必须一并回传——顶部会员条按 customer.cell 反查会员，只换 memberId
    // 会让条上还挂着原顾客的名字和手机号
    _switchMemberTo(detail, memberId, memberName) {
      const cares = this.data.displayCares || [];
      let cleared = 0;
      cares.forEach((c, i) => {
        if (!c.ticket_code && !c.use_card) return;
        cleared += 1;
        this._mutate(i, (x) => {
          x.ticket = null;
          x.ticket_code = null;
          x.use_card = false;
          x.card_id = null;
          x.card_name = null;
          x.card_equip_lock = false;
          x.card_pending_open = false;
          x.discount = 0;
          x.coach_card_id = null;
          x._coachCardName = '';
          x._coachHint = '';
          x._manualDiscount = 0;
        });
      });
      if (cleared > 0) {
        wx.showToast({ title: '已清除原顾客的优惠券', icon: 'none' });
      }
      // 本地先把 memberId 顶上：紧接着的 _pickScannedTicket → _applyTicketSelection →
      // _fetchPrice 会把 memberId 发给 CalcCareCharge，等父页 setData 回传就晚了，
      // 会拿旧会员算价。父页随后传回同一个值，observer 幂等（_loadDeposit 自带去重）
      this.setData({ memberId });
      this.triggerEvent('memberSwitch', {
        memberId,
        name: memberName,
        cell: (detail.memberPhone || '').trim(),
        gender: (detail.memberGender || '').trim(),
      });
    },

    // 用"该会员的可用券列表"当校验：过期 / 已用 / 作废 / 不是养护线的券
    // 一律表现为"不在列表里"，不用在前端把服务端的券状态机再实现一遍
    _pickScannedTicket(cidx, code, memberId) {
      const that = this;
      this._rememberManualTicketChoice(cidx);
      const dup = (that.data.displayCares || []).some(
        (c, i) => i !== cidx && c.ticket_code === code);
      if (dup) {
        wx.showToast({ title: '这张券已用在本单其它装备上', icon: 'none' });
        return;
      }
      wx.showLoading({ title: '查询券', mask: true });
      data.getMemberTicketsPromise(memberId, '养护', true, app.globalData.sessionKey)
        .then((tickets) => {
          wx.hideLoading();
          const t = (tickets || []).find((x) => x && x.code === code);
          if (!t) {
            wx.showModal({
              title: '这张券不能用',
              content: '该券已使用、已过期，或不属于养护业务线。',
              showCancel: false,
            });
            return;
          }
          if (that.data.displayCares.some((c, i) => i !== cidx && c.ticket_code === code)) {
            wx.showToast({ title: '这张券已用在本单其它装备上', icon: 'none' });
            return;
          }
          that._applyTicketSelection(cidx, t, null);
        })
        .catch(() => wx.hideLoading());
    },

    /* ---------- 会员储值 ---------- */
    // memberId 变化时拉会员资产（depositTotal）。散客 / 无余额则不显示储值行。
    _loadDeposit(memberId) {
      const that = this;
      if (!memberId) {
        if (that.data.hasDeposit || that.data.useDeposit || that.data.depositAvailableStr) {
          that.setData({ hasDeposit: false, depositAvailableStr: '', useDeposit: false });
        }
        that._lastDepositMemberId = 0;
        return;
      }
      if (memberId === that._lastDepositMemberId) return;
      that._lastDepositMemberId = memberId;
      Promise.resolve(app.loginPromiseNew).then(() => {
        return data.getMemberAssetsByStaffPromise(memberId, app.globalData.sessionKey);
      }).then((r) => {
        if (!r || that._lastDepositMemberId !== memberId) return; // 已换人，丢弃过期结果
        const dep = r.depositTotal || 0;
        const patch = { hasDeposit: dep > 0, depositAvailableStr: dep > 0 ? util.showAmount(dep) : '' };
        // 新会员无储值时清掉上一位的勾选
        if (dep <= 0 && that.data.useDeposit) patch.useDeposit = false;
        that.setData(patch);
      }).catch(() => {});
    },

    onToggleUseDeposit() {
      this.setData({ useDeposit: !this.data.useDeposit });
    },

    /* ---------- 结算 ---------- */
    async onCheckout() {
      if (!this.data.summary.canCheckout || this.data.autoTicketCheckout || this.data.cardBusy) return;
      this.setData({ autoTicketCheckout: true });
      try {
        await this._autoSelectOldCustomerTicket();
        await this._oldCustomerPricePromise;
        await this.waitForPrices();
        if (this._ticketAutoDetached || this.data.cardBusy || !this.data.summary.canCheckout) return;
        const cares = this.data.displayCares.map((c) => this._stripUI(c));
        // 自动选券及优惠计价完成后再提交，避免列表晚到时按原价结算。
        this.triggerEvent('checkout', { cares, useDeposit: this.data.useDeposit });
      } catch (e) {
        wx.showToast({ title: '优惠或计价未完成，请重试', icon: 'none' });
      } finally {
        if (!this._ticketAutoDetached) this.setData({ autoTicketCheckout: false });
      }
    },
  },
});
