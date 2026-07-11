// pages/admin/reception/recept_new.js
// 业务开单（共享页）
// 责任划分（参考 pages/admin/recept/recept_new.js）：
//   * 顶级页：持有客户信息 / 订单数据，监听各 *-recept-form 子组件事件，
//             按需向 SnowmeetApi 同步订单（Rent/SaveRentRecept 等）
//   * 子组件：仅渲染表单 + 通过事件回传数据更新
//
// 当前实现：租赁开单第一步（rent-recept-form）。其他业务后续迭代。
const app = getApp();
const util = require('../../../utils/util.js');

const BIZ_LABELS = { rent: '租赁', maintain: '养护', retail: '零售' };
// 找回中断单时从 order.type 反推 bizType（URL/draft 里的 bizType 可能与单子实际业务不符）
const TYPE_TO_BIZ = { '租赁': 'rent', '养护': 'maintain', '零售': 'retail' };

// 防御性解码：如果 options 已经是解码过的就原样返回；如果还是 %xx 格式则解一次
function safeDecode(v) {
  if (v == null) return v;
  const s = String(v);
  if (s.indexOf('%') < 0) return s;
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

Page({
  data: {
    bizType: '',
    bizLabel: '',
    shop: '',
    customer: {
      memberId: null,
      name: '',
      cell: '',
      cellMasked: '未提供',
      gender: '',
    },
    // 订单本地状态（与后端同步）
    order: {
      id: 0,
      code: null,
      type: '',
      shop: '',
      member_id: null,
      rentals: [],
      cares: [],
    },
  },

  /* ---------- 生命周期 ---------- */

  async onLoad(options) {
    // 等待 app 登录流程把测试/生产域名切换到位（开发/体验版从 domain.txt 读测试域名）
    // 否则直接进入本页时 globalData.requestPrefix 还是默认 mini.snowmeet.top，会打到生产域名
    await app.loginPromiseNew;

    // 优先从订单id获取顾客信息，如果订单id为空或者从订单获取到的用户信息为空，则需要从参数获取顾客信息。
    const draft = wx.getStorageSync('reception_draft') || {};
    const bizType = safeDecode(options.bizType) || draft.bizType || 'rent';
    const shop = safeDecode(options.shop) || draft.shopName || '';

    let customer = { memberId: null, name: '', cell: '', gender: '' };
    let orderId = options.orderId ? safeDecode(options.orderId) : null;
    let orderCustomerLoaded = false;
    let recoveredOrder = null;  // 找回中断订单：连同 rentals 一起恢复

    if (orderId) {
      try {
        const data = require('../../../utils/data.js');
        const sessionKey = app.globalData.sessionKey || '';
        // 用 GetReceptingOrder（不按 rental.valid 过滤）拉中断单；接待中 rental 是 valid=0 草稿态，
        // 去结算 PlaceRentOrder 才置 1。若用 GetOrderByStaff（valid=1 过滤）会把草稿 rental 滤掉 → 找回成空单
        const order = await data.getRentReceptingOrderPromise(orderId, sessionKey);
        if (order && order.id) {
          recoveredOrder = order;
          if (order.contact_name || order.contact_num || order.member_id) {
            customer = {
              memberId: order.member_id || null,
              name: order.contact_name || '',
              cell: order.contact_num || '',
              gender: order.contact_gender || '',
            };
            orderCustomerLoaded = true;
          }
        }
      } catch (e) {
        console.warn('Failed to load recepting order by orderId:', e);
      }
    }

    if (!orderCustomerLoaded) {
      // fallback to params/draft
      customer = {
        memberId: options.memberId ? Number(safeDecode(options.memberId)) : null,
        name: safeDecode(options.customerName) || draft.customerName || '',
        cell: safeDecode(options.customerCell) || draft.customerCell || '',
        gender: safeDecode(options.gender) || draft.gender || '',
      };
    }

    if (recoveredOrder) {
      // 恢复整单（含 id + rentals/cares），购物车直接显示原有商品，后续保存更新同一张中断单。
      // bizType 以单子实际 order.type 为准：养护草稿从 URL 缺省 'rent' 进来时若不反推，会被租赁表单渲染
      const recoveredBiz = TYPE_TO_BIZ[(recoveredOrder.type || '').trim()] || bizType;
      (recoveredOrder.rentals || []).forEach((r) => {
        r.timeStamp = (new Date(r.create_date || Date.now())).getTime();
      });
      (recoveredOrder.cares || []).forEach((c) => {
        c.timeStamp = (new Date(c.create_date || Date.now())).getTime();
      });
      this.setData({
        bizType: recoveredBiz,
        bizLabel: BIZ_LABELS[recoveredBiz] || '业务',
        shop: recoveredOrder.shop || shop,
        customer,
        order: recoveredOrder,
      });
    } else {
      this.setData({
        bizType,
        bizLabel: BIZ_LABELS[bizType] || '业务',
        shop,
        customer,
        'order.type': BIZ_LABELS[bizType] || '',
        'order.shop': shop,
        'order.member_id': customer.memberId,
      });
    }
  },

  onShow() {},

  /* ---------- 通用：返回 / 顶部 ---------- */
  onBack() { wx.navigateBack({ delta: 1 }); },

  onMemberDetail(e) {
    const memberId = (e && e.detail && e.detail.memberId) || this.data.customer.memberId;
    if (!memberId) return;
    wx.navigateTo({
      url: '/pages/admin/member/member_detail?id=' + memberId,
    });
  },

  onMemberInfoFound(e) {
    const memberId = e && e.detail && e.detail.memberId;
    if (!memberId) return;
    if (this.data.customer && this.data.customer.memberId === memberId) return;
    this.setData({
      'customer.memberId': memberId,
      'order.member_id': memberId,
    });
  },

  /* ---------- 子组件：rent-recept-form 事件 ---------- */
  /**
   * 子组件每次购物车变化都会触发 syncRent
   * 参考 recept_new.js 的 rentDataUpdated → saveReceptOrder
   */
  onSyncRent(e) {
    const detail = e.detail || {};
    const rentals = detail.rentals || [];
    this.setData({ 'order.rentals': rentals });
    // fire-and-forget：错误已在内部 console.warn，这里吞掉 rejection 避免 unhandled
    Promise.resolve(this.saveRentReceptOrder()).catch(() => {});
  },

  /* ---------- 子组件：care-recept-form 事件 ---------- */
  onSyncCare(e) {
    const detail = e.detail || {};
    const cares = detail.cares || [];
    this.setData({ 'order.cares': cares });
    Promise.resolve(this.saveCareReceptOrder()).catch(() => {});
  },

  onAddAction(e) {
    const action = (e.detail || {}).action;
    if (action === 'package') {
      wx.navigateTo({
        url: '/pages/admin/reception/recept_package?shop=' + encodeURIComponent(this.data.shop || ''),
        events: {
          rentalsSelected: (rentals) => {
            this._appendRentals(rentals);
          },
        },
      });
      return;
    }
    if (action === 'scan') {
      wx.scanCode({
        success: (res) => {
          wx.showToast({ title: '已扫码：' + (res.result || '').slice(0, 12), icon: 'none' });
          // TODO: 调 Rent/QueryByBarcode 后追加到购物车
        },
      });
      return;
    }
    if (action === 'noCode') {
      this._addBlankRental();
      return;
    }
    // search 由子组件内部处理（开搜索 modal → addSingleProduct 事件 → onAddSingleProduct）
    wx.showToast({ title: '操作（下一步迭代）', icon: 'none' });
  },

  // 「无码物品」入口：追加一个 category_id=null 的 rental 含一个待选分类的主项 rentItem。
  // 用户在 form 组件内点 rentItem 的「分类」行打开分类选择 modal；选定后由 form 组件内的
  // _applyCategoryChange 拉 fullCategory + priceList，更新主项 + 按 associateCategories 重建附件项。
  _addBlankRental() {
    const now = new Date();
    const startDate = util.formatDate(now);
    const startDateIsWeekend = util.isWeekend(now);
    const startDateTime = `${startDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    const defaultPickType = (this.data.shop || '').indexOf('万龙') === 0 ? '立即租赁' : null;
    const atOnce = defaultPickType === '立即租赁';

    const mainItem = {
      id: 0,
      rental_id: 0,
      is_associate: false,
      noCode: true,
      canChooseCategory: false,
      chooseCategories: [],
      chooseingCategory: false,
      categoryName: '',
      class_name: '',
      name: null,
      code: null,
      rent_product_id: null,
      category_id: null,
      memo: '',
      category: null,
      pick_type: defaultPickType,
      atOnce,
      valid: 1,
    };

    const rental = {
      id: 0,
      order_id: null,
      package_id: null,
      category_id: null,
      name: '',
      valid: 0,
      expectDays: 1,
      guaranty: 0,
      realGuaranty: 0,
      guaranty_discount: 0,
      start_date: startDateTime,
      startDateIsWeekend,
      priceList: [],
      memo: '',
      timeStamp: Date.now(),
      pick_type: defaultPickType,
      atOnce,
      category: null,
      rentItems: [mainItem],
    };
    util.createRentalDetail(rental, new Date(startDate), new Date(startDate));
    this._appendRentals([rental]);
  },

  // 「搜索单品」选中产品后：构造 package_id=null 的 rental 追加到购物车
  // rentItems = [主项（已填好编码/名称）, ...附件项（按品类带的 associateCategories 自动生成）]
  // 后端 SaveRentRecept 保存后会调 BuildAssociates 同步关联表，但返回的 order 不含新插入的附件项，
  // 所以前端必须自己构造附件项一起提交（参考 RentController.cs#BuildAssociates 4363-4400）
  async onAddSingleProduct(e) {
    const product = (e.detail || {}).product;
    if (!product || !product.category) return;
    const data = require('../../../utils/data.js');
    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const [shopObj, fullCategory] = await Promise.all([
        data.getShopByNamePromise(this.data.shop || ''),
        data.getRentCategoryPromise(product.category.id),
      ]);
      if (!shopObj || !shopObj.id) {
        wx.hideLoading();
        wx.showToast({ title: '店铺信息未加载，请重试', icon: 'none' });
        return;
      }
      const priceList = await data.getRentPriceListPromise(shopObj.id, '分类', product.category.id, '门市');
      wx.hideLoading();

      const now = new Date();
      const startDate = util.formatDate(now);
      const startDateIsWeekend = util.isWeekend(now);
      const startDateTime = `${startDate}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
      const defaultPickType = (this.data.shop || '').indexOf('万龙') === 0 ? '立即租赁' : null;
      const atOnce = defaultPickType === '立即租赁';
      const deposit = (product.category && product.category.deposit) || 0;

      // 主装备项（已填好的单品）
      const mainItem = {
        id: 0,
        rental_id: 0,
        is_associate: false,
        noCode: false,
        canChooseCategory: false,
        chooseCategories: [product.category],
        chooseingCategory: false,
        categoryName: product.category.name,
        class_name: product.category.name,
        name: product.name || '',
        code: String(product.barcode || ''),
        rent_product_id: product.id,
        category_id: product.category.id,
        memo: '',
        category: product.category,
        pick_type: defaultPickType,
        atOnce,
        valid: 1,
      };

      // 附件项：按品类的 associateCategories 自动生成（如租双板带雪杖）
      // 字段对齐后端 BuildAssociates 默认值：noCode=true, atOnce=true, is_associate=true
      const associates = (fullCategory && fullCategory.associateCategories) || [];
      const associateItems = associates.map(a => {
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

      const rental = {
        id: 0,
        order_id: null,
        package_id: null,
        category_id: product.category.id,
        name: product.category.name,
        valid: 0,
        expectDays: 1,
        guaranty: deposit,
        realGuaranty: deposit,
        guaranty_discount: 0,
        start_date: startDateTime,
        startDateIsWeekend,
        priceList: priceList || [],
        memo: '',
        timeStamp: Date.now(),
        pick_type: defaultPickType,
        atOnce,
        category: product.category,
        rentItems: [mainItem, ...associateItems],
      };
      util.createRentalDetail(rental, new Date(startDate), new Date(startDate));
      this._appendRentals([rental]);
    } catch (err) {
      wx.hideLoading();
      console.warn('onAddSingleProduct failed', err);
      wx.showToast({ title: '添加失败，请重试', icon: 'error' });
    }
  },

  _appendRentals(rentals) {
    const current = (this.data.order && this.data.order.rentals) ? this.data.order.rentals.slice() : [];
    const merged = current.concat(rentals);
    this.setData({ 'order.rentals': merged });
    Promise.resolve(this.saveRentReceptOrder()).catch(() => {});
  },

  onEditRental(e) {
    // TODO: 弹出押金 / 租金 / 起租 / 租赁形式 / 装备录入面板
    wx.showToast({ title: '编辑租赁明细（下一步迭代）', icon: 'none' });
  },

  onSortChange(e) {
    // 按时间 / 按品种切换：第一步先记录，后续在子组件中按 sort 重排
    // const { sort } = e.detail;
  },

  onCheckout(e) {
    if (this.data.bizType === 'maintain') {
      this._checkoutCare();
      return;
    }
    const order = this.data.order;
    if (!order || !order.id) {
      wx.showToast({ title: '订单尚未生成', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '下单中…', mask: true });
    // 先把最新一笔编辑落盘：用户改完押金/租金/起租后立刻点结算，
    // 之前 syncRent 触发的 saveRentReceptOrder 可能还在飞行，需等它收尾后再下单。
    Promise.resolve(this.saveRentReceptOrder()).then(() => {
      const placedOrderId = (this.data.order && this.data.order.id) || order.id;
      const placeUrl = app.globalData.requestPrefix
        + 'Order/PlaceRentOrder/' + placedOrderId
        + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
      return util.performWebRequest(placeUrl, null);
    }).then((rentOrder) => {
      wx.hideLoading();
      if (!rentOrder || rentOrder.valid != 1) {
        wx.showToast({ title: '下单失败', icon: 'none' });
        return;
      }
      wx.navigateTo({
        url: '/pages/payment/settle/index?orderId=' + rentOrder.id,
      });
      // 立刻把本地订单脱钩，让下一次"去结算"在后端建一个全新订单（而不是给已下单的订单累加 payment）。
      // 清空 server 端绑定的 id/code/valid，并把所有 rental / rentItem 的 id 清零，
      // 这样后续 saveRentReceptOrder 会被后端当作新订单处理。
      this.setData({
        order: {
          ...rentOrder,
          id: 0,
          code: null,
          valid: 0,
          rentals: (rentOrder.rentals || []).map((r) => ({
            ...r,
            id: 0,
            order_id: 0,
            rentItems: (r.rentItems || []).map((ri) => ({
              ...ri,
              id: 0,
              rental_id: 0,
            })),
          })),
        },
      });
    }).catch((err) => {
      wx.hideLoading();
      console.warn('checkout failed', err);
      wx.showToast({ title: '下单失败', icon: 'none' });
    });
  },

  /* ---------- 与后端同步：调 Rent/SaveRentRecept ----------
   * 返回 Promise，便于 onCheckout 等同步链接调用前 await 落盘。
   * 调用方未消费 Promise 时（fire-and-forget），异常已在 .catch 里吞掉，不会抛到外面。
   */
  saveRentReceptOrder() {
    const order = this.data.order;
    if (!order.shop) {
      wx.showToast({ title: '店铺不能为空', icon: 'error' });
      return Promise.reject(new Error('店铺不能为空'));
    }
    if (!order.rentals || order.rentals.length === 0) {
      // 空购物车：仅在订单已存在（id > 0）时同步给后端清空，
      // 否则跳过避免首次进入就生成空订单
      if (!order.id) return Promise.resolve(null);
    }

    // 复制并清理 rental，避免循环引用 / 后端拒收（与旧 recept_new 一致）
    const payload = {
      ...order,
      contact_name:   this.data.customer.name || null,
      contact_gender: this.data.customer.gender || null,
      contact_num:    this.data.customer.cell || null,
      member_id:      this.data.customer.memberId || null,
      type:           '租赁',
      valid:          0,
      recepting:      1,
      rentals: (order.rentals || []).map((r) => {
        const copy = { ...r };
        if (copy.startDate) copy.startDate = util.formatDate(new Date(copy.startDate));
        if (copy.pricePresets) {
          copy.pricePresets = copy.pricePresets.map((p) => ({ ...p, id: 0 }));
        }
        copy.details = null;
        copy.category = null;
        return copy;
      }),
    };

    const url = app.globalData.requestPrefix
      + 'Rent/SaveRentRecept?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    return util.performWebRequest(url, payload).then((submitted) => {
      // 后端返回的最新 order，本地同步（保持 timeStamp 用于 wx:key）
      if (submitted && submitted.rentals) {
        submitted.rentals.forEach((r) => {
          r.timeStamp = (new Date(r.create_date || Date.now())).getTime();
        });
      }
      this.setData({ order: submitted });
      return submitted;
    }).catch((err) => {
      console.warn('saveRentReceptOrder failed', err);
      throw err;
    });
  },

  /* ---------- 与后端同步：调 Care/SaveCareRecept ----------
   * 保存串行化入口：上一笔在飞时不并发发第二笔——order.id=0 时并发的两笔都会走后端
   * create 分支重复建单（2026-07-11 生产实录：孤儿草稿成对出现，间隔 ~90ms）。
   * 在飞时排队一笔「待重存」，上一笔返回（拿到 order.id）后再用当时的最新状态重存；
   * 排队期间的多次触发合并为同一笔。返回的 Promise 始终以最后落盘的状态 resolve，
   * 供 _checkoutCare await。
   */
  saveCareReceptOrder() {
    const that = this;
    if (this._careSaveInFlight) {
      if (!this._careSaveQueued) {
        this._careSaveQueued = this._careSaveInFlight.catch(() => {}).then(() => {
          that._careSaveQueued = null;
          return that.saveCareReceptOrder();
        });
      }
      return this._careSaveQueued;
    }
    const clear = () => { that._careSaveInFlight = null; };
    const p = Promise.resolve(this._doSaveCareRecept());
    this._careSaveInFlight = p.then(
      (r) => { clear(); return r; },
      (e) => { clear(); throw e; }
    );
    return this._careSaveInFlight;
  },

  /* 实际保存逻辑。与 saveRentReceptOrder 同模式。
   * 响应合并原则（2026-07-09 重构）：以「响应时刻的最新本地状态」为基底，只从响应吸收
   * 服务端生成的 care.id / order_id / careImage.id——不能拿响应整体覆盖本地：POST 之后
   * 用户可能已继续操作（换卡/改服务项），晚到的响应整体覆盖会把新状态冲掉
   * （曾复现：选机打蜡季卡后加选修刃，季卡选择被更早一次保存的晚到响应冲掉）。
   */
  _doSaveCareRecept() {
    const order = this.data.order;
    if (!order.shop) {
      wx.showToast({ title: '店铺不能为空', icon: 'error' });
      return Promise.reject(new Error('店铺不能为空'));
    }
    if (!order.cares || order.cares.length === 0) {
      // 空购物车：仅在订单已存在时同步清空，避免首次进入就生成空订单
      if (!order.id) return Promise.resolve(null);
    }

    // 装备类型（单板/双板）是每件装备的必填项：只要有一件未选类型就跳过本次保存，
    // 不把 equipment=null 的草稿落库；等类型选定后的下一次 syncCare 再整单保存。
    // 去结算路径不受影响：checkout 由组件 canCheckout 门控（每件「已录入」才可点，含类型必选）。
    if ((order.cares || []).some((c) => !c.equipment)) {
      console.log('[saveCareReceptOrder] 存在未选类型（单板/双板）的装备，跳过 SaveCareRecept');
      return Promise.resolve(null);
    }

    const localCares = (order.cares || []);
    const payload = {
      ...order,
      contact_name:   this.data.customer.name || null,
      contact_gender: this.data.customer.gender || null,
      contact_num:    this.data.customer.cell || null,
      member_id:      this.data.customer.memberId || null,
      type:           '养护',
      valid:          0,
      recepting:      1,
      rentals:        [],
      cares: localCares.map((c) => {
        const copy = { ...c };
        // ticket/product 是前端展示对象，后端 Care 模型没有对应字段；ticket_code 标量已在 copy 里
        copy.ticket = null;
        copy.product = null;
        copy.tasks = null;
        copy.order = null;
        return copy;
      }),
    };

    const url = app.globalData.requestPrefix
      + 'Care/SaveCareRecept?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    return util.performWebRequest(url, payload).then((submitted) => {
      if (submitted && submitted.cares) {
        // 基底 = 响应时刻的最新本地 cares（可能比 POST 时的 localCares 更新）；
        // 按下标与响应对齐（提交同序），只吸收服务端生成的主键。
        // 局限：POST 与响应之间增删装备会下标漂移（与旧逻辑同级风险，属既有边界）
        const curCares = (this.data.order.cares || []);
        const srvCares = submitted.cares;
        submitted.cares = curCares.map((localC, i) => {
          const srv = srvCares[i];
          if (!srv) return localC; // POST 后新增的装备：本次响应没有它，下次保存再落库
          const merged = { ...localC };
          merged.id = merged.id || srv.id;
          merged.order_id = merged.order_id || srv.order_id;
          merged.timeStamp = merged.timeStamp || (new Date(srv.create_date || Date.now())).getTime();
          // 照片保留本地展示字段（url/thumb），按 image_id 回填服务端生成的 careImage.id。
          // 若整个用本地对象覆盖，id 永远是 0 → 下次保存后端重复插行 + 删旧行时跟踪撞键 500
          const srvImgs = srv.careImages || [];
          merged.careImages = (merged.careImages || []).map((lim) => {
            const hit = srvImgs.find((s) => s.image_id === lim.image_id);
            return hit ? { ...lim, id: lim.id || hit.id, care_id: hit.care_id || lim.care_id } : lim;
          });
          return merged;
        });
        // 服务端返回的 care.id 回填到照片关联，便于后续保存
        submitted.cares.forEach((c) => {
          (c.careImages || []).forEach((im) => { im.care_id = c.id || im.care_id; });
        });
      }
      if (submitted) submitted.rentals = submitted.rentals || [];
      this.setData({ order: submitted });
      return submitted;
    }).catch((err) => {
      console.warn('saveCareReceptOrder failed', err);
      throw err;
    });
  },

  // 养护去结算：await 落盘 → Order/PlaceCareOrder → settle，本地订单脱钩（同租赁 onCheckout 约定）
  _checkoutCare() {
    const order = this.data.order;
    if (!order || !order.cares || order.cares.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none' });
      return;
    }
    // 不再要求进入时已有 order.id：草稿保存可能还在飞行（刚下过一单脱钩重建时尤甚），
    // 等串行化保存收尾——没有 id 时这笔保存本身就会建单——再取 id 下单
    wx.showLoading({ title: '下单中…', mask: true });
    Promise.resolve(this.saveCareReceptOrder()).then(() => {
      const placedOrderId = (this.data.order && this.data.order.id) || 0;
      if (!placedOrderId) {
        const err = new Error('订单尚未生成，请重试');
        err._toastMsg = '订单尚未生成，请重试';
        throw err;
      }
      const placeUrl = app.globalData.requestPrefix
        + 'Order/PlaceCareOrder/' + placedOrderId
        + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
      return util.performWebRequest(placeUrl, null);
    }).then((careOrder) => {
      wx.hideLoading();
      if (!careOrder || careOrder.valid != 1) {
        wx.showToast({ title: '下单失败', icon: 'none' });
        return;
      }
      wx.navigateTo({
        url: '/pages/payment/settle/index?orderId=' + careOrder.id,
      });
      // 本地订单脱钩：下一次「去结算」在后端建全新订单（同租赁写法）
      this.setData({
        order: {
          ...careOrder,
          id: 0,
          code: null,
          valid: 0,
          rentals: [],
          cares: (careOrder.cares || []).map((c) => ({
            ...c,
            id: 0,
            order_id: 0,
            careImages: (c.careImages || []).map((im) => ({ ...im, id: 0, care_id: 0 })),
          })),
        },
      });
    }).catch((err) => {
      wx.hideLoading();
      if (err && err._toastMsg) {
        wx.showToast({ title: err._toastMsg, icon: 'none' });
        return;
      }
      console.warn('care checkout failed', err);
      // performWebRequest 已 toast 后端 message（如"非雪季养护需要匹配会员"），这里不重复弹
    });
  },
});
