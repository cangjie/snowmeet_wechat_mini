const app = getApp();
const data = require('../../utils/data.js');

function imageUrl(value) {
  if (!value) return '';
  return /^(https?:|wxfile:)/.test(value) ? value : (data.IMAGE_HOST || '') + value;
}

function equipmentRow(care, index) {
  const projects = [];
  if (care.need_edge === 1) projects.push('修刃');
  if (care.need_wax === 1) projects.push('热蜡');
  if (care.need_unwax === 1) projects.push('刮蜡');
  if (care.free_wax === 1) projects.push('机打蜡');
  if (care.need_repair === 1 || care.repair_memo) projects.push('维修');
  if (care.summer != null) projects.push('寄存');
  if (care.urgent === 1) projects.push('立等');
  const photos = (care.careImages || []).map(im => {
    const image = im.image || {};
    const url = imageUrl(im.url || image.file_path_name);
    return { url, thumb: imageUrl(im.thumb || image.thumbUrl) || url };
  }).filter(im => im.url);
  return {
    id: care.id,
    title: '第' + (index + 1) + '件 · ' + (care.equipment || '装备'),
    equipment: [(care.brand || '').split('/')[0], care.series, care.scale ? care.scale + 'cm' : ''].filter(Boolean).join(' · '),
    serial: care.serials || '',
    projects: projects.join('、') || (care.description && care.description !== '无' ? care.description : '项目未记录'),
    cancelled: !!care.is_cancel,
    photos
  };
}

Component({
  properties: {
    orderId: { type: Number, value: 0, observer() { if (this._ready) this.loadOrder(); } }
  },
  data: { rows: [], loading: false, error: '' },
  lifetimes: {
    attached() {
      this._detached = false;
      Promise.resolve(app.loginPromiseNew).then(() => {
        if (this._detached) return;
        this._ready = true;
        this.loadOrder();
      });
    },
    detached() { this._detached = true; this._ready = false; this._sequence = (this._sequence || 0) + 1; }
  },
  methods: {
    async loadOrder() {
      const sequence = this._sequence = (this._sequence || 0) + 1;
      const orderId = this.properties.orderId;
      this.setData({ rows: [], error: '', loading: !!orderId });
      if (!orderId) return;
      try {
        const order = await data.getOrderByStaffPromise(orderId, app.globalData.sessionKey);
        if (sequence !== this._sequence) return;
        this.setData({ rows: (order.cares || []).map(equipmentRow) });
      } catch (e) {
        if (sequence === this._sequence) this.setData({ error: '养护内容加载失败，点击重试' });
      } finally {
        if (sequence === this._sequence) this.setData({ loading: false });
      }
    },
    onPhotoTap(e) {
      const row = this.data.rows[Number(e.currentTarget.dataset.row)];
      const photo = row && row.photos[Number(e.currentTarget.dataset.index)];
      if (photo) wx.previewImage({ current: photo.url, urls: row.photos.map(im => im.url) });
    }
  }
});
