// pages/admin/reception/recept_member.js
// 接待·顾客信息（对应旧版 recept_member_info + components/user_info/member_info）：
//   直接显示顾客信息，店员可以改联系电话、称呼（姓名 + 先生/女士），再选店铺和业务进入开单。
//   - 已有资料改动后，开单前选择更新会员资料、只用于本单或放弃修改；空白资料会在进入业务前自动保存。
//   - 更新会员资料时，姓名和性别写回会员，新的联系电话追加为联系号码（不动绑定手机号）。
//   从扫码接待页（recept_scan）进来有两种情况：
//   - 顾客扫码（checkinId）：老顾客直接显示会员信息；新顾客要在手机上授权手机号，本页轮询，
//     授权后弹窗提示店员，再显示会员信息。顾客不方便授权时可改按散客开单。
//   - 散客进入（walkin=1）：不挂会员，姓名/性别/电话都选填；填的手机号是会员的，自动按会员显示。
//
// 后端依赖（SnowmeetApi）：QrCode/GetReceptCheckinByStaff、Member/GetMember、Member/UpdateMemberInfo；
//   选店由 shop-selector 组件内部调 Order/GetShops
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');
const { normalizePhone, isValidInternationalPhone, shouldLookupPhone } = require('../../../utils/phone.js');

const POLL_INTERVAL = 1500;

