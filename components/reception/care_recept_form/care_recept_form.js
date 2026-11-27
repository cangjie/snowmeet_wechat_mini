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
const bestBenefit = require('../../../utils/care_best_benefit.js');
const equipDiff = require('../../../utils/member_equipment_diff.js');

// 与 data.js uploadFilePromise 的上传域名保持一致（文件落在处理上传那台服务器的磁盘）
const UPLOAD_HOST = data.IMAGE_HOST;

function uploadUrl(value) {
  if (!value) return '';
  return /^(https?:|wxfile:)/.test(value) ? value : UPLOAD_HOST + value;
}

// 装备照片（用户 2026-11-25 定：开单必须上传，每件装备至少一张）。
// 传输中（status=uploading）和失败的不算：上传没完成就放行，之后保存会丢掉这张照片。
// 其余都算——包括找回中断单时后端只带 image 导航对象、没有 status 的照片。
function isUploadedPhoto(im) {
  if (!im || im.status === 'uploading' || im.status === 'failed') return false;
  return !!(im.image_id > 0 || im.id > 0 || im.image || im.url);
}
function hasUploadedPhoto(care) {
  return !!care && (care.careImages || []).some(isUploadedPhoto);
}
function hasUploadingPhoto(care) {
  return !!care && (care.careImages || []).some((im) => im && im.status === 'uploading');
}

// 万龙服务中心「只选了刮蜡」：一口价（服务端定价），不选任何券、会员卡、学员卡。
// 这里只用来决定「要不要自动带老顾客券」；价格、以及已选券卡的清除都以服务端 CalcCareCharge 为准
// （后端 CarePricingRules.AppliesScrapeOnlyPrice 同一口径：先把万龙体验中心归并到服务中心）。
function isScrapeOnlyCare(care, shop) {
  const name = String(shop || '').trim();
  if (!care || (name !== '万龙服务中心' && name !== '万龙体验中心')) return false;
  // 养板自带刮蜡（默认带出），它不是「只刮蜡」：养板按自己的价目收，也会自动带老顾客券
  return care.need_unwax === 1 && care.need_edge !== 1 && care.need_wax !== 1 && care.free_wax !== 1
    && care.maintain_board !== 1 && !care.summer && !care.warranty && !care.entertain;
}

// 自动带出的养护会员卡，按优先顺序排好：季卡 > 次卡；同类里双项 > 单项；再按开卡先后（id 小的先用）。
// 季卡不限总次数，但每天限用一次（本单最多一件装备用），次卡的次数是剩余次数。
// 卡名含「机打蜡」的次卡推导出来的是机打蜡服务，不在自动带出之列；用完的次卡、已退款的卡不带。
// 季卡判定与选卡弹层一致：total 为空，或旧数据卡名含「季卡」。
function autoCareCards(cards, memberId) {
  return (cards || []).map(card => {
    if (!card || !card.id || card.is_refund) return null;
    if (card.member_id != null && Number(card.member_id) !== memberId) return null;
    if (card.biz_type && card.biz_type !== '养护') return null;
    const name = card.card_name || '';
    const season = !!(card.isSeason || card.total == null || name.indexOf('季卡') >= 0);
    // 单项/双项以卡上的 care_project_count 为准，历史卡没有才看卡名（服务端 ApplyDefaultServices 同一口径）
    const double = card.care_project_count != null ? Number(card.care_project_count) === 2 : name.indexOf('双项') >= 0;
    if (season) return { card, season, double, capacity: 1 };
    if (name.indexOf('机打蜡') >= 0) return null;
    const remaining = card.remaining != null ? Number(card.remaining) : Number(card.total) - Number(card.punches || 0);
    return remaining > 0 ? { card, season, double, capacity: remaining } : null;
  }).filter(Boolean).sort((a, b) => Number(b.season) - Number(a.season) || Number(b.double) - Number(a.double)
    || Number(a.card.id) - Number(b.card.id));
}

// 这件装备能不能自动用这张卡：true 能 / false 不能 / null 还要等装备填完才知道。
// 次卡随便用；季卡今天用过的不能再用；限装备的季卡只给装备完全对得上的那件（与机打蜡自动选卡同一口径），
// 对不上就不带，免得把卡绑的装备硬写进别人的板子。装备三项还没填全、目前也没有填错的，先等着——
// 这类卡排在前面，直接往下选别的会让常客的季卡永远排不上。
function careFitsCard(care, { card, season }) {
  if (!season) return true;
  if (card.usedToday) return false;
  const text = value => value == null ? '' : String(value).trim();
  const binding = [card.equip_type, card.equip_brand, card.equip_scale].map(text);
  if (!card.equipBound && binding.every(value => !value)) return true;
  if (!binding.every(Boolean)) return false;   // 只绑了一部分的异常数据，和机打蜡选卡一样不开放
  const equip = [care.equipment, care.brand, care.scale].map(text);
  if (equip.some((value, i) => value && value !== binding[i])) return false;
  return equip.every(Boolean) ? true : null;
}

// 与手选弹层选卡同一口径的卡字段：限装备季卡锁装备，没开卡的打蜡/热蜡季卡标「待开卡」，订单生效时由服务端绑定
function autoCardFields({ card, season }) {
  const needsBinding = season && /打蜡|热蜡/.test(card.card_name || '');
  return { ticket: null, ticket_code: null, use_card: true, card_id: card.id, card_name: card.card_name,
    card_equip_lock: needsBinding && !!card.equipBound, card_pending_open: needsBinding && !card.equipBound };
}

function hasChosenService(care) {
  return care.need_edge === 1 || care.need_wax === 1 || care.need_unwax === 1 || care.free_wax === 1
    || care.seal_board === 1 || care.maintain_board === 1 || !!care.summer;
}

function selectedBenefitKey(care) {
  if (care.ticket_code) return 'ticket:' + care.ticket_code;
  if (care.use_card && care.card_id) return 'card:' + care.card_id;
  if (care.coach_card_id) return 'coach:' + care.coach_card_id;
  return null;
}

async function mapConcurrent(items, limit, fn) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      result[i] = await fn(items[i], i);
    }
  }));
  return result;
}

