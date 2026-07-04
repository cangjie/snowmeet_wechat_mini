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
    // 优惠券弹层
    ticketPopup: { show: false, cidx: -1, selectedCode: null, disabledCodes: [] },
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
          _expanded: expandedMap[key] === undefined ? care.id === 0 && !ev.ok : expandedMap[key],
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
    /* ---------- 估价（展示用；真理之源是 PlaceCareOrder 服务端重算） ---------- */
    _fetchPrice(cidx) {
      const that = this;
      const care = this.data.displayCares[cidx];
      if (!care) return;
      // 票券定价路径
      if (care.ticket_code && care.ticket && care.ticket.template_id === 12) {
        that._applyTicketPrice(cidx);
        return;
      }
      if (care.summer != null) {
        that._mutate(cidx, (c) => { c.common_charge = 330; });
        return;
      }
      let serviceName = null;
      if (care.need_edge === 1 && care.need_wax === 1) serviceName = '双项';
      else if (care.need_wax === 1) serviceName = '打蜡';
      else if (care.need_edge === 1) serviceName = '修刃';
      if (!serviceName) {
        that._mutate(cidx, (c) => { c.common_charge = 0; });
        return;
      }
      data.getCareProductPromise(this.data.shop, serviceName, care.urgent).then((product) => {
        that._mutate(cidx, (c) => {
          c.common_charge = product ? product.sale_price : 0;
          c.product = product || null;
        });
        // 16 号折扣券随项目变化重算减免
        const cur = that.data.displayCares[cidx];
        if (cur && cur.ticket_code && cur.ticket && cur.ticket.template_id === 16) {
          that._applyTicket16Discount(cidx);
        }
      }).catch(() => {
        that._mutate(cidx, (c) => { c.common_charge = 0; });
      });
    },
    // 票券 12（免费机打蜡）：按票模板产品 fixed_price 定价（对齐旧 getTicketProduct）
    _applyTicketPrice(cidx) {
      const that = this;
      const care = this.data.displayCares[cidx];
      const ticket = care.ticket;
      if (!ticket || !ticket.template || !ticket.template.productTicketTemplates
        || ticket.template.productTicketTemplates.length === 0) return;
      const templates = ticket.template.productTicketTemplates;
      const pick = (item) => {
        for (let i = 0; i < templates.length; i++) {
          const prodName = (templates[i].product && templates[i].product.name) || '';
          if (item === '修刃' && prodName.indexOf('修刃') >= 0 && prodName.indexOf('打蜡') < 0) return templates[i];
          if (item === '打蜡' && prodName.indexOf('修刃') < 0 && prodName.indexOf('打蜡') >= 0) return templates[i];
          if (item === '双项' && prodName.indexOf('修刃') >= 0 && prodName.indexOf('打蜡') >= 0) return templates[i];
        }
        return null;
      };
      let template = null;
      if (care.free_wax === 1) {
        template = care.need_edge === 1 ? pick('修刃') : null;
      } else {
        template = care.need_edge === 1 ? pick('双项') : pick('打蜡');
      }
      that._mutate(cidx, (c) => {
        if (template) {
          c.product = template.product;
          c.common_charge = template.fixed_price;
        } else {
          c.product = null;
          c.common_charge = 0;
        }
      });
    },
    // 票券 16（折扣券）：双项减 30 / 单项减 20（对齐旧 setDiscount）
    _applyTicket16Discount(cidx) {
      this._mutate(cidx, (c) => {
        if (c.need_edge === 1 && c.need_wax === 1) c.discount = 30;
        else if (c.need_edge === 1 || c.need_wax === 1) c.discount = 20;
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
      this._mutate(cidx, (c) => {
        if (c.equipment === equip) return;
        c.equipment = equip;
        // 换类型后品牌/其它服务字典跟随切换，原选择作废
        c.brand = null;
        c.repair_memo = null;
        c.need_repair = 0;
      });
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
        ticketPopup: { show: true, cidx, selectedCode: (care && care.ticket_code) || null, disabledCodes },
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
      this.setData({ 'ticketPopup.show': false });
      this._mutate(cidx, (c) => {
        if (ticket) {
          c.ticket = ticket;
          c.ticket_code = ticket.code;
          if (ticket.template_id === 12) {
            c.free_wax = 1;
            c.need_wax = 0;
            c.need_unwax = 0;
          } else if (ticket.template_id === 17) {
            c.need_edge = 0; c.need_wax = 0; c.need_unwax = 0;
            c.summer = 'now';
            c.biz_type = '非雪季养护';
          } else if (ticket.template_id === 18) {
            c.need_edge = 1;
            if (!c.edge_degree) c.edge_degree = '89';
            c.need_wax = 1; c.need_unwax = 1;
            c.summer = 'later';
            c.biz_type = '非雪季养护';
          }
        } else {
          c.ticket = null;
          c.ticket_code = null;
          c.free_wax = 0;
          c.discount = 0;
        }
      });
      const cur = that.data.displayCares[cidx];
      if (cur && cur.ticket_code && cur.ticket) {
        if (cur.ticket.template_id === 12) that._applyTicketPrice(cidx);
        else if (cur.ticket.template_id === 16) that._applyTicket16Discount(cidx);
        else that._fetchPrice(cidx);
      } else {
        that._fetchPrice(cidx);
      }
    },
    /* ---------- 结算 ---------- */
    onCheckout() {
      if (!this.data.summary.canCheckout) return;
      const cares = this.data.displayCares.map((c) => this._stripUI(c));
      this.triggerEvent('checkout', { cares });
    },
  },
});
