// pages/careadmin/member_equips/member_equips.js
// 会员名下装备列表管理页（查看装备、查看修改历史、手动新增/编辑/删除装备）
const app = getApp();
const data = require('../../../utils/data.js');
const util = require('../../../utils/util.js');
const equipDiff = require('../../../utils/member_equipment_diff.js');

const UPLOAD_HOST = data.IMAGE_HOST;

function toFullUrl(v) {
  if (!v) return '';
  const s = String(v).trim();
  return /^(https?:|wxfile:)/.test(s) ? s : UPLOAD_HOST + s;
}

function formatDateTime(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw).slice(0, 16).replace('T', ' ');
  return util.formatDate(d) + ' ' + util.formatTimeStr(d).slice(0, 5);
}

Page({
  data: {
    memberId: 0,
    memberName: '',
    loading: true,
    items: [],
    filteredItems: [],
    tab: 'all',
    counts: { all: 0, ski: 0, board: 0 },

    skiBrandList: [],
    boardBrandList: [],

    editor: {
      show: false,
      id: 0,
      equipment: '双板',
      brand: '',
      brandIndex: -1,
      brandListView: [],
      scale: '',
      diffSerial: false,
      serials: '',
      leftSerial: '',
      rightSerial: '',
      imageId: null,
      photoUrl: '',
      photoFullUrl: '',
      uploading: false,
      saving: false,
    },

    addBrand: {
      show: false,
      name: '',
      chineseName: '',
    },

    history: {
      show: false,
      loading: false,
      equipTitle: '',
      rows: [],
    },
  },

  noop() {},

  onLoad(options) {
    const memberId = parseInt(options && options.memberId, 10) || 0;
    let memberName = '';
    if (options && options.memberName) {
      try { memberName = decodeURIComponent(options.memberName); } catch (_) { memberName = options.memberName; }
    }
    this.setData({ memberId, memberName });
    Promise.resolve(app.loginPromiseNew).then(() => {
      this._loadBrands();
      this.loadList();
    });
  },

  _loadBrands() {
    Promise.all([
      data.getEquipBrandsPromise('双板').catch(() => []),
      data.getEquipBrandsPromise('单板').catch(() => []),
    ]).then(([ski, board]) => {
      this.setData({
        skiBrandList: ski || [],
        boardBrandList: board || [],
      });
      if (this.data.editor.show) {
        this._syncEditorBrandList(this.data.editor.equipment, this.data.editor.brand);
      }
    });
  },

  loadList() {
    if (!this.data.memberId) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    data.getMemberEquipmentsByStaffPromise(this.data.memberId, null, app.globalData.sessionKey)
      .then((list) => {
        const rows = (list || []).map((it) => {
          const photoUrl = toFullUrl(it.photoUrl);
          const photoFullUrl = toFullUrl(it.photoFullUrl || it.photoUrl);
          const lastCareStr = it.last_care_date ? String(it.last_care_date).slice(0, 10) : '';
          const createStr = it.create_date ? String(it.create_date).slice(0, 10) : '';
          return {
            ...it,
            _photoUrl: photoUrl,
            _photoFullUrl: photoFullUrl,
            _brandText: it.brand || '未填品牌',
            _serialText: equipDiff.formatSerialsDisplay(it.serials),
            _dateLine: lastCareStr ? ('最近养护 ' + lastCareStr) : ('建档日期 ' + createStr),
          };
        });
        const counts = {
          all: rows.length,
          ski: rows.filter((x) => x.equipment === '双板').length,
          board: rows.filter((x) => x.equipment === '单板').length,
        };
        this.setData({ items: rows, counts, loading: false });
        this._applyFilter(this.data.tab, rows);
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab });
    this._applyFilter(tab, this.data.items);
  },

  _applyFilter(tab, items) {
    const filteredItems = tab === 'all'
      ? (items || [])
      : (items || []).filter((x) => x.equipment === tab);
    this.setData({ filteredItems });
  },

  onPreviewPhoto(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },

  /* ---------- 新增 / 编辑 ---------- */
  _brandViewFor(equipment, selectedBrand) {
    const list = equipment === '单板' ? (this.data.boardBrandList || []) : (this.data.skiBrandList || []);
    const brandListView = list.map((b) => b.displayedName).concat(['＋ 新增品牌']);
    let brandIndex = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].displayedName === selectedBrand) { brandIndex = i; break; }
    }
    return { brandListView, brandIndex };
  },

  _syncEditorBrandList(equipment, selectedBrand) {
    const { brandListView, brandIndex } = this._brandViewFor(equipment, selectedBrand);
    this.setData({
      'editor.brandListView': brandListView,
      'editor.brandIndex': brandIndex,
    });
  },

  onOpenCreate() {
    const equip = this.data.tab === '单板' ? '单板' : '双板';
    const { brandListView, brandIndex } = this._brandViewFor(equip, '');
    this.setData({
      editor: {
        show: true,
        id: 0,
        equipment: equip,
        brand: '',
        brandIndex,
        brandListView,
        scale: '',
        diffSerial: false,
        serials: '',
        leftSerial: '',
        rightSerial: '',
        imageId: null,
        photoUrl: '',
        photoFullUrl: '',
        uploading: false,
        saving: false,
      },
    });
  },

  onOpenEdit(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.filteredItems[idx];
    if (!item) return;
    const equip = item.equipment === '单板' ? '单板' : '双板';
    const split = equipDiff.splitSerials(item.serials);
    const { brandListView, brandIndex } = this._brandViewFor(equip, item.brand || '');
    this.setData({
      editor: {
        show: true,
        id: item.id,
        equipment: equip,
        brand: item.brand || '',
        brandIndex,
        brandListView,
        scale: item.scale || '',
        diffSerial: equip === '双板' ? split.diff : false,
        serials: equip === '双板' && split.diff ? '' : split.serials,
        leftSerial: split.leftSerial,
        rightSerial: split.rightSerial,
        imageId: item.image_id || null,
        photoUrl: item._photoUrl || '',
        photoFullUrl: item._photoFullUrl || '',
        uploading: false,
        saving: false,
      },
    });
  },

  onCloseEditor() {
    if (this.data.editor.saving || this.data.editor.uploading) return;
    this.setData({ 'editor.show': false });
  },

  onEditorEquipTap(e) {
    const equip = e.currentTarget.dataset.equip;
    if (!equip || equip === this.data.editor.equipment) return;
    const { brandListView } = this._brandViewFor(equip, '');
    const patch = {
      'editor.equipment': equip,
      'editor.brand': '',
      'editor.brandIndex': -1,
      'editor.brandListView': brandListView,
    };
    if (equip === '单板' && this.data.editor.diffSerial) {
      patch['editor.diffSerial'] = false;
      patch['editor.serials'] = this.data.editor.leftSerial || this.data.editor.rightSerial || '';
      patch['editor.leftSerial'] = '';
      patch['editor.rightSerial'] = '';
    }
    this.setData(patch);
  },

  onEditorBrandChange(e) {
    const idx = Number(e.detail.value);
    const list = this.data.editor.equipment === '单板' ? this.data.boardBrandList : this.data.skiBrandList;
    if (idx >= list.length) {
      this.setData({ addBrand: { show: true, name: '', chineseName: '' } });
      return;
    }
    const chosen = list[idx];
    if (!chosen) return;
    this.setData({
      'editor.brand': chosen.displayedName,
      'editor.brandIndex': idx,
    });
  },

  onAddBrandInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['addBrand.' + field]: e.detail.value });
  },

  onCloseAddBrand() {
    this.setData({ 'addBrand.show': false });
  },

  onConfirmAddBrand() {
    const { name, chineseName } = this.data.addBrand;
    const trimName = (name || '').trim();
    if (!trimName) {
      wx.showToast({ title: '请填写英文名称', icon: 'none' });
      return;
    }
    const equip = this.data.editor.equipment;
    const url = app.globalData.requestPrefix + 'Care/UpdateBrandByStaff?type=' + encodeURIComponent(equip)
      + '&brandName=' + encodeURIComponent(trimName)
      + '&chineseName=' + encodeURIComponent((chineseName || '').trim())
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '');
    util.performWebRequest(url, null).then((brandList) => {
      const list = brandList || [];
      const patch = equip === '单板' ? { boardBrandList: list } : { skiBrandList: list };
      this.setData({ ...patch, 'addBrand.show': false });
      const added = list.find((b) => b.brand_name === trimName);
      const disp = added ? added.displayedName : (trimName + '/' + ((chineseName || '').trim()));
      this._syncEditorBrandList(equip, disp);
      this.setData({ 'editor.brand': disp });
    }).catch(() => {
      wx.showToast({ title: '新增品牌失败', icon: 'none' });
    });
  },

  onEditorScaleInput(e) {
    this.setData({ 'editor.scale': e.detail.value });
  },

  onEditorDiffSerialTap() {
    const next = !this.data.editor.diffSerial;
    this.setData({
      'editor.diffSerial': next,
      'editor.serials': '',
      'editor.leftSerial': '',
      'editor.rightSerial': '',
    });
  },

  onEditorSerialInput(e) {
    this.setData({ 'editor.serials': e.detail.value });
  },

  onEditorSplitSerialInput(e) {
    const side = e.currentTarget.dataset.side;
    this.setData({ [side === 'left' ? 'editor.leftSerial' : 'editor.rightSerial']: e.detail.value });
  },

  onEditorChoosePhoto() {
    if (this.data.editor.uploading) return;
    const that = this;
    const handleTempFile = (tempFilePath, thumbPath) => {
      if (!tempFilePath) return;
      that.setData({ 'editor.uploading': true });
      data.uploadFilePromise(null, tempFilePath, '会员装备', 'image', app.globalData.sessionKey)
        .then((uploaded) => data.uploadFilePromise(uploaded.id, thumbPath || tempFilePath, null, null, app.globalData.sessionKey))
        .then((withThumb) => {
          that.setData({
            'editor.uploading': false,
            'editor.imageId': withThumb.id,
            'editor.photoUrl': toFullUrl(withThumb.thumbUrl || withThumb.file_path_name),
            'editor.photoFullUrl': toFullUrl(withThumb.file_path_name),
          });
        })
        .catch(() => {
          that.setData({ 'editor.uploading': false });
          wx.showToast({ title: '照片上传失败', icon: 'none' });
        });
    };

    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success(res) {
          const f = res && res.tempFiles && res.tempFiles[0];
          if (f) handleTempFile(f.tempFilePath, f.thumbTempFilePath);
        },
      });
    } else if (typeof wx.chooseImage === 'function') {
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success(res) {
          const p = res && res.tempFilePaths && res.tempFilePaths[0];
          if (p) handleTempFile(p, p);
        },
      });
    }
  },

  onEditorRemovePhoto() {
    this.setData({
      'editor.imageId': null,
      'editor.photoUrl': '',
      'editor.photoFullUrl': '',
    });
  },

  onSaveEditor() {
    const ed = this.data.editor;
    if (ed.saving || ed.uploading) return;
    if (!ed.equipment) {
      wx.showToast({ title: '请选择装备类型', icon: 'none' });
      return;
    }
    const brand = equipDiff.normalizeText(ed.brand);
    const scale = equipDiff.normalizeText(ed.scale);
    if (!brand && !ed.imageId) {
      wx.showToast({ title: '请至少选择品牌或上传装备照片', icon: 'none' });
      return;
    }
    const serials = equipDiff.composeSerials(
      ed.equipment === '双板' && ed.diffSerial,
      ed.serials,
      ed.leftSerial,
      ed.rightSerial
    );
    const payload = {
      id: ed.id || 0,
      memberId: this.data.memberId,
      equipment: ed.equipment,
      brand: brand || null,
      scale: scale || null,
      serials,
      imageId: ed.imageId || null,
    };

    this.setData({ 'editor.saving': true });
    const req = ed.id
      ? data.updateMemberEquipmentByStaffPromise(payload, app.globalData.sessionKey)
      : data.createMemberEquipmentByStaffPromise(payload, app.globalData.sessionKey);

    req.then(() => {
      this.setData({ 'editor.saving': false, 'editor.show': false });
      wx.showToast({ title: ed.id ? '已保存修改' : '已添加装备', icon: 'success' });
      this.loadList();
    }).catch(() => {
      this.setData({ 'editor.saving': false });
    });
  },

  /* ---------- 删除 ---------- */
  onDeleteTap(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const item = this.data.filteredItems[idx];
    if (!item) return;
    const title = [item.equipment, equipDiff.brandShortName(item.brand), item.scale ? item.scale + 'cm' : '']
      .filter(Boolean).join(' · ');
    wx.showModal({
      title: '删除装备',
      content: '确认从该会员装备列表中删除「' + title + '」？（删除操作会保留在修改记录中）',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中…', mask: true });
        data.deleteMemberEquipmentByStaffPromise(item.id, app.globalData.sessionKey)
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadList();
          })
          .catch(() => {
            wx.hideLoading();
          });
      },
    });
  },

  /* ---------- 修改历史 ---------- */
  onOpenHistory(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id) return;
    const item = (this.data.items || []).find((x) => x.id === id);
    const equipTitle = item
      ? [item.equipment, item._brandText, item.scale ? item.scale + 'cm' : ''].filter(Boolean).join(' · ')
      : '';
    this.setData({
      history: { show: true, loading: true, equipTitle, rows: [] },
    });
    data.getMemberEquipmentHistoryByStaffPromise(id, app.globalData.sessionKey)
      .then((rows) => {
        const formatted = (rows || []).map((r) => ({
          ...r,
          _timeStr: formatDateTime(r.time),
        }));
        this.setData({
          'history.loading': false,
          'history.rows': formatted,
        });
      })
      .catch(() => {
        this.setData({ 'history.loading': false });
      });
  },

  onCloseHistory() {
    this.setData({ 'history.show': false });
  },
});