Page({
  data: {
    // 'scan' = 顾客扫码；'walkin' = 散客
    mode: 'walkin',
    checkinId: 0,
    // 顾客已扫码、还没授权手机号
    waitingPhone: false,
    memberLoading: false,

    // 会员档案（Member/GetMember 的摘要）；null = 散客
    // { id, cell, realName, gender, contactNums: [号码], availableDepositStr, availablePoints }
    member: null,
    // 本次订单的顾客信息（开单时存进订单，不改会员资料）
    form: { name: '', gender: '', cell: '' },
    // 会员登记过的其他联系号码，点一下填进联系电话
    otherNums: [],
    // 表单和会员资料不一致时可以「更新顾客信息」
    needUpdate: false,
    // 店员勾了「这是测试订单」：本次开的单记为测试单（order.is_test=1）
    isTest: false,

    // 店铺信息：由 shop-selector 通过 ShopSelected 事件回传
    currentShopName: '',
    shop: '',
    sale: 0,
    rent: 0,
    care: 0,
    restuarant: 0,
  },

  /* ---------- 生命周期 ---------- */
  // options.stage：扫码页跳过来时码的阶段。need_phone = 新顾客还要授权手机号，授权后弹窗告诉店员；
  // verified = 老顾客已有手机号、phone_authed = 店员输手机号已授权，都拉到会员信息直接显示
  onLoad(options) {
    this._pollTimer = null;
    this._lookupTimer = null;
    this._lastLookupCell = '';
    this._memberLookupSequence = 0;
    this._memberLookupPending = false;
    this._memberLoadPending = false;
    this._memberUpdatePending = false;
    this._businessContinuationPending = false;
    this._memberRaw = null;   // GetMember 原始数据，「更新顾客信息」时用
    this._originalForm = null;
    this._memberBaselineForm = null;
    this._memberProfileMissing = false;
    const checkinId = Number(options.checkinId || 0);
    if (!checkinId) {
      this.setData({ mode: 'walkin' });
      return;
    }
    this._announceOnVerify = options.stage === 'need_phone';
    this.setData({ mode: 'scan', checkinId, waitingPhone: true });
    this.pollCheckin();
  },

  onShow() {
    if (this.data.waitingPhone) this._startPolling();
  },

  onHide() {
    this._stopPolling();
  },

  onUnload() {
    this._stopPolling();
    if (this._lookupTimer) {
      clearTimeout(this._lookupTimer);
      this._lookupTimer = null;
    }
  },

  /* ---------- 等顾客授权手机号 ---------- */
  _startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => this.pollCheckin(), POLL_INTERVAL);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  pollCheckin() {
    const checkinId = this.data.checkinId;
    if (!checkinId || !this.data.waitingPhone) {
      this._stopPolling();
      return;
    }
    Promise.resolve(app.loginPromiseNew).then(() => {
      return data.getReceptCheckinByStaffPromise(checkinId, app.globalData.sessionKey);
    }).then((res) => {
      // 网络抖动 / 偶发错误：等下一轮再查
      if (!res || res.code !== 0 || !res.data) return;
      // 已改按散客开单，丢弃
      if (!this.data.waitingPhone) return;
      this.applyCheckin(res.data);
    });
  },

  applyCheckin(view) {
    if (view.stage !== 'verified' && view.stage !== 'phone_authed') return;
    this._stopPolling();
    this.setData({
      waitingPhone: false,
      form: { name: view.name || '', gender: view.gender || '', cell: view.cell || '' },
    });
    this.loadMember(view.memberId);
    if (this._announceOnVerify) {
      wx.showModal({
        title: '顾客已授权手机号',
        content: '顾客已经授权了手机号 ' + (view.maskedCell || '') + '，请选择店铺和业务开单。',
        showCancel: false,
        confirmText: '知道了',
      });
    }
  },

  // 顾客不方便授权手机号：改按散客开单
  onWalkInInstead() {
    wx.showModal({
      title: '按散客开单',
      content: '顾客还没授权手机号。按散客开单后，顾客手机不会自动跳到付款页。确定吗？',
      success: (res) => {
        if (!res.confirm) return;
        this._stopPolling();
        this._memberLookupSequence++;
        this._memberLookupPending = false;
        this._memberRaw = null;
        this._originalForm = null;
        this._memberBaselineForm = null;
        this._memberProfileMissing = false;
        this.setData({
          mode: 'walkin',
          waitingPhone: false,
          memberLoading: false,
          member: null,
          form: { name: '', gender: '', cell: '' },
          otherNums: [],
          needUpdate: false,
        });
      },
    });
  },

  /* ---------- 会员档案 ---------- */
  _formSnapshot(form) {
    const source = form || {};
    return {
      name: (source.name || '').trim(),
      gender: (source.gender || '').trim(),
      cell: (source.cell || '').trim(),
    };
  },

  _applyMemberRecord(raw) {
    if (!raw || !raw.id) {
      this._memberRaw = null;
      this._originalForm = null;
      this._memberBaselineForm = null;
      this._memberProfileMissing = false;
      this.setData({ member: null, memberLoading: false, otherNums: [], needUpdate: false });
      return null;
    }
    this._memberRaw = raw;
    const contactNums = (raw.contactNums || []).map((contact) => (contact.num || '').trim()).filter((num) => num);
    const member = {
      id: raw.id,
      cell: (raw.cell || '').trim(),
      realName: (raw.real_name || '').trim(),
      gender: (raw.gender || '').trim(),
      contactNums,
      availableDepositStr: util.showAmount(raw.availableDeposit || 0),
      availablePoints: raw.avaliablePoints || 0,
    };
    const baselineForm = {
      name: member.realName,
      gender: member.gender === '男' || member.gender === '女' ? member.gender : '',
      cell: member.cell || contactNums[0] || '',
    };
    this._memberBaselineForm = this._formSnapshot(baselineForm);
    const form = Object.assign({}, this.data.form);
    if (!form.name && member.realName) form.name = member.realName;
    if (!form.gender && (member.gender === '男' || member.gender === '女')) form.gender = member.gender;
    if (!form.cell) form.cell = member.cell || contactNums[0] || '';
    this._originalForm = this._formSnapshot(form);
    this._memberProfileMissing = !member.realName && !member.gender;
    this.setData({ member, form, memberLoading: false });
    this._refreshDerived();
    return member;
  },

  loadMember(memberId) {
    if (!memberId) return Promise.resolve(this._applyMemberRecord(null));
    this._memberLoadPending = true;
    this.setData({ memberLoading: true });
    return Promise.resolve(app.loginPromiseNew).then(() => {
      return data.getMemberPromise(memberId, app.globalData.sessionKey);
    }).then((m) => {
      return this._applyMemberRecord(m);
    }).catch(() => this._applyMemberRecord(null)).then((member) => {
      this._memberLoadPending = false;
      this.setData({ memberLoading: false });
      return member;
    });
  },

  // 联系号码候选 + 是否和会员资料不一致
  _refreshDerived() {
    const member = this.data.member;
    const form = this.data.form;
    if (!member) {
      this._changes = [];
      this.setData({ otherNums: [], needUpdate: false });
      return;
    }
    const cell = (form.cell || '').trim();
    const changes = [];
    const name = (form.name || '').trim();
    if (name && name !== member.realName) changes.push('姓名改为：' + name);
    if (form.gender && form.gender !== member.gender) changes.push('性别改为：' + (form.gender === '男' ? '先生' : '女士'));
    if (cell && isValidInternationalPhone(cell) && member.contactNums.indexOf(cell) < 0 && cell !== member.cell) {
      changes.push('增加联系电话：' + cell);
    }
    this._changes = changes;
    this.setData({
      otherNums: member.contactNums.filter((n) => n !== cell),
      needUpdate: changes.length > 0,
    });
  },

  _isFormDirty() {
    const original = this._originalForm;
    if (!this.data.member || !original) return false;
    const current = this._formSnapshot(this.data.form);
    return current.name !== original.name || current.gender !== original.gender || current.cell !== original.cell
      || this.data.needUpdate;
  },

  _hasProfileDataToSave() {
    const member = this.data.member;
    if (!member || !this._memberProfileMissing) return false;
    const form = this._formSnapshot(this.data.form);
    const hasName = !member.realName && !!form.name;
    const hasGender = !member.gender && (form.gender === '男' || form.gender === '女');
    const knownNumbers = [member.cell].concat(member.contactNums || []);
    const hasNewContact = !!form.cell && isValidInternationalPhone(form.cell) && !knownNumbers.includes(form.cell);
    return hasName || hasGender || hasNewContact;
  },

  /* ---------- 顾客信息表单（只改本次订单） ---------- */
  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
    this._refreshDerived();
  },

  // 称呼性别为单选：重复点击当前项不取消选择。
  onGenderTap(e) {
    const value = e.currentTarget.dataset.value;
    if (this.data.form.gender === value) return;
    this.setData({ 'form.gender': value });
    this._refreshDerived();
  },

  onCellInput(e) {
    const cell = (e.detail.value || '').trim();
    this.setData({ 'form.cell': cell });
    this._refreshDerived();
    if (!this.data.member) this._scheduleMemberLookup(cell);
  },

  onPickNum(e) {
    this.setData({ 'form.cell': e.currentTarget.dataset.num });
    this._refreshDerived();
  },

  // 散客填的手机号是会员的：按会员显示（与开单入口 recept_entry 一致，防抖后静默查询）
  _scheduleMemberLookup(cell) {
    if (this._lookupTimer) {
      clearTimeout(this._lookupTimer);
      this._lookupTimer = null;
    }
    const sequence = ++this._memberLookupSequence;
    this._memberLookupPending = false;
    const normalized = normalizePhone(cell);
    if (!shouldLookupPhone(normalized) || normalized === this._lastLookupCell) return;
    this._memberLookupPending = true;
    this._lookupTimer = setTimeout(() => {
      this._lookupTimer = null;
      this._lastLookupCell = normalized;
      Promise.resolve(app.loginPromiseNew).then(() => {
        return data.getMemberByNumSilentPromise(normalized);
      }).then((found) => {
        const memberId = found && (found.id || found.member_id || found.memberId);
        // 查询期间号码改了或已挂上会员，丢弃
        if (!memberId || this.data.member || normalizePhone(this.data.form.cell) !== normalized) return null;
        return this.loadMember(memberId);
      }).catch(() => null).then(() => {
        if (sequence === this._memberLookupSequence) this._memberLookupPending = false;
      });
    }, 450);
  },

  /* ---------- 更新顾客信息（改会员资料） ---------- */
  onUpdateMemberTap() {
    if (!this.data.member || !this.data.needUpdate || !this._memberRaw || this._memberUpdatePending) return;
    wx.showModal({
      title: '更新顾客信息',
      content: (this._changes || []).join('\n'),
      success: (res) => {
        if (!res.confirm) return;
        this._updateMember();
      },
    });
  },

  _updateMember(options) {
    const raw = this._memberRaw;
    const form = this._formSnapshot(this.data.form);
    const updateOptions = options || {};
    if (!raw || this._memberUpdatePending) return Promise.resolve(false);
    // 后端只用这几个字段：姓名、性别写回会员；currentContactNum 不在已有号码里就追加为联系号码
    const payload = {
      id: raw.id,
      real_name: form.name,
      gender: form.gender,
      currentContactNum: form.cell && isValidInternationalPhone(form.cell) ? form.cell : null,
      memberSocialAccounts: (raw.contactNums || []).map((c) => ({
        id: c.id, member_id: c.member_id, type: c.type, num: c.num, valid: c.valid,
      })),
    };
    this._memberUpdatePending = true;
    wx.showLoading({ title: '更新中...', mask: true });
    return data.updateMemberInfoByStaffPromise(payload, '开单', app.globalData.sessionKey).then((updated) => {
      return this._applyMemberRecord(updated);
    }).then(() => {
      wx.hideLoading();
      this._memberUpdatePending = false;
      if (updateOptions.showSuccessToast !== false) wx.showToast({ title: '已更新顾客信息', icon: 'success' });
      return !!this.data.member;
    }).catch(() => {
      // performWebRequest 已提示错误
      wx.hideLoading();
      this._memberUpdatePending = false;
      return false;
    });
  },

  onMemberDetail() {
    const member = this.data.member;
    if (!member) return;
    wx.navigateTo({ url: '/pages/admin/member/member_detail?id=' + member.id });
  },

  /* ---------- 选店铺 ---------- */
  shopSelected(e) {
    const { shop, sale, rent, care, restuarant } = e.detail || {};
    this.setData({
      currentShopName: shop || '',
      shop: shop || '',
      sale: sale || 0,
      rent: rent || 0,
      care: care || 0,
      restuarant: restuarant || 0,
    });
  },

  onTestToggle() {
    this.setData({ isTest: !this.data.isTest });
  },

  /* ---------- 选业务进入开单 ---------- */
  onBizTap(e) {
    const bizType = e.currentTarget.dataset.type;
    const { shop, sale, rent, care } = this.data;

    if (this._businessContinuationPending || this._memberUpdatePending) return;
    if (this.data.waitingPhone) {
      wx.showToast({ title: '请等顾客授权手机号', icon: 'none' });
      return;
    }
    if (this._memberLoadPending || this._memberLookupPending || this.data.memberLoading) {
      wx.showToast({ title: '正在查询会员资料，请稍候', icon: 'none' });
      return;
    }
    if (!shop) {
      wx.showToast({ title: '请先选择店铺', icon: 'none' });
      return;
    }
    if (bizType === 'retail' && sale !== 1) {
      wx.showToast({ title: '当前店铺不支持零售', icon: 'none' });
      return;
    }
    if (bizType === 'maintain' && care !== 1) {
      wx.showToast({ title: '当前店铺不支持养护', icon: 'none' });
      return;
    }
    if (bizType === 'rent' && rent !== 1) {
      wx.showToast({ title: '当前店铺不支持租赁', icon: 'none' });
      return;
    }
    const form = this.data.form;
    const name = (form.name || '').trim();
    const cell = (form.cell || '').trim();
    if (cell && !isValidInternationalPhone(cell)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }

    this._businessContinuationPending = true;
    if (this.data.member && this._hasProfileDataToSave()) {
      this._saveMemberThenContinue(bizType, '会员信息已自动保存');
      return;
    }
    if (this.data.member && this._isFormDirty()) {
      wx.showActionSheet({
        itemList: ['更新会员信息', '保存为本订单临时联系人', '放弃修改'],
        success: (result) => {
          if (result.tapIndex === 0) {
            this._saveMemberThenContinue(bizType, '会员信息已更新');
          } else if (result.tapIndex === 1) {
            this._navigateToBusiness(bizType);
          } else if (result.tapIndex === 2) {
            this.setData({ form: Object.assign({}, this._memberBaselineForm) });
            this._refreshDerived();
            this._navigateToBusiness(bizType);
          } else {
            this._businessContinuationPending = false;
          }
        },
        fail: () => { this._businessContinuationPending = false; },
      });
      return;
    }
    this._navigateToBusiness(bizType);
  },

  _saveMemberThenContinue(bizType, successMessage) {
    this._updateMember({ showSuccessToast: false }).then((saved) => {
      if (!saved) {
        this._businessContinuationPending = false;
        wx.showToast({ title: '会员信息保存失败，请重试', icon: 'none' });
        return;
      }
      if (successMessage) wx.showToast({ title: successMessage, icon: 'success' });
      this._navigateToBusiness(bizType);
    });
  },

  _navigateToBusiness(bizType) {
    this._businessContinuationPending = false;
    const { shop } = this.data;
    const form = this.data.form;
    const name = (form.name || '').trim();
    const cell = (form.cell || '').trim();

    // 暂存订单标识信息（PRD §1.4.6 订单找回），字段与 recept_entry 一致
    wx.setStorageSync('reception_draft', {
      shopName: shop,
      customerName: name,
      gender: form.gender || '',
      customerCell: cell,
      bizType: bizType,
      createdAt: Date.now(),
    });

    const params = [
      'bizType=' + encodeURIComponent(bizType),
      'shop=' + encodeURIComponent(shop),
      'customerName=' + encodeURIComponent(name),
      'gender=' + encodeURIComponent(form.gender || ''),
      'customerCell=' + encodeURIComponent(cell),
    ];
    if (this.data.member) {
      params.push('memberId=' + encodeURIComponent(this.data.member.id));
    }
    if (this.data.isTest) {
      params.push('isTest=1');
    }
    wx.navigateTo({ url: '/pages/admin/reception/recept_new?' + params.join('&') });
  },
});