// 新建一个空 care（snake_case 对齐后端；valid=0 草稿态，PlaceCareOrder 才置 1）
// member_equipment_id = -1 表示新版开单明确录入的新装备，下单提交时由后端创建 member_equipment 并回填真实 id
function blankCare() {
  return {
    id: 0,
    order_id: null,
    member_equipment_id: equipDiff.ExplicitNewSentinel,
    biz_type: null,
    equipment: null,
    brand: null,
    series: null,
    scale: null,
    year: null,
    serials: null,
    boot_length: null,
    with_pole: null,   // 含杖（单板没有）
    with_bag: null,    // 含包（2026-11-14）；与含杖二选一
    need_edge: 0,
    edge_degree: null,
    need_wax: 0,
    need_unwax: 0,
    seal_board: 0,   // 封板（2026-11-09）：热蜡 / 养板后不刮蜡、蜡留在板面上；与刮蜡二选一，取板后发开板刮蜡券。不是养护工序，不计费
    maintain_board: 0,   // 养板（2026-11-10）：和热蜡同一类业务、与热蜡 / 机打蜡互斥；默认带刮蜡（与封板二选一）。单选 220，修刃+养板 280，只认老顾客券
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
  // 养板有自己的价目，不享受学员卡（服务端 ClearBenefitsForMaintainBoard 会摘掉），不给档位 = 弹层里不报预计优惠
  if (care && care.maintain_board === 1) return ''
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
      observer(v, prev) {
        if (prev && Number(prev) !== Number(v)) {
          this._clearLinkedMemberEquipments();
        }
        this._loadDeposit(v);
        this._loadMachineWaxAvailability(v);
        this._scheduleOldCustomerTicket();
      },
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
    // 会员装备选择弹层：会员选定装备类型后，从其名下装备列表读取同类型装备供选择；
    // 也可在弹层里填写新装备（下单提交时自动加入该会员装备列表）
    historyModal: { show: false, cidx: -1, equip: '', list: [], brandListView: [], brandIndex: null, brand: '', scale: '', serials: '' },
    // 已选旧装备修改品牌/长度/序列号后的立即确认弹窗（另存为新装备 vs 更新旧装备）
    equipChangeModal: { show: false, cidx: -1, equipId: 0, field: '', prevValue: '', prevDiffSerial: false, equipSummary: '', changeLine: '' },
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
      this._equipOriginById = null;
      this._equipEditChoiceMap = null;
      this._diffSerialMap = null;
      this._fetchingOriginsMemberId = 0;
      this._originFetchedMemberIds = null;
    },
  },
  methods: {
    onAddCard() {
      if (this.data.cardBusy) return;
      const cares = this.data.displayCares || [];
      if (!cares.length || cares.some(c => !c.equipment || !hasUploadedPhoto(c))) {
        wx.showToast({ title: '请先为每件装备上传照片，并完整填写装备信息', icon: 'none' }); return;
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
      // 照片必填；品牌、长度不再是照片的替代品（有照片就够，没照片填了品牌长度也不行）
      if (!hasUploadedPhoto(care)) return { ok: false, label: hasUploadingPhoto(care) ? '照片上传中' : '照片必填' };
      const hasService = care.need_edge === 1 || care.need_wax === 1 || care.maintain_board === 1 || care.free_wax === 1 || care.need_unwax === 1
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
        if (care.maintain_board === 1) chips.push(care.need_edge === 1 ? '修刃+养板' : '养板');
        else if (care.need_edge === 1 && care.need_wax === 1) chips.push('双项');
        else if (care.need_edge === 1) chips.push('修刃');
        else if (care.need_wax === 1) chips.push('热蜡');
        if (care.free_wax === 1) chips.push('机打蜡');
        if (care.need_unwax === 1 && care.need_wax !== 1 && care.maintain_board !== 1) chips.push('刮蜡');
        if (care.seal_board === 1) chips.push('封板');
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
        if (!care.timeStamp) care.timeStamp = Date.now() + idx;
        const key = that._careKey(care, idx);
        const oldKey = 't' + care.timeStamp;
        if (care.timeStamp && that._manualTicketChoices && that._manualTicketChoices[oldKey]) {
          that._manualTicketChoices[key] = true;
        }
        if (oldKey !== key) {
          if (that._equipEditChoiceMap && that._equipEditChoiceMap[oldKey]) {
            that._equipEditChoiceMap[key] = that._equipEditChoiceMap[oldKey];
            delete that._equipEditChoiceMap[oldKey];
          }
          if (that._diffSerialMap && that._diffSerialMap[oldKey] !== undefined) {
            that._diffSerialMap[key] = that._diffSerialMap[oldKey];
            delete that._diffSerialMap[oldKey];
          }
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
          // 序列号拆合（双板支持分左右）与会员装备快照关联
          ...that._deriveEquipAndSerialFields(care, key),
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
      this._ensureEquipOriginsForCares(raw);
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
        try { await Promise.all(Array.from(this._carePriceWork)); }
        catch (_) { throw new Error('养护优惠或计价失败，请重新计算'); }
      }
      if (!this.data.newCardMode && !this.data.hasCardSelection
        && this.data.displayCares.some(c => this._needsMachineWaxBenefit(c))) {
        throw new Error('机打蜡权益未确认，请重试');
      }
      if (this.data.priceError && !this.data.hasCardSelection) throw new Error('养护计价失败，请重新计算');
    },
    onRetryPrices() {
      this._bestBenefitState = null;
      this._memberCareTicketsLoad = null;
      this._memberCareCardsLoad = null;
      this._scheduleOldCustomerTicket();
      this._scheduleAllCarePrices();
    },
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
      if (!this._benefitBasisFailed && (!this._bestBenefitState || !this._bestBenefitState.failed)) this.setData({ priceError: false });
      // 全量状态整包提交（用户 2026-07-09 拍板）：店铺/会员 + care 内装备/服务/券码/卡(card_id,card_name)/附加费。
      // 卡选择跟着单件装备（care）走，卡信息只在 care 内、不设平级字段
      const req = {
        shop: this.data.shop,
        memberId: this.data.memberId || null,
        deriveServices: derive,
        changedField: changed,
        care: payload,
      };
      const work = this._trackCarePrice(data.calcCareChargePromise(req, app.globalData.sessionKey)
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
              c.seal_board = rc.seal_board || 0;
              c.maintain_board = rc.maintain_board || 0;
              c.free_wax = rc.free_wax || 0;
              c.urgent = rc.urgent || 0;
              c.summer = rc.summer || null;
              c.biz_type = rc.biz_type || null;
              c.common_charge = rc.common_charge || 0;
              c.discount = rc.discount || 0;
              // 学员卡：显示名和本单优惠提示来自计价响应；没带 coach 字段 = 本单没享受（质保/招待/非雪季等）
              const coach = res && res.coach;
              if (c.coach_card_id) {
                if (coach) { c._coachCardName = coach.coachName || c._coachCardName || ''; c._coachCardLabel = coach.cardName || ''; }
                c._coachHint = coach ? (coach.discount > 0 ? '学员卡优惠 −¥' + coach.discount : '这张学员卡在本单没有优惠')
                  : '质保、招待和非雪季养护不享受学员卡优惠';
              }
              // 只选刮蜡：服务端把已选的券 / 会员卡 / 学员卡（及随之带来的减免）摘掉了，本地同步清除，
              // 否则界面还挂着券、订单上却没有，店员会以为用上了
              // 例外：可用的「开板刮蜡券」（封板取板后发的）专抵这口价，服务端会留着（响应里 ticket_code 还在），
              // 本地的券也留着；抵不了的开板刮蜡券（boardTicketRemoved：别的门店 / 不是单刮蜡 / 已用 / 非本人）服务端摘了，本地同步摘
              const ticketKept = !!rc.ticket_code;
              if (res && res.boardTicketRemoved && !ticketKept) {
                c.ticket = null;
                c.ticket_code = null;
              }
              if (res && res.benefitsCleared) {
                if (!ticketKept) {
                  c.ticket = null;
                  c.ticket_code = null;
                }
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
          if (res && res.boardTicketRemoved) wx.showToast({ title: '开板刮蜡券仅限万龙单独刮蜡，已取消', icon: 'none' });
          else if (res && res.benefitsCleared) {
            // 养板只认老顾客券（其余券 / 会员卡 / 学员卡被摘）；只选刮蜡是一口价（几乎所有券卡被摘）
            const title = rc && rc.maintain_board === 1 ? '养板只能用老顾客券，已取消其它券和卡'
              : (rc && rc.ticket_code ? '只选刮蜡按一口价，已取消卡和其它优惠' : '只选刮蜡按一口价，已取消券和卡');
            wx.showToast({ title, icon: 'none' });
          }
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
      const serviceWork = this._servicePriceWork || (this._servicePriceWork = new Set());
      serviceWork.add(work);
      work.then(() => serviceWork.delete(work), () => serviceWork.delete(work));
      return work;
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
          if (care && care._key && that._equipEditChoiceMap) delete that._equipEditChoiceMap[care._key];
          const cares = (that.data.cares || []).slice();
          cares.splice(cidx, 1);
          that.data.cares = cares;
          that._refreshCares();
          that._emitSync(true);
        },
      });
    },
    /* ---------- 装备信息 ---------- */
    _fetchMemberEquips(memberId, equip) {
      const fn = typeof data.getMemberEquipmentsByStaffPromise === 'function'
        ? data.getMemberEquipmentsByStaffPromise
        : data.getMemberCaredEquipmentsPromise;
      if (typeof fn !== 'function') return Promise.resolve([]);
      return fn(memberId, equip, app.globalData.sessionKey);
    },
    _rememberEquipOrigins(list) {
      this._equipOriginById = this._equipOriginById || {};
      (list || []).forEach((it) => {
        const snap = equipDiff.snapshotFromEquipment(it);
        if (snap) this._equipOriginById[snap.id] = snap;
      });
    },
    _ensureEquipOriginsForCares(cares) {
      const memberId = Number(this.data.memberId) || 0;
      if (!memberId) return;
      this._originFetchedMemberIds = this._originFetchedMemberIds || {};
      const missing = (cares || []).some((c) => {
        const id = Number(c && c.member_equipment_id) || 0;
        return id > 0 && !(this._equipOriginById && this._equipOriginById[id]) && !c._equipOrigin;
      });
      if (!missing || this._fetchingOriginsMemberId === memberId || this._originFetchedMemberIds[memberId]) return;
      this._fetchingOriginsMemberId = memberId;
      this._fetchMemberEquips(memberId, '').then((list) => {
        if (Number(this.data.memberId) !== memberId) return;
        this._originFetchedMemberIds[memberId] = true;
        this._rememberEquipOrigins(list || []);
        this._refreshCares();
      }).catch(() => {}).finally(() => {
        if (this._fetchingOriginsMemberId === memberId) this._fetchingOriginsMemberId = 0;
      });
    },
    _deriveEquipAndSerialFields(care, key) {
      const split = equipDiff.splitSerials(care.serials);
      const diffMap = this._diffSerialMap || {};
      const choiceMap = this._equipEditChoiceMap || {};
      const isSki = care.equipment === '双板';
      const diffSerial = isSki ? (diffMap[key] !== undefined ? !!diffMap[key] : split.diff) : false;
      const equipId = Number(care.member_equipment_id) || 0;
      const origin = equipId > 0
        ? ((this._equipOriginById && this._equipOriginById[equipId]) || care._equipOrigin || null)
        : null;
      const changes = origin ? equipDiff.diffCareAgainstOrigin(care, origin) : [];
      const modified = changes.length > 0;
      return {
        _diffSerial: diffSerial,
        _singleSerial: diffSerial ? '' : split.serials,
        _leftSerial: split.leftSerial,
        _rightSerial: split.rightSerial,
        _linkedEquipId: equipId > 0 ? equipId : 0,
        _equipOrigin: origin,
        _equipModified: modified,
        _equipModifiedBanner: equipDiff.formatModifiedBannerText(changes),
        _equipEditChoice: choiceMap[key] || '',
      };
    },
    _clearLinkedMemberEquipments() {
      this._equipOriginById = {};
      this._equipEditChoiceMap = {};
      this._originFetchedMemberIds = {};
      const cares = (this.data.cares || []).slice();
      let touched = false;
      cares.forEach((c, i) => {
        if (c && Number(c.member_equipment_id) > 0) {
          cares[i] = { ...c, member_equipment_id: equipDiff.ExplicitNewSentinel };
          delete cares[i]._equipOrigin;
          touched = true;
        }
      });
      if (touched) {
        this.data.cares = cares;
        this._refreshCares();
      }
    },
    onEquipTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const equip = e.currentTarget.dataset.equip;
      const cur = this.data.displayCares[cidx];
      if (cur && cur.card_equip_lock) {
        wx.showToast({ title: '该季卡已绑定装备，不可修改', icon: 'none' });
        return;
      }
      if (cur && cur.equipment === equip) {
        // 重新选择同类型装备时，先保留当前信息，选定已有装备后再更新。
        this._maybeShowHistory(cidx, equip);
        return;
      }
      if (cur && cur._key && this._equipEditChoiceMap) {
        delete this._equipEditChoiceMap[cur._key];
      }
      this._mutate(cidx, (c) => {
        c.equipment = equip;
        // 切换单/双板后重新归为新装备待选，避免把原类型的已有装备改成另一种类型
        c.member_equipment_id = equipDiff.ExplicitNewSentinel;
        c.brand = null;
        c.repair_memo = null;
        c.need_repair = 0;
        // 单板没有雪杖，也没有左右双板序列号
        if (equip === '单板') {
          c.with_pole = false;
          if (this._diffSerialMap && cur && cur._key) delete this._diffSerialMap[cur._key];
          if (c.serials && String(c.serials).indexOf('|') >= 0) {
            const sp = equipDiff.splitSerials(c.serials);
            c.serials = sp.leftSerial || sp.rightSerial || null;
          }
        }
      });
      this._maybeShowHistory(cidx, equip);
    },
    onUnlinkEquipment(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const cur = this.data.displayCares[cidx];
      if (!cur || cur.card_equip_lock) return;
      const origin = (this._equipOriginById && this._equipOriginById[cur.member_equipment_id]) || cur._equipOrigin || null;
      const originSerial = origin ? equipDiff.normalizeSerials(origin.serials) : '';
      const curSerial = equipDiff.normalizeSerials(cur.serials);
      const shouldClearCopiedSerial = !!(originSerial && curSerial === originSerial);
      if (cur._key) {
        this._equipEditChoiceMap = this._equipEditChoiceMap || {};
        this._equipEditChoiceMap[cur._key] = 'new';
        if (shouldClearCopiedSerial && this._diffSerialMap) {
          delete this._diffSerialMap[cur._key];
        }
      }
      this._mutate(cidx, (c) => {
        c.member_equipment_id = equipDiff.ExplicitNewSentinel;
        if (shouldClearCopiedSerial) c.serials = null;
      }, true, false);
      wx.showToast({ title: '已设为另存新装备', icon: 'none' });
    },
    onSerialDiffTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const cur = this.data.displayCares[cidx];
      if (!cur || cur.equipment !== '双板') return;
      this._diffSerialMap = this._diffSerialMap || {};
      const next = !cur._diffSerial;
      this._diffSerialMap[cur._key] = next;
      this._mutate(cidx, (c) => { c.serials = null; }, true, false);
    },
    onSerialBlur(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const side = e.currentTarget.dataset.side || 'single';
      const val = e.detail.value || '';
      const cur = this.data.displayCares[cidx];
      if (!cur) return;
      const prevSerial = equipDiff.normalizeSerials(cur.serials);
      let composed = null;
      if (cur.equipment === '双板' && cur._diffSerial) {
        const left = side === 'left' ? val : (cur._leftSerial || '');
        const right = side === 'right' ? val : (cur._rightSerial || '');
        composed = equipDiff.composeSerials(true, '', left, right);
      } else {
        composed = equipDiff.composeSerials(false, val, '', '');
      }
      const nextSerial = equipDiff.normalizeSerials(composed);
      if (prevSerial === nextSerial) return;
      const equipId = Number(cur.member_equipment_id) || 0;
      const locked = !!cur.card_equip_lock;
      const prevDiffSerial = !!cur._diffSerial;
      this._mutate(cidx, (c) => { c.serials = composed; }, true, false);
      if (equipId > 0 && !locked) {
        this._maybePromptEquipEditChoice(cidx, 'serials', prevSerial, nextSerial, prevDiffSerial);
      }
    },
    // 含包 / 含杖二选一：点「含包」勾上时自动取消「含杖」，再点一下取消；不影响价格，所以不重新计价
    onWithBagTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      this._mutate(cidx, (c) => {
        const on = !c.with_bag;
        c.with_bag = on;
        if (on) c.with_pole = false;
      }, true, false);
    },
    // 点「含杖」勾上时自动取消「含包」；单板没有雪杖，点了没用（按钮已置灰）
    onWithPoleTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const cur = this.data.displayCares[cidx];
      if (cur && cur.equipment === '单板') {
        wx.showToast({ title: '单板没有雪杖', icon: 'none' });
        return;
      }
      this._mutate(cidx, (c) => {
        const on = !c.with_pole;
        c.with_pole = on;
        if (on) c.with_bag = false;
      }, true, false);
    },
    /* ---------- 会员装备选择弹层：会员 + 名下有同类型装备时弹出 ---------- */
    _maybeShowHistory(cidx, equip) {
      const that = this;
      const memberId = this.data.memberId;
      if (!memberId) return; // 散客：直接在页面上填品牌/长度
      this._fetchMemberEquips(memberId, equip).then((list) => {
        list = list || [];
        that._rememberEquipOrigins(list);
        // 异步返回时确认该装备的类型没有再被切换
        const cur = that.data.displayCares[cidx];
        if (!cur || cur.equipment !== equip) return;
        if (list.length === 0) return; // 名下暂无同类型装备：直接走页面填写新装备
        const curEquipId = Number(cur.member_equipment_id) || 0;
        const view = list.map((it) => ({
          ...it,
          _selected: Number(it.id) > 0 && Number(it.id) === curEquipId,
          _brandDisp: it.brand ? String(it.brand).split('/')[0] : '未填品牌',
          _serialText: equipDiff.formatSerialsDisplay(it.serials),
          _dateStr: it.last_care_date
            ? ('上次养护 ' + String(it.last_care_date).slice(0, 10))
            : (it.create_date ? ('建档 ' + String(it.create_date).slice(0, 10)) : ''),
          _photoUrl: uploadUrl(it.photoUrl),
          _photoPreviewUrl: uploadUrl(it.photoFullUrl || it.photoUrl),
        }));
        const brandListView = that._brandListFor({ equipment: equip }).map((b) => b.displayedName);
        that.setData({
          historyModal: {
            show: true, cidx, equip, list: view,
            brandListView, brandIndex: null, brand: '', scale: '', serials: '',
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
      const equipWithType = { ...item, equipment: item.equipment || m.equip };
      this._rememberEquipOrigins([equipWithType]);
      const cur = this.data.displayCares[m.cidx];
      if (cur && cur._key) {
        if (this._diffSerialMap) delete this._diffSerialMap[cur._key];
        if (this._equipEditChoiceMap) delete this._equipEditChoiceMap[cur._key];
      }
      this._mutate(m.cidx, (c) => {
        c.member_equipment_id = Number(item.id) > 0 ? Number(item.id) : null;
        c.brand = item.brand || null;
        c.scale = item.scale || null;
        c.serials = equipDiff.normalizeSerials(item.serials) || null;
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
    onHistorySerialInput(e) {
      this.setData({ 'historyModal.serials': e.detail.value });
    },
    onHistoryManualConfirm() {
      const m = this.data.historyModal;
      const brand = (m.brand || '').trim();
      const scale = (m.scale || '').trim();
      const serials = equipDiff.normalizeSerials(m.serials) || null;
      if (!brand || !scale) {
        wx.showToast({ title: '请选择品牌并填写长度', icon: 'none' });
        return;
      }
      const cur = this.data.displayCares[m.cidx];
      if (cur && cur._key) {
        if (this._diffSerialMap) delete this._diffSerialMap[cur._key];
        if (this._equipEditChoiceMap) delete this._equipEditChoiceMap[cur._key];
      }
      this._mutate(m.cidx, (c) => {
        c.member_equipment_id = equipDiff.ExplicitNewSentinel;
        c.brand = brand;
        c.scale = scale;
        c.serials = serials;
      });
      this.setData({ 'historyModal.show': false });
    },
    onHistoryClose() {
      // 跳过：不改动已选内容，未选已有装备时保持作为新装备在表单录入
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
      const prevBrand = equipDiff.normalizeText(care && care.brand);
      const newBrand = brandList[idx].displayedName;
      const nextBrand = equipDiff.normalizeText(newBrand);
      if (prevBrand === nextBrand) return;
      const equipId = Number(care && care.member_equipment_id) || 0;
      const locked = !!(care && care.card_equip_lock);
      this._mutate(cidx, (c) => { c.brand = newBrand; });
      if (equipId > 0 && !locked) {
        this._maybePromptEquipEditChoice(cidx, 'brand', prevBrand, nextBrand);
      }
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
        const latest = that.data.displayCares[cidx] || care;
        const prevBrand = equipDiff.normalizeText(latest && latest.brand);
        const added = (brandList || []).find((b) => b.brand_name === name);
        const newBrand = added ? added.displayedName : (name + '/' + (chineseName || ''));
        const nextBrand = equipDiff.normalizeText(newBrand);
        if (prevBrand === nextBrand) return;
        const equipId = Number(latest && latest.member_equipment_id) || 0;
        const locked = !!(latest && latest.card_equip_lock);
        that._mutate(cidx, (c) => { c.brand = newBrand; });
        if (equipId > 0 && !locked) {
          that._maybePromptEquipEditChoice(cidx, 'brand', prevBrand, nextBrand);
        }
      }).catch(() => {
        wx.showToast({ title: '新增品牌失败', icon: 'none' });
      });
    },
    onFieldBlur(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const field = e.currentTarget.dataset.field;
      const value = e.detail.value;
      const cur = this.data.displayCares[cidx];
      if (field === 'scale') {
        if (cur && cur.card_equip_lock) return; // 限装备季卡：长度锁定
        const prevScale = equipDiff.normalizeText(cur && cur.scale);
        const nextScale = equipDiff.normalizeText(value);
        if (prevScale === nextScale) return;
        const equipId = Number(cur && cur.member_equipment_id) || 0;
        this._mutate(cidx, (c) => { c.scale = nextScale || null; });
        if (equipId > 0) {
          this._maybePromptEquipEditChoice(cidx, 'scale', prevScale, nextScale);
        }
        return;
      }
      this._mutate(cidx, (c) => { c[field] = value === '' ? null : value; });
    },
    _maybePromptEquipEditChoice(cidx, field, prevValue, nextValue, prevDiffSerial = false) {
      const cur = this.data.displayCares[cidx];
      const equipId = Number(cur && cur.member_equipment_id) || 0;
      if (!cur || equipId <= 0 || cur.card_equip_lock) return;
      if (this._equipEditChoiceMap && cur._key && this._equipEditChoiceMap[cur._key]) {
        return; // 本件装备已在本次开单中选定保存方式，后续改其他字段不再二次弹窗
      }
      const origin = (this._equipOriginById && this._equipOriginById[equipId]) || cur._equipOrigin || null;
      if (origin && equipDiff.diffCareAgainstOrigin(cur, origin).length === 0) {
        return;
      }
      const { equipSummary, changeLine } = equipDiff.formatSingleFieldChange(cur, origin, field, prevValue, nextValue);
      this.setData({
        equipChangeModal: {
          show: true,
          cidx,
          equipId,
          field,
          prevValue,
          prevDiffSerial: !!prevDiffSerial,
          equipSummary,
          changeLine,
        },
      });
    },
    onEquipChangeUpdateOld() {
      const m = this.data.equipChangeModal;
      if (!m || !m.show) return;
      const cur = this.data.displayCares[m.cidx];
      this.setData({
        equipChangeModal: { show: false, cidx: -1, equipId: 0, field: '', prevValue: '', prevDiffSerial: false, equipSummary: '', changeLine: '' },
      });
      if (!cur || Number(cur.member_equipment_id) !== m.equipId) return;
      if (cur._key) {
        this._equipEditChoiceMap = this._equipEditChoiceMap || {};
        this._equipEditChoiceMap[cur._key] = 'update';
      }
      this._refreshCares();
      wx.showToast({ title: '下单时将更新旧装备', icon: 'none' });
    },
    onEquipChangeSaveAsNew() {
      const m = this.data.equipChangeModal;
      if (!m || !m.show) return;
      const cur = this.data.displayCares[m.cidx];
      const origin = (this._equipOriginById && this._equipOriginById[m.equipId]) || (cur && cur._equipOrigin) || null;
      this.setData({
        equipChangeModal: { show: false, cidx: -1, equipId: 0, field: '', prevValue: '', prevDiffSerial: false, equipSummary: '', changeLine: '' },
      });
      if (!cur) return;
      if (cur._key) {
        this._equipEditChoiceMap = this._equipEditChoiceMap || {};
        this._equipEditChoiceMap[cur._key] = 'new';
      }
      const originSerial = origin ? equipDiff.normalizeSerials(origin.serials) : '';
      const curSerial = equipDiff.normalizeSerials(cur.serials);
      const shouldClearCopiedSerial = m.field !== 'serials' && !!(originSerial && curSerial === originSerial);
      if (shouldClearCopiedSerial && cur._key && this._diffSerialMap) {
        delete this._diffSerialMap[cur._key];
      }
      this._mutate(m.cidx, (c) => {
        c.member_equipment_id = equipDiff.ExplicitNewSentinel;
        if (shouldClearCopiedSerial) c.serials = null;
      }, true, false);
      wx.showToast({ title: '下单时将另存为新装备', icon: 'none' });
    },
    onEquipChangeCancel() {
      const m = this.data.equipChangeModal;
      if (!m || !m.show) return;
      const { cidx, field, prevValue, prevDiffSerial } = m;
      const cur = this.data.displayCares[cidx];
      this.setData({
        equipChangeModal: { show: false, cidx: -1, equipId: 0, field: '', prevValue: '', prevDiffSerial: false, equipSummary: '', changeLine: '' },
      });
      if (field && cur) {
        if (field === 'serials' && cur._key) {
          this._diffSerialMap = this._diffSerialMap || {};
          this._diffSerialMap[cur._key] = !!prevDiffSerial;
        }
        this._mutate(cidx, (c) => {
          c[field] = prevValue || null;
        }, true, field !== 'serials');
      }
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
        this._releaseManualBenefitForServiceChange(care, cidx);
        this._mutate(cidx, c => {
          c[flag] = c[flag] === 1 ? 0 : 1;
          if (flag === 'need_wax') c.need_unwax = c.need_wax;
          if (c.need_edge === 1 && !c.edge_degree) c.edge_degree = '89';
          if (c.need_edge !== 1) c.edge_degree = null;
        });
        return;
      }
      if (care.summer != null && (flag === 'need_edge' || flag === 'need_wax' || flag === 'maintain_board' || flag === 'need_unwax' || flag === 'seal_board' || flag === 'urgent')) {
        wx.showToast({ title: '非雪季养护项目固定', icon: 'none' });
        return;
      }
      // 养板（2026-11-10）：和热蜡同一类业务，互斥、互相替换——选上就换掉热蜡 / 机打蜡、默认带刮蜡，再点取消（刮蜡 / 封板一并清掉）。
      // 最终组合由服务端 ApplyServiceLinkage / CareSealRules 收敛，这里先同步免得按钮闪一下。
      if (flag === 'maintain_board') {
        this._releaseManualBenefitForServiceChange(care, cidx);
        const wasScrapeOnly = isScrapeOnlyCare(care, this.data.shop);
        const turnOn = care.maintain_board !== 1;
        this._mutate(cidx, (c) => {
          c.maintain_board = turnOn ? 1 : 0;
          if (turnOn) { c.need_wax = 0; c.free_wax = 0; c.need_unwax = 1; } else { c.need_unwax = 0; }
          c.seal_board = 0;
        });
        this._fetchPrice(cidx, { changed: 'maintain_board' });
        // 刚从「只选刮蜡」变成养板：老顾客券之前因为一口价没带，现在补上
        if (wasScrapeOnly && !isScrapeOnlyCare(this.data.displayCares[cidx], this.data.shop)) this._scheduleOldCustomerTicket();
        return;
      }
      // 刮蜡 / 封板（2026-11-09）：有热蜡或养板时二选一、必选其一（默认刮蜡），所以像单选按钮——
      // 点已选中的那个不动，点另一个就切过去；封板只能跟热蜡 / 养板一起。最终组合由服务端 ApplyServiceLinkage / CareSealRules 收敛。
      if (flag === 'seal_board') {
        if (care.need_wax !== 1 && care.maintain_board !== 1) {
          wx.showToast({ title: '封板需先选热蜡或养板', icon: 'none' });
          return;
        }
        if (care.seal_board === 1) return;
        this._releaseManualBenefitForServiceChange(care, cidx);
        this._mutate(cidx, (c) => { c.seal_board = 1; c.need_unwax = 0; });
        this._fetchPrice(cidx, { changed: 'seal_board' });
        return;
      }
      if (flag === 'need_unwax' && (care.need_wax === 1 || care.maintain_board === 1)) {
        if (care.need_unwax === 1) return;
        this._releaseManualBenefitForServiceChange(care, cidx);
        this._mutate(cidx, (c) => { c.need_unwax = 1; c.seal_board = 0; });
        this._fetchPrice(cidx, { changed: 'need_unwax' });
        return;
      }
      // 只翻本次点的开关；联动（热蜡带刮蜡/机打蜡互斥/修刃默认角度）由服务端
      // ApplyServiceLinkage 判定，响应整个 care 回填
      this._releaseManualBenefitForServiceChange(care, cidx);
      const wasScrapeOnly = isScrapeOnlyCare(care, this.data.shop);
      this._mutate(cidx, (c) => {
        c[flag] = c[flag] === 1 ? 0 : 1;
        // 开/关热蜡都回到默认刮蜡（关热蜡 = 刮蜡、封板都清掉）：服务端联动也这么算，这里先同步免得封板按钮闪一下
        if (flag === 'need_wax' || flag === 'free_wax') c.seal_board = 0;
        // 开热蜡 / 机打蜡会换掉养板（互斥）
        if ((flag === 'need_wax' || flag === 'free_wax') && c[flag] === 1) c.maintain_board = 0;
      });
      this._fetchPrice(cidx, { changed: flag });
      // 刚从「只选刮蜡」变成别的组合：老顾客券之前因为一口价没带，现在补上
      if (wasScrapeOnly && !isScrapeOnlyCare(this.data.displayCares[cidx], this.data.shop)) this._scheduleOldCustomerTicket();
    },
    onSummerTap(e) {
      const cidx = Number(e.currentTarget.dataset.cidx);
      const mode = e.currentTarget.dataset.mode; // 'now' | 'later'
      this._releaseManualBenefitForServiceChange(this.data.displayCares[cidx], cidx);
      // 只翻 summer 本身；later→三项 / now→清三项 / 取消立等 等联动由服务端判定
      this._mutate(cidx, (c) => {
        c.summer = c.summer === mode ? null : mode;
        c.seal_board = 0;   // 非雪季养护不能封板（切回雪季养护也回到默认刮蜡）
        c.maintain_board = 0;   // 非雪季养护也没有养板
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
        const enteringSpecial = (key === 'entertain' && !c.entertain) || (key === 'warranty' && !c.warranty);
        if (enteringSpecial && (c.ticket_code || c.use_card || c.card_id || c.coach_card_id)) {
          // 先带券/卡再切招待或质保时，取消已有权益；保留服务和店员手动减免。
          c.ticket = null;
          c.ticket_code = null;
          c.ticket_discount = 0;
          c.use_card = false;
          c.card_id = null;
          c.card_name = null;
          c.card_equip_lock = false;
          c.card_pending_open = false;
          c.coach_card_id = null;
          c._coachCardName = '';
          c._coachHint = '';
          c.discount = Number(c._manualDiscount) || 0;
        }
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
      if (field === 'discount') {
        this._ensureBenefitMember();
        const care = this.data.displayCares[cidx];
        if (care) {
          const key = this._benefitIdentity(care, cidx);
          this._autoBenefitBaseDiscount[key] = v;
          delete this._benefitBasisSnapshots[key];
        }
      }
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
      const memberId = Number(this.data.memberId) || 0;
      const cards = this._machineWaxCardsMemberId === memberId ? this._machineWaxSeasonCards || [] : [];
      // 按顾客账户显示按钮；使用时仍检查季卡今天是否已用及绑定装备是否匹配。
      return this.data.newCardMode === 'machine' || this.data.hasMachineWaxTicket || cards.some(card => card && !card.is_refund
        && (card.member_id == null || Number(card.member_id) === memberId)
        && (!card.biz_type || card.biz_type === '养护')
        && (card.isSeason || card.total === null || (card.card_name || '').includes('季卡'))
        && cardRules.isMachineWaxSeasonCard(card.card_name, null));
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
      const scheduled = Promise.resolve().then(() => {
        this._ticketAutoQueued = false;
        if (!this._ticketAutoDetached) return this._autoSelectOldCustomerTicket();
      }).catch(e => console.warn('auto select old customer ticket failed', e));
      // 包含等待服务联动的阶段，确保结算和 waitForPrices 不会在比价开始前结束。
      this._trackCarePrice(scheduled);
    },
    _autoTicketBlocked() {
      return this._ticketAutoDetached || this.data.newCardMode || this.data.hasCardSelection
        || this.data.cardBusy || this.data.cardSubmitted || this.data.ticketPopup.show;
    },
    _ensureBenefitMember() {
      const memberId = Number(this.data.memberId) || 0;
      if (this._oldCustomerTicketMember !== memberId) {
        this._oldCustomerTicketMember = memberId;
        this._oldCustomerTicketState = null;
        this._oldCustomerPricePromise = null;
        this._manualTicketChoices = {};
        this._autoBenefitSelections = {};
        this._autoBenefitBaseDiscount = {};
        this._benefitBasisSnapshots = {};
        this._bestBenefitState = null;
      }
      this._autoBenefitBaseDiscount = this._autoBenefitBaseDiscount || {};
      this._benefitBasisSnapshots = this._benefitBasisSnapshots || {};
    },
    _rememberManualTicketChoice(cidx) {
      this._ensureBenefitMember();
      const care = this.data.displayCares[cidx];
      if (care) {
        (this._manualTicketChoices || (this._manualTicketChoices = {}))[this._careKey(care, cidx)] = true;
        const key = this._benefitIdentity(care, cidx);
        delete this._benefitBasisSnapshots[key];
        delete this._autoBenefitBaseDiscount[key];
      }
    },
    _benefitIdentity(care, index) {
      return care.timeStamp ? 't' + care.timeStamp : this._careKey(care, index);
    },
    _releaseManualBenefitForServiceChange(care, index) {
      if (!care) return;
      this._ensureBenefitMember();
      if (this._manualTicketChoices) delete this._manualTicketChoices[this._careKey(care, index)];
      const selected = selectedBenefitKey(care);
      const key = this._benefitIdentity(care, index);
      if (selected) {
        // 旧草稿的 discount 可能包含券卡优惠：先按旧项目还原权益优惠，再比较新项目。
        if (care._manualDiscount == null && this._autoBenefitBaseDiscount[key] == null && Number(care.discount) > 0
          && !this._benefitBasisSnapshots[key]) {
          const payload = this._stripUI(care);
          Object.assign(payload, { ticket: null, product: null, careImages: null, discount: 0, ticket_discount: 0 });
          this._benefitBasisSnapshots[key] = { care: payload, discount: Number(care.discount) };
        }
        (this._autoBenefitSelections || (this._autoBenefitSelections = {}))[key] = selected;
      }
    },
    async _resolveBenefitBases(memberId) {
      const snapshots = this._benefitBasisSnapshots;
      const entries = Object.entries(snapshots);
      if (!entries.length) {
        if (this._benefitBasisFailed) { this._benefitBasisFailed = false; this.setData({ priceError: false }); }
        return;
      }
      if (!memberId || !this.data.shop) return;
      try {
        await Promise.all(entries.map(async ([key, snapshot]) => {
          const result = await data.calcCareChargePromise({ shop: this.data.shop, memberId,
            care: snapshot.care, deriveServices: false }, app.globalData.sessionKey);
          if (this._benefitBasisSnapshots !== snapshots || snapshots[key] !== snapshot) return;
          if (!result || !result.care) throw new Error('原券卡优惠计算失败');
          const benefitDiscount = Number(result.care.discount) || 0;
          this._autoBenefitBaseDiscount[key] = snapshot.discount > benefitDiscount ? snapshot.discount : 0;
          delete snapshots[key];
        }));
        if (this._benefitBasisFailed && this._benefitBasisSnapshots === snapshots) {
          this._benefitBasisFailed = false;
          this.setData({ priceError: false });
        }
      } catch (error) {
        if (this._benefitBasisSnapshots === snapshots) {
          this._benefitBasisFailed = true;
          this.setData({ priceError: true });
        }
        throw error;
      }
    },
    _benefitInput(care, index) {
      const key = this._benefitIdentity(care, index);
      const selection = selectedBenefitKey(care);
      const auto = !!selection && this._autoBenefitSelections && this._autoBenefitSelections[key] === selection;
      const manual = !!(this._manualTicketChoices || {})[this._careKey(care, index)] || (!!selection && !auto);
      const saved = this._autoBenefitBaseDiscount && this._autoBenefitBaseDiscount[key];
      const discount = care._manualDiscount != null ? Number(care._manualDiscount) || 0
        : auto && saved != null ? saved : Number(care.discount) || 0;
      return { key, selection, auto, manual, discount };
    },
    _benefitSignature() {
      const fields = ['id', 'timeStamp', 'equipment', 'brand', 'scale', 'need_edge', 'edge_degree', 'need_wax', 'need_unwax',
        'free_wax', 'maintain_board', 'seal_board', 'summer', 'urgent', 'repair_charge', 'need_repair', 'repair_memo',
        'warranty', 'entertain', 'is_cancel'];
      return JSON.stringify({ memberId: Number(this.data.memberId) || 0, shop: this.data.shop,
        cares: (this.data.displayCares || []).map((c, i) => {
          const info = this._benefitInput(c, i), v = { key: info.key, manual: info.manual, discount: info.discount };
          fields.forEach(k => { v[k] = c[k] == null ? null : c[k]; });
          if (info.manual) v.selection = info.selection;
          return v;
        }) });
    },
    async _autoSelectOldCustomerTicket() {
      this._ensureBenefitMember();
      const memberId = Number(this.data.memberId) || 0;
      await this._resolveBenefitBases(memberId);
      // 先等项目开关的服务端联动（例如热蜡带刮蜡）落回，再比较权益。
      await Promise.resolve();
      while (this._servicePriceWork && this._servicePriceWork.size && !this._autoTicketBlocked()) {
        await Promise.all(Array.from(this._servicePriceWork));
      }
      if (this.data.priceError && (!this._bestBenefitState || !this._bestBenefitState.failed)) return;
      if ((Number(this.data.memberId) || 0) !== memberId) return;
      const current = this.data.displayCares || [];
      if (!current.length) {
        this._bestBenefitState = null;
        this._memberCareTicketsLoad = null;
        this._manualTicketChoices = {};
        return;
      }
      if (!memberId || !this.data.shop || this._autoTicketBlocked()) return;
      const signature = this._benefitSignature();
      if (this._bestBenefitState && this._bestBenefitState.signature === signature) return this._bestBenefitState.promise;
      const state = { signature, memberId };
      this._bestBenefitState = state;
      const stillCurrent = () => this._bestBenefitState === state && !this._autoTicketBlocked()
        && Number(this.data.memberId) === memberId && this._benefitSignature() === signature;
      const abandon = () => { if (this._bestBenefitState === state) this._bestBenefitState = null; };
      const snapshot = current.map((care, i) => ({ care, i, info: this._benefitInput(care, i) }));
      const targets = snapshot.filter(x => !x.info.manual && !x.care.is_cancel && !x.care.warranty && !x.care.entertain
        && (hasChosenService(x.care) || x.info.auto));
      if (!targets.length) { state.promise = Promise.resolve(); return state.promise; }
      state.promise = this._trackCarePrice((async () => {
        const coachLoad = typeof data.listUsableCoachCardsPromise === 'function'
          ? data.listUsableCoachCardsPromise(memberId, '养护', { shop: this.data.shop }, app.globalData.sessionKey)
          : Promise.resolve({ cards: [] });
        const [tickets, cardList, coachResult] = await Promise.all([
          this._getMemberCareTickets(memberId).promise, this._getMemberCareCards(memberId).promise, coachLoad,
        ]);
        if (!stillCurrent()) { abandon(); return; }
        const manual = snapshot.filter(x => x.info.manual && !x.care.is_cancel);
        const occupiedTickets = new Set(manual.map(x => x.care.ticket_code).filter(Boolean));
        const cardEntries = autoCareCards(cardList, memberId);
        const resources = [];
        (tickets || []).forEach(ticket => {
          if (!ticket || !ticket.code || occupiedTickets.has(ticket.code)) return;
          resources.push({ key: 'ticket:' + ticket.code, id: ticket.code, type: 'ticket', capacity: 1,
            expire: ticket.expire_date, ticket });
        });
        cardEntries.forEach(entry => {
          const card = entry.card;
          if (entry.season && card.usedToday) return;
          const occupied = manual.filter(x => x.care.use_card && Number(x.care.card_id) === Number(card.id)).length;
          const capacity = entry.capacity - occupied;
          if (capacity > 0) resources.push({ key: 'card:' + card.id, id: card.id, type: entry.season ? 'season' : 'punch',
            capacity, card, entry });
        });
        ((coachResult && coachResult.cards) || []).forEach(coach => {
          if (coach && coach.cardId) resources.push({ key: 'coach:' + coach.cardId, id: coach.cardId,
            type: 'coach', capacity: targets.length, expire: coach.validUntil, coach });
        });
        if (!resources.length && targets.every(x => !x.info.auto)) {
          if (targets.some(x => x.care.free_wax === 1)) throw new Error('没有可用的养护权益，请重新选择');
          return;
        }
        const byKey = new Map(resources.map(r => [r.key, r]));
        const jobs = [], plans = [];
        targets.forEach(target => {
          const c = target.care;
          if (!hasChosenService(c)) { plans.push({ target, baseline: 0, options: [], requiresBenefit: false }); return; }
          const payload = this._stripUI(c);
          Object.assign(payload, { ticket: null, product: null, careImages: null, ticket_code: null,
            ticket_discount: 0, use_card: false, card_id: null, card_name: null, coach_card_id: null,
            discount: target.info.discount });
          const plan = { target, baseline: null, options: [], requiresBenefit: c.free_wax === 1 };
          plans.push(plan);
          jobs.push({ plan, payload, resource: null });
          const grouped = new Map();
          resources.forEach(r => {
            if (r.card && careFitsCard(c, r.entry) !== true) return;
            if (c.free_wax === 1 && !(r.ticket && Number(r.ticket.template_id) === 12)
              && !(r.card && r.type === 'season' && cardRules.isMachineWaxSeasonCard(r.card.card_name, null))) return;
            if (r.card && (c.summer || c.maintain_board)) return;
            const group = r.ticket ? 'ticket-template:' + (r.ticket.template_id || r.id)
              : r.card ? 'card-pricing:' + JSON.stringify([r.type, r.card.card_name, r.card.care_project_count]) : r.key;
            if (!grouped.has(group)) grouped.set(group, []);
            grouped.get(group).push(r);
          });
          grouped.forEach(group => jobs.push({ plan, payload, resource: group[0], group }));
        });
        await mapConcurrent(jobs, 4, async job => {
          // 项目或顾客变化后，尚未发出的旧报价不再占用网络。
          if (!stillCurrent()) { abandon(); return; }
          const care = { ...job.payload }, r = job.resource;
          if (r && r.ticket) care.ticket_code = r.ticket.code;
          if (r && r.card) { care.use_card = true; care.card_id = r.card.id; care.card_name = r.card.card_name; }
          if (r && r.coach) care.coach_card_id = r.coach.cardId;
          const result = await data.calcCareChargePromise({ shop: this.data.shop, memberId, care, deriveServices: false }, app.globalData.sessionKey);
          if (!result || !result.care) throw new Error('券卡试算未返回完整价格');
          const priced = result.care;
          const net = (Number(priced.common_charge) || 0) + (Number(priced.repair_charge) || 0)
            - (Number(priced.discount) || 0) - (Number(priced.ticket_discount) || 0);
          // 下单会累加原始金额；手动减免加上卡优惠导致负数时，不能当成免费自动选卡。
          if (r && net < -0.005) return;
          const amount = Math.max(0, net);
          if (!r) { job.plan.baseline = amount; job.plan.baselineQuote = priced; return; }
          const kept = r.ticket ? priced.ticket_code === r.ticket.code
            : r.card ? priced.use_card && Number(priced.card_id) === Number(r.card.id)
              : Number(priced.coach_card_id) === Number(r.coach.cardId) && result.coach && result.coach.discount > 0;
          if (kept) job.group.forEach(item => job.plan.options.push({ key: item.key, amount, quote: priced }));
        });
        if (!stillCurrent()) { abandon(); return; }
        plans.forEach(p => { if (p.requiresBenefit) p.baseline = null; });
        const selected = bestBenefit.assign(plans, resources);
        if (!stillCurrent()) { abandon(); return; }
        const changed = [];
        const cares = (this.data.cares || []).slice();
        plans.forEach((plan, pidx) => {
          const { target } = plan, i = target.i, prev = this.data.displayCares[i];
          const resource = byKey.get(selected[pidx]);
          if (!this._autoBenefitSelections) this._autoBenefitSelections = {};
          if (!this._autoBenefitBaseDiscount) this._autoBenefitBaseDiscount = {};
          this._autoBenefitSelections[target.info.key] = selected[pidx] || null;
          this._autoBenefitBaseDiscount[target.info.key] = target.info.discount;
          if (selectedBenefitKey(prev) === (selected[pidx] || null)) {
            const quote = selected[pidx] ? (plan.options.find(o => o.key === selected[pidx]) || {}).quote : plan.baselineQuote;
            if (quote && ((Number(prev.common_charge) || 0) !== (Number(quote.common_charge) || 0)
              || (Number(prev.discount) || 0) !== (Number(quote.discount) || 0)
              || (Number(prev.ticket_discount) || 0) !== (Number(quote.ticket_discount) || 0))) changed.push(i);
            return;
          }
          const c = { ...prev, ticket: null, ticket_code: null, ticket_discount: 0, use_card: false, card_id: null,
            card_name: null, card_equip_lock: false, card_pending_open: false, coach_card_id: null,
            _coachCardName: '', _coachCardLabel: '', _coachHint: '', discount: target.info.discount };
          if (resource && resource.ticket) { c.ticket = resource.ticket; c.ticket_code = resource.ticket.code; }
          if (resource && resource.card) Object.assign(c, autoCardFields(resource.entry));
          if (resource && resource.coach) { c.coach_card_id = resource.coach.cardId; c._coachCardName = resource.coach.coachName || ''; c._coachCardLabel = resource.coach.cardName || ''; }
          cares[i] = c; changed.push(i);
        });
        if (changed.length) {
          this.data.cares = cares;
          this._refreshCares();
          this._emitSync(true);
          await Promise.all(changed.map(i => this._fetchPrice(i)));
        }
        if (this._bestBenefitState === state) this.setData({ priceError: false });
      })().catch(error => {
        if (stillCurrent()) {
          state.failed = true;
          this.setData({ priceError: true });
          if (error && /没有可用的养护权益/.test(error.message || '')) {
            wx.showToast({ title: '机打蜡权益不足或装备不匹配', icon: 'none' });
          }
        }
        throw error;
      }));
      return state.promise;
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
        c.ticket_discount = 0;
        c.use_card = false;
        c.card_id = null;
        c.card_name = null;
        c.card_equip_lock = false;
        c.card_pending_open = false;
        c.discount = Number(c._manualDiscount) || 0;
        c.coach_card_id = coachCard.cardId;
        c._coachCardName = coachCard.coachName || '';
        c._coachCardLabel = coachCard.cardName || '';
        c._coachHint = '';
      });
      return this._fetchPrice(cidx);
    },
    // 选券/选卡的唯一落地口。手选弹层和扫码（onTicketScan）都走这里——
    // 「扫出来的效果要和手选一模一样」靠的是同一段代码，不是两段写成一样
    _applyTicketSelection(cidx, ticket, card, options) {
      const that = this;
      // 选券/选卡后表单可能瞬间变「已录入」，显式记住展开态——装备卡片不自动折叠
      const curCare = this.data.displayCares[cidx];
      const preserveServices = !!(options && options.preserveServices) || !!(curCare && hasChosenService(curCare));
      this._rememberManualTicketChoice(cidx);
      if (curCare && curCare._key) {
        this.data.expandedMap[curCare._key] = true;
      }
      this._mutate(cidx, (c) => {
        // 已选服务时以店员选的项目为准；尚未选择服务时，手选卡仍沿用原有服务推导。
        // 立等/维修/质保/招待与券无关，保留。
        if (!preserveServices) {
          c.need_edge = 0;
          c.edge_degree = null;
          c.need_wax = 0;
          c.need_unwax = 0;
          c.seal_board = 0;
          c.maintain_board = 0;
          c.free_wax = 0;
          c.summer = null;
          if (c.biz_type === '非雪季养护') c.biz_type = null;
        }
        c.discount = Number(c._manualDiscount) || 0;
        c.ticket_discount = 0;
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
            if (c.equipment === '单板') c.with_pole = false;   // 季卡绑的是单板：没有雪杖
            c.brand = card.equip_brand;
            c.scale = card.equip_scale;
            // 若原关联的会员装备与季卡绑定装备不一致，解除指定 id，由后端按类型+品牌+长度自动匹配或建档，防错改另一块板
            const orig = (Number(c.member_equipment_id) > 0 && that._equipOriginById && that._equipOriginById[c.member_equipment_id]) || null;
            if (orig && (orig.equipment !== equipDiff.normalizeText(card.equip_type)
              || orig.brand !== equipDiff.normalizeText(card.equip_brand)
              || orig.scale !== equipDiff.normalizeText(card.equip_scale))) {
              c.member_equipment_id = null;
            }
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
      return that._fetchPrice(cidx, preserveServices
        ? (options && options.preserveServices ? { changed: 'free_wax' } : undefined) : { derive: true });
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
      this._equipOriginById = {};
      const cares = this.data.displayCares || [];
      let cleared = 0;
      cares.forEach((c, i) => {
        const hadBenefit = !!(c.ticket_code || c.use_card);
        const hadEquip = Number(c.member_equipment_id) > 0;
        if (!hadBenefit && !hadEquip) return;
        if (hadBenefit) cleared += 1;
        this._mutate(i, (x) => {
          if (hadEquip) x.member_equipment_id = equipDiff.ExplicitNewSentinel;
          if (!hadBenefit) return;
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
    async _confirmEquipmentModifications() {
      const memberId = Number(this.data.memberId) || 0;
      if (!memberId) return true;
      const curList = this.data.displayCares || [];
      const needLoad = curList.some((c) => {
        const id = Number(c && c.member_equipment_id) || 0;
        return id > 0 && !(this._equipOriginById && this._equipOriginById[id]) && !c._equipOrigin;
      });
      if (needLoad) {
        try {
          const allEquips = await this._fetchMemberEquips(memberId, '');
          this._rememberEquipOrigins(allEquips);
          this._refreshCares();
        } catch (_) {
          // 网络异常获取不到快照时，不阻断结算，后端仍做原子比对与审计
        }
      }
      const unconfirmedCares = (this.data.displayCares || []).filter((c) => c && c._equipEditChoice !== 'update');
      const modified = equipDiff.collectModifiedEquipments(unconfirmedCares);
      if (modified.length === 0) return true;
      if (!wx || typeof wx.showModal !== 'function') return true;
      return new Promise((resolve) => {
        wx.showModal({
          title: '确认修改会员装备',
          content: equipDiff.formatConfirmContent(modified),
          confirmText: '确认更新',
          cancelText: '返回检查',
          success(res) {
            resolve(!!(res && res.confirm));
          },
          fail() {
            resolve(false);
          },
        });
      });
    },

    async onCheckout() {
      if (this.data.equipChangeModal && this.data.equipChangeModal.show) return;
      if (!this.data.summary.canCheckout || this.data.autoTicketCheckout || this.data.cardBusy) return;
      this.setData({ autoTicketCheckout: true });
      try {
        // 结算前刷新账户权益，避免使用开单期间被其他订单核销的券或次卡。
        this._bestBenefitState = null;
        this._memberCareTicketsLoad = null;
        this._memberCareCardsLoad = null;
        await this._autoSelectOldCustomerTicket();
        await this.waitForPrices();
        if (this._ticketAutoDetached || this.data.cardBusy || !this.data.summary.canCheckout) return;
        // 若选择了会员已有装备并修改了品牌/长度/序列号，弹窗提示确认后再保存进数据库并记录修改历史
        const confirmed = await this._confirmEquipmentModifications();
        if (!confirmed || this._ticketAutoDetached || this.data.cardBusy || !this.data.summary.canCheckout) return;
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
