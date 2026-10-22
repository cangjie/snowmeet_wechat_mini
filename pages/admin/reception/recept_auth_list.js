// pages/admin/reception/recept_auth_list.js
// 【接待】接待授权（对应旧版 pages/admin/recept/recept_auth_list）：
//   普通店员在扫码接待页输会员手机号进入时，要店长在这里点「授权」，店员那边查到授权后进入顾客信息页。
//   只有店长及以上（title_level >= 200）能授权；页面显示时每 5 秒刷新一次，新提交的申请会自动出现。
// 后端依赖（SnowmeetApi QrCodeController）：GetTodayAuthCellList / GiveAuth
const app = getApp();
const data = require('../../../utils/data.js');

const REFRESH_INTERVAL = 5000;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

Page({
  data: {
    isManager: false,
    loaded: false,
    authList: [],
  },

  onLoad() {
    this._timer = null;
  },

  onShow() {
    Promise.resolve(app.loginPromiseNew).then(() => {
      const staff = app.globalData.staff;
      const isManager = !!staff && staff.title_level >= 200;
      this.setData({ isManager });
      if (!isManager) return;
      this.getData();
      this._stopTimer();
      this._timer = setInterval(() => this.getData(), REFRESH_INTERVAL);
    });
  },

  onHide() {
    this._stopTimer();
  },

  onUnload() {
    this._stopTimer();
  },

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  getData() {
    return data.getTodayAuthCellListPromise(app.globalData.sessionKey).then((list) => {
      const authList = (list || []).map((item) => {
        const t = new Date(item.submitTime);
        const member = item.member || {};
        return {
          id: item.id,
          cell: item.cell,
          authed: !!item.authed,
          name: (member.real_name || '').trim(),
          gender: (member.gender || '').trim(),
          staffName: (item.submitStaff && item.submitStaff.name) || '',
          timeStr: isNaN(t.getTime()) ? '' : pad(t.getHours()) + ':' + pad(t.getMinutes()),
        };
      });
      this.setData({ authList, loaded: true });
    }).catch(() => {
      this.setData({ loaded: true });
    });
  },

  onRefreshTap() {
    this.getData();
  },

  giveAuth(e) {
    const id = e.currentTarget.dataset.id;
    data.giveReceptAuthPromise(id, app.globalData.sessionKey).then(() => {
      wx.showToast({ title: '已授权', icon: 'success' });
      return this.getData();
    }).catch(() => {});
  },
});
